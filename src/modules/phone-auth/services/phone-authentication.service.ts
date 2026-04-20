import {
	Injectable,
	BadRequestException,
	ConflictException,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UserAuthService } from '../../common/services/user-auth.service';
import { UserAuth } from '../../common/entities/user-auth.entity';
import { DeviceRegistrationService } from '../../devices/services/device-registration/device-registration.service';
import { DeviceActivityService } from '../../devices/services/device-activity/device-activity.service';
import { DeviceFingerprint } from '../../devices/types/device-fingerprint.interface';
import { TokenPair } from '../../tokens/types/token-pair.interface';
import { TokensService } from '../../tokens/services/tokens.service';
import { PhoneVerificationService } from '../../phone-verification/services/phone-verification/phone-verification.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { VerificationPurpose } from '../../phone-verification/types/verification-purpose.type';
import { DeviceInfo } from '../interfaces/device-info.interface';
import { USER_REGISTERED_PATTERN } from '../../../shared/events';
import { SignalKeyStorageService } from '../../signal/services/signal-key-storage.service';
import { RedisStreamProducer } from '../../../shared/redis';

const STREAM_USER_REGISTERED = `stream:${USER_REGISTERED_PATTERN}`;

@Injectable()
export class PhoneAuthenticationService {
	private readonly logger = new Logger(PhoneAuthenticationService.name);

	constructor(
		private readonly deviceRegistrationService: DeviceRegistrationService,
		private readonly deviceActivityService: DeviceActivityService,
		private readonly phoneVerificationService: PhoneVerificationService,
		private readonly tokenService: TokensService,
		private readonly userAuthService: UserAuthService,
		private readonly signalKeyStorageService: SignalKeyStorageService,
		private readonly streamProducer: RedisStreamProducer
	) {}

	private getWrongPurposeMessage(purpose: VerificationPurpose): string {
		return purpose === 'registration'
			? 'Invalid verification code for registration'
			: 'Invalid verification code for login';
	}

	private async verifyPhoneNumberForPurpose(
		verificationId: string,
		purpose: VerificationPurpose
	): Promise<string> {
		const verificationData = await this.phoneVerificationService.getConfirmedVerification(verificationId);

		if (verificationData.purpose !== purpose) {
			throw new BadRequestException(this.getWrongPurposeMessage(purpose));
		}

		return verificationData.phoneNumber;
	}

	private async handleDeviceRegistration(
		userId: string,
		deviceInfo: DeviceInfo,
		fingerprint: DeviceFingerprint
	): Promise<string> {
		if (deviceInfo.deviceName && deviceInfo.deviceType && deviceInfo.signalKeyBundle) {
			const device = await this.deviceRegistrationService.registerDevice({
				userId,
				deviceName: deviceInfo.deviceName,
				deviceType: deviceInfo.deviceType,
				publicKey: deviceInfo.signalKeyBundle.identityKey,
				ipAddress: fingerprint.ipAddress,
				model: deviceInfo.model,
				osVersion: deviceInfo.osVersion,
				appVersion: deviceInfo.appVersion,
				fcmToken: deviceInfo.fcmToken,
				apnsToken: deviceInfo.apnsToken,
				deviceFingerprint: deviceInfo.deviceId ?? randomUUID(),
			});

			await this.signalKeyStorageService.storeIdentityKey(
				userId,
				device.id,
				deviceInfo.signalKeyBundle.identityKey
			);
			await this.signalKeyStorageService.storeSignedPreKey(
				userId,
				device.id,
				deviceInfo.signalKeyBundle.signedPreKey
			);
			await this.signalKeyStorageService.storePreKeys(
				userId,
				device.id,
				deviceInfo.signalKeyBundle.preKeys
			);

			return device.id;
		}
		return randomUUID();
	}

	private async createAuthSession(
		user: UserAuth,
		deviceId: string,
		fingerprint: DeviceFingerprint,
		verificationId: string
	): Promise<TokenPair> {
		user.lastAuthenticatedAt = new Date();
		await this.userAuthService.saveUser(user);
		await this.phoneVerificationService.consumeVerification(verificationId);
		// WHISPR-919 : un login par OTP valide ré-autorise ce device.
		// Sans ce del, un client qui persiste le deviceId (web, mobile) reste
		// bloqué par la revocation jusqu'à l'expiration naturelle du TTL.
		await this.tokenService.clearDeviceRevocation(deviceId);
		return this.tokenService.generateTokenPair(user.id, deviceId, fingerprint);
	}

	private async validatePhoneNumberAvailability(verificationId: string): Promise<string> {
		const phoneNumber = await this.verifyPhoneNumberForPurpose(verificationId, 'registration');

		// Second check: re-verify availability at the moment of actual account creation.
		// This is intentional TOCTOU protection — another concurrent request may have registered
		// the same number between the initial OTP request (~15 min ago) and this point.
		const existingUser = await this.userAuthService.findByPhoneNumber(phoneNumber);
		if (existingUser) {
			throw new ConflictException('An account already exists with this phone number');
		}

		return phoneNumber;
	}

	private async createAndSaveUser(phoneNumber: string): Promise<UserAuth> {
		const user = this.userAuthService.createUser({
			phoneNumber,
			twoFactorEnabled: false,
			lastAuthenticatedAt: new Date(),
		});

		return this.userAuthService.saveUser(user);
	}

	public async register(dto: RegisterDto, fingerprint: DeviceFingerprint): Promise<TokenPair> {
		const phoneNumber = await this.validatePhoneNumberAvailability(dto.verificationId);
		const savedUser = await this.createAndSaveUser(phoneNumber);
		const deviceId = await this.handleDeviceRegistration(savedUser.id, dto, fingerprint);

		this.logger.log(`Emitting user.registered stream event for userId=${savedUser.id}`);
		try {
			await this.streamProducer.emit(STREAM_USER_REGISTERED, {
				userId: savedUser.id,
				phoneNumber: savedUser.phoneNumber,
				timestamp: new Date().toISOString(),
			});
			this.logger.log(`user.registered stream event emitted for userId=${savedUser.id}`);
		} catch (error) {
			if (error instanceof Error) {
				this.logger.error(
					`Failed to emit user.registered for userId=${savedUser.id}: ${error.message}`,
					error.stack
				);
			} else {
				this.logger.error(
					`Failed to emit user.registered for userId=${savedUser.id}: ${String(error)}`
				);
			}
		}

		return this.createAuthSession(savedUser, deviceId, fingerprint, dto.verificationId);
	}

	public async login(dto: LoginDto, fingerprint: DeviceFingerprint): Promise<TokenPair> {
		const phoneNumber = await this.verifyPhoneNumberForPurpose(dto.verificationId, 'login');

		const user = await this.userAuthService.findByPhoneNumber(phoneNumber);
		if (!user) {
			throw new BadRequestException('User not found');
		}

		const deviceId = await this.handleDeviceRegistration(user.id, dto, fingerprint);

		return this.createAuthSession(user, deviceId, fingerprint, dto.verificationId);
	}

	public async logout(userId: string, deviceId: string): Promise<void> {
		await this.tokenService.revokeAllTokensForDevice(deviceId);

		try {
			await this.deviceActivityService.updateLastActive(deviceId);
		} catch (error) {
			if (!(error instanceof NotFoundException)) {
				throw error;
			}
		}
	}
}

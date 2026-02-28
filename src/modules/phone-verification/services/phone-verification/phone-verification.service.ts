import {
	BadRequestException,
	ConflictException,
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { VerificationRequestDto, VerificationConfirmDto } from '../../../authentication/dto';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import * as bcrypt from 'bcrypt';
import { CacheService } from '../../../cache';
import { v4 as uuidv4 } from 'uuid';
import { FindOneOptions, Repository } from 'typeorm';
import { UserAuth } from '../../../two-factor-authentication/user-auth.entity';
import { SmsService } from '../sms/sms.service';
import { VerificationCode } from '../../types/verification-code.interface';
import { verificationPurpose } from '../../types/verification-purpose.type';
import { VerificationRequestResponse } from '../../types/verification-request-response.interface';

@Injectable()
export class PhoneVerificationService {
	private readonly logger = new Logger(PhoneVerificationService.name);
	private readonly isDemoMode = this.configService.get<string>('DEMO_MODE') === 'true';
	private readonly VERIFICATION_TTL = 15 * 60;
	private readonly MAX_ATTEMPTS = 5;
	private readonly RATE_LIMIT_TTL = 60 * 60;
	private readonly MAX_REQUESTS_PER_HOUR = 5;
	private readonly BCRYPT_ROUNDS = 10;

	constructor(
		@InjectRepository(UserAuth)
		private readonly userAuthRepository: Repository<UserAuth>,
		private readonly cacheService: CacheService,
		private readonly smsService: SmsService,
		private readonly configService: ConfigService
	) {}

	async requestVerification(
		phoneNumber: string,
		purpose: verificationPurpose
	): Promise<VerificationRequestResponse> {
		const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

		await this.checkRateLimit(normalizedPhone);

		const verificationId = uuidv4();
		const code = this.generateCode();
		const hashedCode = await bcrypt.hash(code, this.BCRYPT_ROUNDS);

		const verificationData: VerificationCode = {
			phoneNumber: normalizedPhone,
			hashedCode,
			purpose,
			attempts: 0,
			expiresAt: Date.now() + this.VERIFICATION_TTL * 1000,
		};

		await this.cacheService.set(
			`verification:${verificationId}`,
			verificationData,
			this.VERIFICATION_TTL
		);

		await this.incrementRateLimit(normalizedPhone);

		// Send SMS in production, log in development
		try {
			await this.smsService.sendVerificationCode(normalizedPhone, code, purpose);
		} catch (error) {
			// If SMS fails, still return the verification ID but log the error
			console.error('Failed to send SMS:', error);
			console.log(`Verification code for ${normalizedPhone}: ${code}`);
		}

		if (this.isDemoMode) {
			this.logger.debug('Demo mode is activated: sending verification code in response payload.');
			return { verificationId, code };
		}

		return { verificationId };
	}

	async verifyCode(verificationId: string, code: string): Promise<VerificationCode> {
		const key = `verification:${verificationId}`;
		const verificationData = await this.cacheService.get<VerificationCode>(key);

		if (!verificationData) {
			throw new BadRequestException('Code de vérification invalide ou expiré');
		}

		// Si déjà vérifié et aucun code fourni, retourner les données
		if (verificationData.verified && code === '') {
			return verificationData;
		}

		if (verificationData.attempts >= this.MAX_ATTEMPTS) {
			await this.cacheService.del(key);
			throw new HttpException('Trop de tentatives de vérification', HttpStatus.TOO_MANY_REQUESTS);
		}

		const isValid = await bcrypt.compare(code, verificationData.hashedCode);

		if (!isValid) {
			verificationData.attempts++;
			await this.cacheService.set(
				key,
				verificationData,
				Math.ceil((verificationData.expiresAt - Date.now()) / 1000)
			);
			throw new BadRequestException('Code de vérification incorrect');
		}

		return verificationData;
	}

	async consumeVerification(verificationId: string): Promise<void> {
		await this.cacheService.del(`verification:${verificationId}`);
	}

	private generateCode(): string {
		return Math.floor(100000 + Math.random() * 900000).toString();
	}

	private normalizePhoneNumber(phoneNumber: string): string {
		try {
			const parsed = parsePhoneNumberWithError(phoneNumber);
			if (!parsed || !parsed.isValid()) {
				throw new BadRequestException('Numéro de téléphone invalide');
			}
			return parsed.format('E.164');
		} catch {
			throw new BadRequestException('Numéro de téléphone invalide');
		}
	}

	private async checkRateLimit(phoneNumber: string): Promise<void> {
		const key = `rate_limit:${phoneNumber}`;
		const count = await this.cacheService.get<number>(key);

		if (count && count >= this.MAX_REQUESTS_PER_HOUR) {
			throw new HttpException(
				'Trop de demandes de codes de vérification',
				HttpStatus.TOO_MANY_REQUESTS
			);
		}
	}

	private async incrementRateLimit(phoneNumber: string): Promise<void> {
		const key = `rate_limit:${phoneNumber}`;
		let current = (await this.cacheService.get<number>(key)) || 0;
		current++;

		await this.cacheService.set(key, current, this.RATE_LIMIT_TTL);
	}

	async requestRegistrationVerification(dto: VerificationRequestDto): Promise<VerificationRequestResponse> {
		const filter: FindOneOptions<UserAuth> = { where: { phoneNumber: dto.phoneNumber } };
		const existingUser = await this.userAuthRepository.findOne(filter);

		if (existingUser) {
			throw new ConflictException('An account with this phone number already exists.');
		}

		const result = await this.requestVerification(dto.phoneNumber, 'registration');

		return result;
	}

	async confirmRegistrationVerification(dto: VerificationConfirmDto): Promise<{ verified: boolean }> {
		const verificationData = await this.verifyCode(dto.verificationId, dto.code);

		// Marquer la vérification comme confirmée dans le cache
		verificationData.verified = true;
		const key = `verification:${dto.verificationId}`;
		await this.cacheService.set(
			key,
			verificationData,
			Math.ceil((verificationData.expiresAt - Date.now()) / 1000)
		);

		return { verified: true };
	}

	async requestLoginVerification(
		dto: VerificationRequestDto
	): Promise<{ verificationId: string; code?: string }> {
		const user = await this.userAuthRepository.findOne({
			where: { phoneNumber: dto.phoneNumber },
		});

		if (!user) {
			throw new BadRequestException('Aucun compte trouvé avec ce numéro de téléphone');
		}

		const result = await this.requestVerification(dto.phoneNumber, 'login');

		return result;
	}

	async confirmLoginVerification(
		dto: VerificationConfirmDto
	): Promise<{ verified: boolean; requires2FA: boolean }> {
		const verificationData = await this.verifyCode(dto.verificationId, dto.code);

		// Marquer la vérification comme confirmée dans le cache
		verificationData.verified = true;
		const key = `verification:${dto.verificationId}`;
		await this.cacheService.set(
			key,
			verificationData,
			Math.ceil((verificationData.expiresAt - Date.now()) / 1000)
		);

		const user = await this.userAuthRepository.findOne({
			where: { phoneNumber: verificationData.phoneNumber },
		});

		if (!user) {
			throw new BadRequestException('Utilisateur non trouvé');
		}

		return {
			verified: true,
			requires2FA: user.twoFactorEnabled,
		};
	}
}

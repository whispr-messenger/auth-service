import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserAuthService } from '../../common/services/user-auth.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { BackupCodesService } from '../backup-codes/backup-codes.service';

interface TwoFactorSetup {
	secret: string;
	otpauthUri: string;
	qrCodeUrl: string;
}

@Injectable()
export class TwoFactorAuthenticationService {
	constructor(
		private readonly userAuthService: UserAuthService,
		private readonly backupCodesService: BackupCodesService
	) {}

	async setupTwoFactor(userId: string): Promise<TwoFactorSetup> {
		const user = await this.userAuthService.findById(userId);

		if (!user) {
			throw new BadRequestException('User not found');
		}

		if (user.twoFactorEnabled) {
			throw new BadRequestException('Two-factor authentication is already enabled');
		}

		let secretBase32: string;
		let otpauthUrl: string;

		if (user.twoFactorPendingSecret) {
			secretBase32 = user.twoFactorPendingSecret;
			otpauthUrl = speakeasy.otpauthURL({
				secret: secretBase32,
				label: 'Whispr',
				issuer: 'Whispr',
				encoding: 'base32',
			});
		} else {
			const secret = speakeasy.generateSecret({ length: 32 });
			secretBase32 = secret.base32;
			otpauthUrl = speakeasy.otpauthURL({
				secret: secretBase32,
				label: 'Whispr',
				issuer: 'Whispr',
				encoding: 'base32',
			});
			user.twoFactorPendingSecret = secretBase32;
			await this.userAuthService.saveUser(user);
		}

		const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

		return { secret: secretBase32, otpauthUri: otpauthUrl, qrCodeUrl };
	}

	async enableTwoFactor(userId: string, token: string): Promise<string[]> {
		const user = await this.userAuthService.findById(userId);
		if (!user) {
			throw new BadRequestException('User not found');
		}

		if (!user.twoFactorPendingSecret) {
			throw new BadRequestException('2FA setup not initiated');
		}

		const isValid = speakeasy.totp.verify({
			secret: user.twoFactorPendingSecret,
			encoding: 'base32',
			token,
			window: 2,
		});

		if (!isValid) {
			throw new BadRequestException('Invalid verification code');
		}

		user.twoFactorSecret = user.twoFactorPendingSecret;
		user.twoFactorPendingSecret = null;
		user.twoFactorEnabled = true;

		await this.userAuthService.saveUser(user);

		return this.backupCodesService.generateBackupCodes(userId);
	}

	async verifyTwoFactor(userId: string, token: string): Promise<boolean> {
		const user = await this.userAuthService.findById(userId);

		if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
			throw new BadRequestException('Two-factor authentication is not configured');
		}

		const isValidTOTP = speakeasy.totp.verify({
			secret: user.twoFactorSecret,
			encoding: 'base32',
			token,
			window: 2,
		});

		if (isValidTOTP) {
			return true;
		}

		return this.backupCodesService.verifyBackupCode(userId, token);
	}

	async disableTwoFactor(userId: string, token: string): Promise<void> {
		const user = await this.userAuthService.findById(userId);

		if (!user) {
			throw new BadRequestException('User not found');
		}

		if (!user.twoFactorEnabled) {
			throw new BadRequestException('Two-factor authentication is not enabled');
		}

		const isValid = await this.verifyTwoFactor(userId, token);

		if (!isValid) {
			throw new UnauthorizedException('Invalid verification code');
		}

		user.twoFactorSecret = '';
		user.twoFactorEnabled = false;

		await this.backupCodesService.deleteAllBackupCodes(userId);
		await this.userAuthService.saveUser(user);
	}

	async generateNewBackupCodes(userId: string, token: string): Promise<string[]> {
		const user = await this.userAuthService.findById(userId);

		if (!user || !user.twoFactorEnabled) {
			throw new BadRequestException('Two-factor authentication is not configured');
		}

		const isValid = await this.verifyTwoFactor(userId, token);

		if (!isValid) {
			throw new UnauthorizedException('Invalid verification code');
		}

		return this.backupCodesService.generateBackupCodes(userId);
	}

	async isTwoFactorEnabled(userId: string): Promise<boolean> {
		const user = await this.userAuthService.findById(userId);
		return user?.twoFactorEnabled || false;
	}
}

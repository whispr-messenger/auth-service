import {
	Injectable,
	BadRequestException,
	UnauthorizedException,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { UserAuthService } from '../../common/services/user-auth.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { BackupCodesService } from '../backup-codes/backup-codes.service';
import { CacheService } from '../../cache/cache.service';

interface TwoFactorSetup {
	secret: string;
	otpauthUri: string;
	qrCodeUrl: string;
}

// WHISPR-1319: rate limit per-user sur POST /2fa/verify pour bloquer le bruteforce
// (sans cap, ~1800 tentatives/h sont possibles avec un JWT valide).
const VERIFY_ATTEMPTS_LIMIT = 5;
const VERIFY_ATTEMPTS_TTL_SECONDS = 15 * 60; // 15 minutes
// fenetre TOTP = 90s (window: 2 cote speakeasy = +/- 60s + step 30s).
// Garder la trace du code utilise un peu plus longtemps que la fenetre suffit.
const TOTP_REPLAY_TTL_SECONDS = 90;

@Injectable()
export class TwoFactorAuthenticationService {
	constructor(
		private readonly userAuthService: UserAuthService,
		private readonly backupCodesService: BackupCodesService,
		private readonly cacheService: CacheService
	) {}

	private buildAttemptsKey(userId: string): string {
		return `attempts:2fa:verify:${userId}`;
	}

	private async assertVerifyRateLimit(userId: string): Promise<void> {
		const key = this.buildAttemptsKey(userId);
		const current = await this.cacheService.get<number | string>(key);
		const count = current ? Number.parseInt(String(current), 10) : 0;
		if (Number.isFinite(count) && count >= VERIFY_ATTEMPTS_LIMIT) {
			throw new HttpException(
				'Trop de tentatives, réessayez dans 15 minutes',
				HttpStatus.TOO_MANY_REQUESTS
			);
		}
	}

	private async incrementVerifyAttempts(userId: string): Promise<void> {
		const key = this.buildAttemptsKey(userId);
		const value = await this.cacheService.incr(key);
		if (value === 1) {
			await this.cacheService.expire(key, VERIFY_ATTEMPTS_TTL_SECONDS);
		}
	}

	private async resetVerifyAttempts(userId: string): Promise<void> {
		await this.cacheService.del(this.buildAttemptsKey(userId));
	}

	private buildReplayKey(userId: string, code: string): string {
		// hash sha256 pour ne pas stocker le code TOTP en clair dans Redis,
		// meme si la TTL est courte. userId prefixe sert de salt par-user.
		const digest = createHash('sha256').update(`${userId}:${code}`).digest('hex');
		return `2fa:replay:${userId}:${digest}`;
	}

	private async assertTotpNotReplayed(userId: string, code: string): Promise<void> {
		const exists = await this.cacheService.exists(this.buildReplayKey(userId, code));
		if (exists) {
			throw new BadRequestException('Verification code already used');
		}
	}

	private async markTotpAsUsed(userId: string, code: string): Promise<void> {
		await this.cacheService.set(this.buildReplayKey(userId, code), '1', TOTP_REPLAY_TTL_SECONDS);
	}

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

		// WHISPR-1319: rate limit per-user — bloque le bruteforce TOTP.
		// Le check se fait AVANT la verif speakeasy pour ne pas valider de code
		// quand la limite est atteinte.
		await this.assertVerifyRateLimit(userId);

		// WHISPR-1319: anti-replay — un meme code TOTP valide ne peut etre rejoue
		// dans sa fenetre de validite (90s). Protege contre l'usage d'un code
		// intercepte (ex. shoulder surfing, MITM transitoire).
		await this.assertTotpNotReplayed(userId, token);

		const isValidTOTP = speakeasy.totp.verify({
			secret: user.twoFactorSecret,
			encoding: 'base32',
			token,
			window: 2,
		});

		if (isValidTOTP) {
			await this.markTotpAsUsed(userId, token);
			await this.resetVerifyAttempts(userId);
			return true;
		}

		const isValidBackup = await this.backupCodesService.verifyBackupCode(userId, token);
		if (isValidBackup) {
			await this.resetVerifyAttempts(userId);
			return true;
		}

		await this.incrementVerifyAttempts(userId);
		return false;
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
		return user?.twoFactorEnabled ?? false;
	}

	// WHISPR-1052: nombre de codes de secours non consommés, exposé par
	// GET /2fa/backup-codes/remaining pour que l'UI Settings alerte quand il
	// ne reste presque plus de codes.
	async getRemainingBackupCodesCount(userId: string): Promise<number> {
		const user = await this.userAuthService.findById(userId);
		if (!user?.twoFactorEnabled) {
			return 0;
		}
		return this.backupCodesService.getRemainingCodesCount(userId);
	}
}

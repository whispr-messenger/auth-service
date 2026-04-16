import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'node:crypto';
import { DeviceFingerprint } from '../../devices/types/device-fingerprint.interface';
import { TokenPair } from '../types/token-pair.interface';
import { JwtPayload } from '../types/jwt-payload.interface';
import { CacheService } from '../../cache/cache.service';
import { JwksService } from '../../jwks/jwks.service';

@Injectable()
export class TokensService {
	private readonly ACCESS_TOKEN_TTL = 60 * 60;
	private readonly REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;
	/**
	 * TTL des clés de revocation (WHISPR-919).
	 * Doit être supérieur au TTL maximum d'un refresh token pour garantir
	 * qu'un access token signé avec ce device ne puisse jamais bypasser
	 * la revocation. Au-delà, la clé devient inutile et doit expirer
	 * automatiquement pour que Redis ne grandisse pas indéfiniment et
	 * qu'une reconnexion légitime ne soit pas bloquée ad vitam.
	 */
	private readonly REVOCATION_TTL = this.REFRESH_TOKEN_TTL + 24 * 60 * 60;

	constructor(
		private readonly jwtService: JwtService,
		private readonly cacheService: CacheService,
		private readonly jwksService: JwksService
	) {}

	async generateTokenPair(
		userId: string,
		deviceId: string,
		fingerprint: DeviceFingerprint
	): Promise<TokenPair> {
		const deviceFingerprint = this.generateDeviceFingerprint(fingerprint);
		const accessTokenId = uuidv4();
		const refreshTokenId = uuidv4();

		const accessTokenPayload: JwtPayload = {
			sub: userId,
			jti: accessTokenId,
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + this.ACCESS_TOKEN_TTL,
			deviceId,
			scope: 'user',
			fingerprint: deviceFingerprint,
		};

		const refreshTokenPayload = {
			sub: userId,
			deviceId,
			tokenId: refreshTokenId,
			type: 'refresh',
			iat: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + this.REFRESH_TOKEN_TTL,
		};

		const kid = this.jwksService.getKid();

		const accessToken = this.jwtService.sign(accessTokenPayload, {
			algorithm: 'ES256',
			keyid: kid,
		});

		const refreshToken = this.jwtService.sign(refreshTokenPayload, {
			algorithm: 'ES256',
			keyid: kid,
		});

		await this.cacheService.set(
			`refresh_token:${refreshTokenId}`,
			{ userId, deviceId, fingerprint: deviceFingerprint },
			this.REFRESH_TOKEN_TTL
		);

		return { accessToken, refreshToken, userId, deviceId };
	}

	async refreshAccessToken(refreshToken: string, fingerprint: DeviceFingerprint): Promise<TokenPair> {
		try {
			const decoded = this.jwtService.verify(refreshToken, {
				algorithms: ['ES256'],
			});

			if (decoded.type !== 'refresh') {
				throw new UnauthorizedException('ERROR_INVALID_REFRESH_TOKEN');
			}

			const storedData = await this.cacheService.get<{
				userId: string;
				deviceId: string;
				fingerprint: string;
			}>(`refresh_token:${decoded.tokenId}`);
			if (!storedData) {
				throw new UnauthorizedException('ERROR_REFRESH_TOKEN_EXPIRED_OR_REVOKED');
			}

			const currentFingerprint = this.generateDeviceFingerprint(fingerprint);

			if (storedData.fingerprint !== currentFingerprint) {
				await this.revokeRefreshToken(decoded.tokenId);
				throw new UnauthorizedException('ERROR_DEVICE_FINGERPRINT_MISMATCH');
			}

			await this.revokeRefreshToken(decoded.tokenId);

			return this.generateTokenPair(storedData.userId, storedData.deviceId, fingerprint);
		} catch (error) {
			if (error instanceof UnauthorizedException) {
				throw error;
			}
			throw new UnauthorizedException('ERROR_INVALID_REFRESH_TOKEN');
		}
	}

	async revokeToken(token: string): Promise<void> {
		try {
			const decoded = this.jwtService.verify(token, { algorithms: ['ES256'] }) as any;
			const tokenId = decoded?.jti ?? decoded?.tokenId;
			if (decoded && tokenId) {
				await this.cacheService.set(
					`revoked:${tokenId}`,
					{ revokedAt: Date.now() },
					decoded.exp - Math.floor(Date.now() / 1000)
				);
			}
		} catch {
			// invalid or expired token — nothing to revoke
		}
	}

	async revokeRefreshToken(tokenId: string): Promise<void> {
		await this.cacheService.del(`refresh_token:${tokenId}`);
	}

	async revokeAllTokensForDevice(deviceId: string): Promise<void> {
		await this.cacheService.set(`revoked_device:${deviceId}`, 'true', this.REVOCATION_TTL);
	}

	/**
	 * Supprime la revocation d'un device (WHISPR-919).
	 *
	 * À appeler après un login par SMS code réussi : la possession d'un
	 * OTP valide prouve l'autorisation du propriétaire du numéro, il est
	 * donc cohérent de ré-autoriser ce device au lieu de le laisser
	 * bloqué jusqu'à l'expiration naturelle du TTL.
	 *
	 * Sans ce mécanisme, un logout suivi d'un login avec le même deviceId
	 * (cas du client web qui persiste le deviceId dans le localStorage)
	 * retourne un access token immédiatement rejeté par `JwtAuthGuard`.
	 */
	async clearDeviceRevocation(deviceId: string): Promise<void> {
		await this.cacheService.del(`revoked_device:${deviceId}`);
	}

	async isTokenRevoked(tokenId: string): Promise<boolean> {
		const revoked = await this.cacheService.get<string>(`revoked:${tokenId}`);
		return !!revoked;
	}

	async isDeviceRevoked(deviceId: string): Promise<boolean> {
		const revoked = await this.cacheService.get<string>(`revoked_device:${deviceId}`);
		return !!revoked;
	}

	validateToken(token: string): JwtPayload {
		try {
			return this.jwtService.verify(token, { algorithms: ['ES256'] });
		} catch {
			throw new UnauthorizedException('ERROR_INVALID_TOKEN');
		}
	}

	private generateDeviceFingerprint(fingerprint: DeviceFingerprint): string {
		const data = `${fingerprint.userAgent || ''}:${fingerprint.ipAddress || ''}:${fingerprint.deviceType || ''}`;
		return crypto.createHash('sha256').update(data).digest('hex').substring(0, 12);
	}
}

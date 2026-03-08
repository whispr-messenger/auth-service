import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'node:crypto';
import { DeviceFingerprint } from '../../devices/types/device-fingerprint.interface';
import { TokenPair } from '../types/token-pair.interface';
import { JwtPayload } from '../types/jwt-payload.interface';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class TokensService {
	private readonly ACCESS_TOKEN_TTL = 60 * 60;
	private readonly REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;

	constructor(
		private readonly jwtService: JwtService,
		private readonly cacheService: CacheService
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

		const accessToken = this.jwtService.sign(accessTokenPayload, {
			algorithm: 'ES256',
			expiresIn: this.ACCESS_TOKEN_TTL,
		});

		const refreshToken = this.jwtService.sign(refreshTokenPayload, {
			algorithm: 'ES256',
			expiresIn: this.REFRESH_TOKEN_TTL,
		});

		await this.cacheService.set(
			`refresh_token:${refreshTokenId}`,
			{ userId, deviceId, fingerprint: deviceFingerprint },
			this.REFRESH_TOKEN_TTL
		);

		return { accessToken, refreshToken };
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
		await this.cacheService.set(`revoked_device:${deviceId}`, 'true', this.REFRESH_TOKEN_TTL);
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

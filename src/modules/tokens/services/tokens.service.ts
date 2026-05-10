import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
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
	// cap absolu pour eviter session zombie sur refresh token vole : meme
	// si l'utilisateur reste actif, on borne la duree totale d'une session
	// a partir du login initial (firstIssuedAt) — au-dela, re-auth obligatoire.
	private readonly ABSOLUTE_SESSION_CAP_MS = 90 * 24 * 60 * 60 * 1000;
	// Court-vivant — WHISPR-1214. Le token transite dans la query string
	// Phoenix Channels, donc reverse-proxies, HAR exports et Sentry
	// breadcrumbs le capturent ; 60 s borne le préjudice d'une fuite.
	private readonly WS_TOKEN_TTL = 60;
	private static readonly WS_TOKEN_AUDIENCE = 'ws';
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
		fingerprint: DeviceFingerprint,
		firstIssuedAt?: number
	): Promise<TokenPair> {
		const deviceFingerprint = this.generateDeviceFingerprint(fingerprint);
		const accessTokenId = uuidv4();
		const refreshTokenId = uuidv4();
		// firstIssuedAt = timestamp du login initial (ms epoch). Propage au refresh
		// pour enforcer le cap absolu independamment du nombre de refresh.
		const sessionFirstIssuedAt = firstIssuedAt ?? Date.now();

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
			firstIssuedAt: sessionFirstIssuedAt,
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
			{ userId, deviceId, fingerprint: deviceFingerprint, firstIssuedAt: sessionFirstIssuedAt },
			this.REFRESH_TOKEN_TTL
		);

		return { accessToken, refreshToken, userId, deviceId };
	}

	generateWsToken(userId: string, deviceId: string): { wsToken: string; expiresIn: number } {
		const now = Math.floor(Date.now() / 1000);
		// aud passe en option pour overrider la valeur globale (HTTP) avec "ws"
		// — sans collision avec le payload (WHISPR-1236). iss n'est PAS overridé :
		// messaging-service valide iss strict contre la même valeur que pour
		// les access tokens HTTP, donc on laisse jwtModuleOptionsFactory injecter
		// JWT_ISSUER (WHISPR-1249).
		const payload = {
			sub: userId,
			deviceId,
			iat: now,
			exp: now + this.WS_TOKEN_TTL,
		};

		const wsToken = this.jwtService.sign(payload, {
			algorithm: 'ES256',
			keyid: this.jwksService.getKid(),
			audience: TokensService.WS_TOKEN_AUDIENCE,
		});

		return { wsToken, expiresIn: this.WS_TOKEN_TTL };
	}

	async refreshAccessToken(refreshToken: string, fingerprint: DeviceFingerprint): Promise<TokenPair> {
		try {
			const decoded = this.jwtService.verify(refreshToken, {
				algorithms: ['ES256'],
			});

			if (decoded.type !== 'refresh') {
				throw new UnauthorizedException('ERROR_INVALID_REFRESH_TOKEN');
			}

			let storedData: {
				userId: string;
				deviceId: string;
				fingerprint: string;
				firstIssuedAt?: number;
			} | null;
			try {
				storedData = await this.cacheService.getReliable<{
					userId: string;
					deviceId: string;
					fingerprint: string;
					firstIssuedAt?: number;
				}>(`refresh_token:${decoded.tokenId}`);
			} catch {
				// Redis indisponible : ne pas confondre avec une révocation. Sinon
				// une panne réseau ou un failover Sentinel déconnecte tout le fleet.
				throw new ServiceUnavailableException('ERROR_REDIS_UNAVAILABLE');
			}
			if (!storedData) {
				throw new UnauthorizedException('ERROR_REFRESH_TOKEN_EXPIRED_OR_REVOKED');
			}

			const currentFingerprint = this.generateDeviceFingerprint(fingerprint);

			if (storedData.fingerprint !== currentFingerprint) {
				await this.revokeRefreshToken(decoded.tokenId);
				throw new UnauthorizedException('ERROR_DEVICE_FINGERPRINT_MISMATCH');
			}

			// cap absolu : on prefere la valeur du claim signe (immuable cote client)
			// puis fallback sur le stored data ; backward compat = sessions sans
			// firstIssuedAt sont seedees a Date.now() au prochain refresh (pas hard-fail).
			const sessionFirstIssuedAt: number =
				typeof decoded.firstIssuedAt === 'number'
					? decoded.firstIssuedAt
					: (storedData.firstIssuedAt ?? Date.now());

			if (Date.now() - sessionFirstIssuedAt > this.ABSOLUTE_SESSION_CAP_MS) {
				await this.revokeRefreshToken(decoded.tokenId);
				throw new UnauthorizedException('ERROR_SESSION_EXPIRED_ABSOLUTE');
			}

			await this.revokeRefreshToken(decoded.tokenId);

			return this.generateTokenPair(
				storedData.userId,
				storedData.deviceId,
				fingerprint,
				sessionFirstIssuedAt
			);
		} catch (error) {
			if (error instanceof UnauthorizedException) {
				throw error;
			}
			if (error instanceof ServiceUnavailableException) {
				throw error;
			}
			throw new UnauthorizedException('ERROR_INVALID_REFRESH_TOKEN');
		}
	}

	async revokeToken(token: string): Promise<void> {
		try {
			const decoded: { jti?: string; tokenId?: string; exp: number } = this.jwtService.verify(token, {
				algorithms: ['ES256'],
			});
			const tokenId = decoded.jti ?? decoded.tokenId;
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
		// Fingerprint stable entre login et refresh : uniquement userAgent.
		// IP exclue (roaming mobile wifi/4G), deviceType exclu (incohérent
		// entre body au login et header au refresh, et redondant avec UA).
		const data = fingerprint.userAgent || '';
		return crypto.createHash('sha256').update(data).digest('hex').substring(0, 12);
	}
}

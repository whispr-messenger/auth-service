import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

import { TokensService } from './tokens.service';
import { CacheService } from '../../cache';
import { DeviceFingerprint } from '../../devices/types/device-fingerprint.interface';
import { JwksService } from '../../jwks/jwks.service';

describe('TokensService', () => {
	let service: TokensService;
	let jwtService: jest.Mocked<JwtService>;
	let cacheService: jest.Mocked<CacheService>;
	let configService: jest.Mocked<ConfigService>;

	const mockFingerprint: DeviceFingerprint = {
		userAgent: 'Mozilla/5.0',
		ipAddress: '127.0.0.1',
		deviceType: 'mobile',
		timestamp: Date.now(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TokensService,
				{
					provide: JwtService,
					useValue: {
						sign: jest.fn(),
						verify: jest.fn(),
						decode: jest.fn(),
					},
				},
				{
					provide: ConfigService,
					useValue: {
						get: jest.fn(),
					},
				},
				{
					provide: CacheService,
					useValue: {
						get: jest.fn(),
						set: jest.fn(),
						del: jest.fn(),
					},
				},
				{
					provide: JwksService,
					useValue: {
						getKid: jest.fn().mockReturnValue('test-kid'),
					},
				},
			],
		}).compile();

		service = module.get<TokensService>(TokensService);
		jwtService = module.get(JwtService);
		cacheService = module.get(CacheService);
		configService = module.get(ConfigService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('generateDeviceFingerprint', () => {
		it('should produce the same fingerprint for the same device regardless of timestamp', () => {
			const fp1: DeviceFingerprint = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
				deviceType: 'mobile',
				timestamp: Date.now(),
			};
			const fp2: DeviceFingerprint = { ...fp1, timestamp: fp1.timestamp + 60_000 };

			const hash1 = (service as any).generateDeviceFingerprint(fp1);
			const hash2 = (service as any).generateDeviceFingerprint(fp2);

			expect(hash1).toBe(hash2);
		});

		// WHISPR-921 : le fingerprint doit rester stable entre login et refresh,
		// même si l'IP change (roaming mobile) ou si deviceType diffère
		// (body au login vs header x-device-type au refresh).
		it('should remain stable when ipAddress or deviceType change (WHISPR-921)', () => {
			const base: DeviceFingerprint = {
				userAgent: 'Expo/1017756 CFNetwork/3860.400.51 Darwin/25.3.0',
				ipAddress: '10.0.0.1',
				deviceType: 'mobile',
				timestamp: Date.now(),
			};
			const ipChanged: DeviceFingerprint = { ...base, ipAddress: '192.168.1.1' };
			const typeMissing: DeviceFingerprint = { ...base, deviceType: 'unknown' };

			const baseHash = (service as any).generateDeviceFingerprint(base);
			expect((service as any).generateDeviceFingerprint(ipChanged)).toBe(baseHash);
			expect((service as any).generateDeviceFingerprint(typeMissing)).toBe(baseHash);
		});

		it('should still differ when userAgent differs (WHISPR-921)', () => {
			const fpA: DeviceFingerprint = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '10.0.0.1',
				deviceType: 'mobile',
				timestamp: Date.now(),
			};
			const fpB: DeviceFingerprint = { ...fpA, userAgent: 'Chrome/147.0' };

			expect((service as any).generateDeviceFingerprint(fpA)).not.toBe(
				(service as any).generateDeviceFingerprint(fpB)
			);
		});
	});

	describe('generateTokenPair', () => {
		it('should generate token pair successfully', async () => {
			const userId = 'user-id';
			const deviceId = 'device-id';
			const accessToken = 'access-token';
			const refreshToken = 'refresh-token';

			jwtService.sign.mockReturnValueOnce(accessToken).mockReturnValueOnce(refreshToken);
			cacheService.set.mockResolvedValue(undefined);

			const result = await service.generateTokenPair(userId, deviceId, mockFingerprint);

			expect(jwtService.sign).toHaveBeenCalledTimes(2);
			expect(cacheService.set).toHaveBeenCalled();
			expect(result).toEqual({
				accessToken,
				refreshToken,
				userId,
				deviceId,
			});
		});

		it('should include a jti claim in the access token payload', async () => {
			jwtService.sign.mockReturnValue('any-token');
			cacheService.set.mockResolvedValue(undefined);

			await service.generateTokenPair('user-id', 'device-id', mockFingerprint);

			const accessPayload = jwtService.sign.mock.calls[0][0] as any;
			expect(accessPayload).toHaveProperty('jti');
			expect(typeof accessPayload.jti).toBe('string');
			expect(accessPayload.jti).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
			);
		});

		it('should sign tokens without expiresIn option since exp is already in the payload', async () => {
			jwtService.sign.mockReturnValue('any-token');
			cacheService.set.mockResolvedValue(undefined);

			await service.generateTokenPair('user-id', 'device-id', mockFingerprint);

			for (const [, options] of jwtService.sign.mock.calls) {
				expect(options).not.toHaveProperty('expiresIn');
			}
		});

		it('should use a different jti for each generated token pair', async () => {
			jwtService.sign.mockReturnValue('any-token');
			cacheService.set.mockResolvedValue(undefined);

			await service.generateTokenPair('user-id', 'device-id', mockFingerprint);
			await service.generateTokenPair('user-id', 'device-id', mockFingerprint);

			const firstJti = (jwtService.sign.mock.calls[0][0] as any).jti;
			const secondJti = (jwtService.sign.mock.calls[2][0] as any).jti;
			expect(firstJti).not.toBe(secondJti);
		});
	});

	describe('generateWsToken', () => {
		it('returns a signed token and the 60s lifetime', () => {
			jwtService.sign.mockReturnValue('ws-jwt');

			const result = service.generateWsToken('user-id', 'device-id');

			expect(result).toEqual({ wsToken: 'ws-jwt', expiresIn: 60 });
			expect(jwtService.sign).toHaveBeenCalledTimes(1);
		});

		it('puts sub and deviceId in the payload', () => {
			jwtService.sign.mockReturnValue('ws-jwt');

			service.generateWsToken('user-id', 'device-id');

			const [payload] = jwtService.sign.mock.calls[0];
			expect(payload).toMatchObject({
				sub: 'user-id',
				deviceId: 'device-id',
			});
		});

		// WHISPR-1236 : aud DOIT être passé en option de sign() et NON dans le
		// payload. La lib jsonwebtoken throw "Bad options.audience option" si
		// les deux coexistent, ce qui se produit dès que JWT_AUDIENCE est
		// défini globalement (preprod, prod, e2e).
		// WHISPR-1249 : iss n'est PAS overridé — la valeur globale JWT_ISSUER
		// (injectée par jwtModuleOptionsFactory) doit s'appliquer pour que le
		// ws-token partage le même iss que les access tokens HTTP, sinon
		// messaging-service rejette le handshake.
		it('passes aud=ws via sign options and does NOT override issuer', () => {
			jwtService.sign.mockReturnValue('ws-jwt');

			service.generateWsToken('user-id', 'device-id');

			const [payload, options] = jwtService.sign.mock.calls[0];
			expect(payload).not.toHaveProperty('aud');
			expect(payload).not.toHaveProperty('iss');
			expect(options).toMatchObject({ audience: 'ws' });
			expect(options).not.toHaveProperty('issuer');
		});

		// WHISPR-1236 : test de régression. Reproduit le throw réel de
		// jsonwebtoken quand payload.aud et options.audience coexistent —
		// si quelqu'un réintroduit aud dans le payload, ce test casse.
		it('does not trigger the jsonwebtoken aud-conflict error', () => {
			jwtService.sign.mockImplementation((payload: any, options: any) => {
				if (
					payload &&
					Object.prototype.hasOwnProperty.call(payload, 'aud') &&
					options &&
					options.audience !== undefined
				) {
					throw new Error(
						'Bad "options.audience" option. The payload already has an "aud" property.'
					);
				}
				return 'ws-jwt';
			});

			expect(() => service.generateWsToken('user-id', 'device-id')).not.toThrow();
		});

		it('sets exp to iat + 60s', () => {
			jwtService.sign.mockReturnValue('ws-jwt');
			const before = Math.floor(Date.now() / 1000);

			service.generateWsToken('user-id', 'device-id');

			const [payload] = jwtService.sign.mock.calls[0] as [{ iat: number; exp: number }];
			expect(payload.exp - payload.iat).toBe(60);
			expect(payload.iat).toBeGreaterThanOrEqual(before);
		});

		it('uses ES256 + the JWKS-published kid (so messaging-service can verify)', () => {
			jwtService.sign.mockReturnValue('ws-jwt');

			service.generateWsToken('user-id', 'device-id');

			const [, options] = jwtService.sign.mock.calls[0];
			expect(options).toMatchObject({ algorithm: 'ES256', keyid: 'test-kid' });
		});
	});

	describe('refreshAccessToken', () => {
		it('should refresh tokens successfully', async () => {
			const refreshToken = 'valid-refresh-token';
			const userId = 'user-id';
			const deviceId = 'device-id';
			const tokenId = 'token-id';
			const newAccessToken = 'new-access-token';
			const newRefreshToken = 'new-refresh-token';

			const decodedToken = {
				sub: userId,
				deviceId,
				tokenId: tokenId,
				type: 'refresh',
			};

			// Mock generateDeviceFingerprint to return consistent value
			const expectedFingerprint = 'b8c5a8c8e1f2';
			jest.spyOn(service as any, 'generateDeviceFingerprint').mockReturnValue(expectedFingerprint);

			const cachedData = {
				userId,
				deviceId,
				fingerprint: expectedFingerprint,
			};

			jwtService.verify.mockReturnValue(decodedToken);
			cacheService.get.mockResolvedValue(cachedData);
			jwtService.sign.mockReturnValueOnce(newAccessToken).mockReturnValueOnce(newRefreshToken);
			cacheService.del.mockResolvedValue(undefined);
			cacheService.set.mockResolvedValue(undefined);
			configService.get.mockReturnValue('test-secret');

			const result = await service.refreshAccessToken(refreshToken, mockFingerprint);

			expect(jwtService.verify).toHaveBeenCalledWith(refreshToken, {
				algorithms: ['ES256'],
			});
			expect(cacheService.get).toHaveBeenCalledWith(`refresh_token:${tokenId}`);
			expect(result).toEqual({
				accessToken: newAccessToken,
				refreshToken: newRefreshToken,
				userId,
				deviceId,
			});
		});

		it('should throw UnauthorizedException with invalid refresh token', async () => {
			const invalidRefreshToken = 'invalid-refresh-token';

			jwtService.verify.mockImplementation(() => {
				throw new Error('Invalid token');
			});

			await expect(service.refreshAccessToken(invalidRefreshToken, mockFingerprint)).rejects.toThrow(
				UnauthorizedException
			);
		});

		it('should throw UnauthorizedException if token not found in cache', async () => {
			const refreshToken = 'valid-refresh-token';
			const tokenId = 'token-id';

			const decodedToken = {
				sub: 'user-id',
				deviceId: 'device-id',
				jti: tokenId,
				exp: Math.floor(Date.now() / 1000) + 3600,
			};

			jwtService.verify.mockReturnValue(decodedToken);
			cacheService.get.mockResolvedValue(null);

			await expect(service.refreshAccessToken(refreshToken, mockFingerprint)).rejects.toThrow(
				UnauthorizedException
			);
		});

		it('should preserve the specific error message when token type is not refresh', async () => {
			jwtService.verify.mockReturnValue({ type: 'access', tokenId: 'some-id' });

			await expect(service.refreshAccessToken('some-token', mockFingerprint)).rejects.toThrow(
				'ERROR_INVALID_REFRESH_TOKEN'
			);
		});

		it('should preserve the specific error message when token is expired or revoked', async () => {
			jwtService.verify.mockReturnValue({ type: 'refresh', tokenId: 'some-id' });
			cacheService.get.mockResolvedValue(null);

			await expect(service.refreshAccessToken('some-token', mockFingerprint)).rejects.toThrow(
				'ERROR_REFRESH_TOKEN_EXPIRED_OR_REVOKED'
			);
		});

		it('should preserve the specific error message when fingerprint is invalid', async () => {
			const tokenId = 'token-id';
			jwtService.verify.mockReturnValue({ type: 'refresh', tokenId });
			cacheService.get.mockResolvedValue({ userId: 'u', deviceId: 'd', fingerprint: 'aaaaaa' });
			cacheService.del.mockResolvedValue(undefined);
			jest.spyOn(service as any, 'generateDeviceFingerprint').mockReturnValue('bbbbbb');

			await expect(service.refreshAccessToken('some-token', mockFingerprint)).rejects.toThrow(
				'ERROR_DEVICE_FINGERPRINT_MISMATCH'
			);
		});
	});

	describe('revokeToken', () => {
		it('should revoke an access token using its jti claim', async () => {
			const accessToken = 'valid-access-token';
			const jti = 'access-token-uuid';

			jwtService.verify.mockReturnValue({
				jti,
				exp: Math.floor(Date.now() / 1000) + 3600,
			} as any);
			cacheService.set.mockResolvedValue(undefined);

			await service.revokeToken(accessToken);

			expect(jwtService.verify).toHaveBeenCalledWith(accessToken, { algorithms: ['ES256'] });
			expect(cacheService.set).toHaveBeenCalledWith(
				`revoked:${jti}`,
				expect.any(Object),
				expect.any(Number)
			);
		});

		it('should revoke a legacy token using its tokenId claim when jti is absent', async () => {
			const legacyToken = 'valid-legacy-token';
			const tokenId = 'legacy-token-id';

			jwtService.verify.mockReturnValue({
				tokenId,
				exp: Math.floor(Date.now() / 1000) + 3600,
			} as any);
			cacheService.set.mockResolvedValue(undefined);

			await service.revokeToken(legacyToken);

			expect(cacheService.set).toHaveBeenCalledWith(
				`revoked:${tokenId}`,
				expect.any(Object),
				expect.any(Number)
			);
		});

		it('should prefer jti over tokenId when both are present', async () => {
			const token = 'some-token';
			const jti = 'jti-claim';

			jwtService.verify.mockReturnValue({
				jti,
				tokenId: 'should-not-be-used',
				exp: Math.floor(Date.now() / 1000) + 3600,
			} as any);
			cacheService.set.mockResolvedValue(undefined);

			await service.revokeToken(token);

			expect(cacheService.set).toHaveBeenCalledWith(
				`revoked:${jti}`,
				expect.any(Object),
				expect.any(Number)
			);
		});

		it('should not write to cache when token has no jti or tokenId', async () => {
			jwtService.verify.mockReturnValue({
				sub: 'user-id',
				exp: Math.floor(Date.now() / 1000) + 3600,
			} as any);

			await service.revokeToken('some-token');

			expect(cacheService.set).not.toHaveBeenCalled();
		});

		it('should not write to cache when token signature is invalid', async () => {
			jwtService.verify.mockImplementation(() => {
				throw new Error('invalid signature');
			});

			await expect(service.revokeToken('forged-token')).resolves.not.toThrow();
			expect(cacheService.set).not.toHaveBeenCalled();
		});

		it('should handle expired token gracefully without writing to cache', async () => {
			jwtService.verify.mockImplementation(() => {
				throw new Error('jwt expired');
			});

			await expect(service.revokeToken('expired-token')).resolves.not.toThrow();
			expect(cacheService.set).not.toHaveBeenCalled();
		});
	});

	describe('revokeRefreshToken', () => {
		it('should delete the refresh token from cache', async () => {
			cacheService.del.mockResolvedValue(undefined);

			await service.revokeRefreshToken('token-id');

			expect(cacheService.del).toHaveBeenCalledWith('refresh_token:token-id');
		});
	});

	describe('revokeAllTokensForDevice', () => {
		it('should set the revoked_device key in cache', async () => {
			cacheService.set.mockResolvedValue(undefined);

			await service.revokeAllTokensForDevice('device-id');

			expect(cacheService.set).toHaveBeenCalledWith(
				'revoked_device:device-id',
				'true',
				expect.any(Number)
			);
		});

		// WHISPR-919 : le TTL doit être strictement supérieur à la validité
		// d'un refresh token (30 j) pour qu'un access token signé avec ce
		// device ne puisse jamais bypasser la revocation pendant sa durée
		// de vie. On laisse un peu de marge mais la clé doit bien expirer
		// automatiquement (éviter la pollution Redis indéfinie).
		it('should set a TTL greater than refresh token lifetime and less than ~60 days', async () => {
			cacheService.set.mockResolvedValue(undefined);

			await service.revokeAllTokensForDevice('device-id');

			const ttl = (cacheService.set.mock.calls[0] as [string, string, number])[2];
			expect(ttl).toBeGreaterThan(30 * 24 * 60 * 60);
			expect(ttl).toBeLessThan(60 * 24 * 60 * 60);
		});
	});

	// WHISPR-919
	describe('clearDeviceRevocation', () => {
		it('should delete the revoked_device cache entry', async () => {
			cacheService.del.mockResolvedValue(undefined);

			await service.clearDeviceRevocation('device-id');

			expect(cacheService.del).toHaveBeenCalledWith('revoked_device:device-id');
		});
	});

	describe('isTokenRevoked', () => {
		it('should return true when token is in revoked cache', async () => {
			cacheService.get.mockResolvedValue({ revokedAt: Date.now() });

			const result = await service.isTokenRevoked('token-id');

			expect(result).toBe(true);
			expect(cacheService.get).toHaveBeenCalledWith('revoked:token-id');
		});

		it('should return false when token is not in revoked cache', async () => {
			cacheService.get.mockResolvedValue(null);

			const result = await service.isTokenRevoked('token-id');

			expect(result).toBe(false);
		});
	});

	describe('isDeviceRevoked', () => {
		it('should return true when device is revoked', async () => {
			cacheService.get.mockResolvedValue('true');

			const result = await service.isDeviceRevoked('device-id');

			expect(result).toBe(true);
			expect(cacheService.get).toHaveBeenCalledWith('revoked_device:device-id');
		});

		it('should return false when device is not revoked', async () => {
			cacheService.get.mockResolvedValue(null);

			const result = await service.isDeviceRevoked('device-id');

			expect(result).toBe(false);
		});
	});

	describe('validateToken', () => {
		it('should return the decoded payload for a valid token', () => {
			const payload = { sub: 'user-id', deviceId: 'device-id', jti: 'jti-value' };
			jwtService.verify.mockReturnValue(payload as any);

			const result = service.validateToken('valid-token');

			expect(result).toEqual(payload);
			expect(jwtService.verify).toHaveBeenCalledWith('valid-token', { algorithms: ['ES256'] });
		});

		it('should throw UnauthorizedException for an invalid token', () => {
			jwtService.verify.mockImplementation(() => {
				throw new Error('invalid signature');
			});

			expect(() => service.validateToken('bad-token')).toThrow(UnauthorizedException);
		});
	});
});

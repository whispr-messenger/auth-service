import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

import { TokensService } from './tokens.service';
import { CacheService } from '../../cache';
import { DeviceFingerprint } from '../../devices/types/device-fingerprint.interface';

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
	});

	describe('revokeToken', () => {
		it('should revoke an access token using its jti claim', async () => {
			const accessToken = 'valid-access-token';
			const jti = 'access-token-uuid';

			jwtService.decode.mockReturnValue({
				jti,
				exp: Math.floor(Date.now() / 1000) + 3600,
			});
			cacheService.set.mockResolvedValue(undefined);

			await service.revokeToken(accessToken);

			expect(cacheService.set).toHaveBeenCalledWith(
				`revoked:${jti}`,
				expect.any(Object),
				expect.any(Number)
			);
		});

		it('should revoke a legacy token using its tokenId claim when jti is absent', async () => {
			const legacyToken = 'valid-legacy-token';
			const tokenId = 'legacy-token-id';

			jwtService.decode.mockReturnValue({
				tokenId,
				exp: Math.floor(Date.now() / 1000) + 3600,
			});
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

			jwtService.decode.mockReturnValue({
				jti,
				tokenId: 'should-not-be-used',
				exp: Math.floor(Date.now() / 1000) + 3600,
			});
			cacheService.set.mockResolvedValue(undefined);

			await service.revokeToken(token);

			expect(cacheService.set).toHaveBeenCalledWith(
				`revoked:${jti}`,
				expect.any(Object),
				expect.any(Number)
			);
		});

		it('should not write to cache when token has no jti or tokenId', async () => {
			jwtService.decode.mockReturnValue({
				sub: 'user-id',
				exp: Math.floor(Date.now() / 1000) + 3600,
			});

			await service.revokeToken('some-token');

			expect(cacheService.set).not.toHaveBeenCalled();
		});

		it('should handle invalid token gracefully', async () => {
			jwtService.decode.mockReturnValue(null);

			await expect(service.revokeToken('invalid-token')).resolves.not.toThrow();
			expect(cacheService.set).not.toHaveBeenCalled();
		});
	});
});

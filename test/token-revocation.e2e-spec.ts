/**
 * E2E tests for individual access-token revocation via JwtAuthGuard.
 *
 * These tests verify the observable HTTP behaviour (401 vs 200) when a token's
 * jti is present in the revocation cache — without testing internal
 * implementation details such as which cache key is written.
 *
 * The existing `GET /devices` endpoint is used as a representative protected
 * route because it is guarded by JwtAuthGuard.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/modules/app/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserAuth } from '../src/modules/common/entities/user-auth.entity';
import { Device } from '../src/modules/devices/entities/device.entity';
import { PreKey } from '../src/modules/signal/entities/prekey.entity';
import { SignedPreKey } from '../src/modules/signal/entities/signed-prekey.entity';
import { IdentityKey } from '../src/modules/signal/entities/identity-key.entity';
import { BackupCode } from '../src/modules/two-factor-authentication/entities/backup-code.entity';
import { LoginHistory } from '../src/modules/phone-auth/entities/login-history.entity';
import { CacheService } from '../src/modules/cache';
import { RedisConfig } from '../src/config/redis.config';
import { TokensService } from '../src/modules/tokens/services/tokens.service';
import { DevicesService } from '../src/modules/devices/services/devices.service';
import { DeviceRepository } from '../src/modules/devices/repositories/device.repository';
import { PreKeyRepository } from '../src/modules/signal/repositories/prekey.repository';
import { SignedPreKeyRepository } from '../src/modules/signal/repositories/signed-prekey.repository';
import { IdentityKeyRepository } from '../src/modules/signal/repositories/identity-key.repository';
import { JwtPayload } from '../src/modules/tokens/types/jwt-payload.interface';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

const mockRepository = {
	find: jest.fn(),
	findOne: jest.fn(),
	save: jest.fn(),
	create: jest.fn(),
	delete: jest.fn(),
	update: jest.fn(),
};

const mockRedisConfig = {
	health: { isHealthy: true, lastError: null },
	getClient: jest.fn(),
	onModuleDestroy: jest.fn(),
};

const mockCacheService = {
	get: jest.fn().mockResolvedValue(null),
	set: jest.fn().mockResolvedValue(undefined),
	del: jest.fn().mockResolvedValue(undefined),
};

const validPayload: JwtPayload = {
	sub: 'user-id',
	jti: 'access-token-jti-uuid',
	iat: Math.floor(Date.now() / 1000),
	exp: Math.floor(Date.now() / 1000) + 3600,
	deviceId: 'device-id',
	scope: 'user',
	fingerprint: 'abc123',
};

describe('Token revocation (e2e)', () => {
	let app: INestApplication;
	let tokensService: jest.Mocked<
		Pick<TokensService, 'validateToken' | 'isTokenRevoked' | 'isDeviceRevoked'>
	>;

	const buildApp = async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(getRepositoryToken(UserAuth))
			.useValue(mockRepository)
			.overrideProvider(getRepositoryToken(Device))
			.useValue(mockRepository)
			.overrideProvider(getRepositoryToken(PreKey))
			.useValue(mockRepository)
			.overrideProvider(getRepositoryToken(SignedPreKey))
			.useValue(mockRepository)
			.overrideProvider(getRepositoryToken(IdentityKey))
			.useValue(mockRepository)
			.overrideProvider(getRepositoryToken(BackupCode))
			.useValue(mockRepository)
			.overrideProvider(getRepositoryToken(LoginHistory))
			.useValue(mockRepository)
			.overrideProvider(RedisConfig)
			.useValue(mockRedisConfig)
			.overrideProvider(CacheService)
			.useValue(mockCacheService)
			.overrideProvider(TokensService)
			.useValue(tokensService)
			.overrideProvider(DevicesService)
			.useValue({ getUserDevices: jest.fn().mockResolvedValue([]) })
			.overrideProvider(DeviceRepository)
			.useValue(mockRepository)
			.overrideProvider(PreKeyRepository)
			.useValue(mockRepository)
			.overrideProvider(SignedPreKeyRepository)
			.useValue(mockRepository)
			.overrideProvider(IdentityKeyRepository)
			.useValue(mockRepository)
			.compile();

		const application = moduleFixture.createNestApplication();
		application.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
		await application.init();
		return application;
	};

	beforeEach(async () => {
		tokensService = {
			validateToken: jest.fn().mockReturnValue(validPayload),
			isTokenRevoked: jest.fn().mockResolvedValue(false),
			isDeviceRevoked: jest.fn().mockResolvedValue(false),
		};
		app = await buildApp();
	});

	afterEach(async () => {
		if (app) await app.close();
		jest.clearAllMocks();
	});

	/** Sends a GET to the guard-protected /auth/device endpoint */
	const hitProtectedEndpoint = (token?: string) => {
		const req = request(app.getHttpServer()).get('/auth/device');
		if (token) req.set('Authorization', `Bearer ${token}`);
		return req;
	};

	describe('when no token is provided', () => {
		it('returns 401 when Authorization header is missing', async () => {
			await hitProtectedEndpoint().expect(401);
		});

		it('returns 401 when scheme is not Bearer', async () => {
			await request(app.getHttpServer())
				.get('/auth/device')
				.set('Authorization', 'Basic sometoken')
				.expect(401);
		});
	});

	describe('when token is present', () => {
		it('returns 200 when token is valid and not revoked', async () => {
			await hitProtectedEndpoint('valid.access.token').expect(200);
		});

		it('returns 401 when token signature is invalid', async () => {
			(tokensService.validateToken as jest.Mock).mockImplementation(() => {
				throw new Error('invalid signature');
			});

			await hitProtectedEndpoint('bad.token').expect(401);
		});
	});

	describe('individual token revocation via jti', () => {
		it('returns 401 when the token jti is in the revocation list', async () => {
			tokensService.isTokenRevoked.mockResolvedValue(true);

			await hitProtectedEndpoint('revoked.access.token').expect(401);
		});

		it('returns 200 when the token jti is not revoked', async () => {
			tokensService.isTokenRevoked.mockResolvedValue(false);

			await hitProtectedEndpoint('valid.access.token').expect(200);
		});

		it('uses jti from the payload — not sub — when checking revocation', async () => {
			await hitProtectedEndpoint('valid.access.token');

			expect(tokensService.isTokenRevoked).toHaveBeenCalledWith(validPayload.jti);
			expect(tokensService.isTokenRevoked).not.toHaveBeenCalledWith(validPayload.sub);
		});
	});

	describe('device-level revocation', () => {
		it('returns 401 when the device is revoked', async () => {
			tokensService.isDeviceRevoked.mockResolvedValue(true);

			await hitProtectedEndpoint('valid.access.token').expect(401);
		});

		it('returns 401 when both token jti and device are revoked', async () => {
			tokensService.isTokenRevoked.mockResolvedValue(true);
			tokensService.isDeviceRevoked.mockResolvedValue(true);

			await hitProtectedEndpoint('valid.access.token').expect(401);
		});
	});
});

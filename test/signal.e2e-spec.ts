/**
 * E2E tests for the Signal health and cleanup endpoints.
 *
 * Verifies the observable HTTP behaviour of:
 * - GET  /auth/v1/signal/health          — returns system health status
 * - POST /auth/v1/signal/health/cleanup  — triggers manual key cleanup
 *
 * GET /health is public; POST /health/cleanup requires JWT auth.
 * Both delegate to SignalKeySchedulerService / PreKeyRepository.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
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
import { DeviceRepository } from '../src/modules/devices/repositories/device.repository';
import { PreKeyRepository } from '../src/modules/signal/repositories/prekey.repository';
import { SignedPreKeyRepository } from '../src/modules/signal/repositories/signed-prekey.repository';
import { IdentityKeyRepository } from '../src/modules/signal/repositories/identity-key.repository';
import { SignalKeySchedulerService } from '../src/modules/signal/services/signal-key-scheduler.service';
import { TokensService } from '../src/modules/tokens/services/tokens.service';
import { JwtPayload } from '../src/modules/tokens/types/jwt-payload.interface';
import { createTestApp } from './helpers/create-test-app';

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

const mockTokensService = {
	validateToken: jest.fn().mockImplementation((token: string) => {
		if (token === 'invalid-token') {
			throw new Error('invalid signature');
		}
		return validPayload;
	}),
	isTokenRevoked: jest.fn().mockResolvedValue(false),
	isDeviceRevoked: jest.fn().mockResolvedValue(false),
};

describe('Signal health & cleanup endpoints (e2e)', () => {
	let app: INestApplication;
	let mockSchedulerService: Record<string, jest.Mock>;
	let mockPreKeyRepo: Record<string, jest.Mock>;

	beforeEach(async () => {
		mockSchedulerService = {
			getSchedulerStats: jest.fn().mockReturnValue({
				lastCleanupTime: null,
				lastPreKeyCheckTime: null,
				lastOldPreKeyCleanupTime: null,
				isHealthy: true,
			}),
			manualCleanup: jest.fn().mockResolvedValue({
				expiredKeysDeleted: 3,
				oldPreKeysDeleted: 7,
			}),
		};

		const mockQueryBuilder = {
			select: jest.fn().mockReturnThis(),
			addSelect: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			groupBy: jest.fn().mockReturnThis(),
			addGroupBy: jest.fn().mockReturnThis(),
			getRawMany: jest.fn().mockResolvedValue([]),
		};

		mockPreKeyRepo = {
			...mockRepository,
			count: jest.fn().mockResolvedValue(5000),
			createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
		};

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
			.overrideProvider(DeviceRepository)
			.useValue(mockRepository)
			.overrideProvider(PreKeyRepository)
			.useValue(mockPreKeyRepo)
			.overrideProvider(SignedPreKeyRepository)
			.useValue(mockRepository)
			.overrideProvider(IdentityKeyRepository)
			.useValue(mockRepository)
			.overrideProvider(SignalKeySchedulerService)
			.useValue(mockSchedulerService)
			.overrideProvider(TokensService)
			.useValue(mockTokensService)
			.compile();

		app = await createTestApp(moduleFixture);
	});

	afterEach(async () => {
		if (app) await app.close();
		jest.clearAllMocks();
	});

	// ---------------------------------------------------------------
	// GET /auth/v1/signal/health
	// ---------------------------------------------------------------
	describe('GET /auth/v1/signal/health', () => {
		it('returns 200 without any Authorization header (public endpoint)', async () => {
			await request(app.getHttpServer()).get('/auth/v1/signal/health').expect(200);
		});

		it('returns a body with the expected health status shape', async () => {
			const { body } = await request(app.getHttpServer()).get('/auth/v1/signal/health').expect(200);

			expect(body).toHaveProperty('status');
			expect(body).toHaveProperty('timestamp');
			expect(body).toHaveProperty('scheduler');
			expect(body).toHaveProperty('prekeys');
			expect(body).toHaveProperty('issues');
		});

		it('reports "healthy" when scheduler is healthy and prekeys are sufficient', async () => {
			const { body } = await request(app.getHttpServer()).get('/auth/v1/signal/health').expect(200);

			expect(body.status).toBe('healthy');
			expect(body.issues).toEqual([]);
		});

		it('reports "unhealthy" when the scheduler is not healthy', async () => {
			mockSchedulerService.getSchedulerStats.mockReturnValue({
				lastCleanupTime: null,
				lastPreKeyCheckTime: null,
				lastOldPreKeyCleanupTime: null,
				isHealthy: false,
			});

			const { body } = await request(app.getHttpServer()).get('/auth/v1/signal/health').expect(200);

			expect(body.status).toBe('unhealthy');
			expect(body.issues.length).toBeGreaterThan(0);
		});

		it('reports "unhealthy" when devices have no prekeys', async () => {
			mockPreKeyRepo.createQueryBuilder.mockReturnValue({
				select: jest.fn().mockReturnThis(),
				addSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				groupBy: jest.fn().mockReturnThis(),
				addGroupBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([{ userId: 'u1', deviceId: 'd1', count: '0' }]),
			});

			const { body } = await request(app.getHttpServer()).get('/auth/v1/signal/health').expect(200);

			expect(body.status).toBe('unhealthy');
		});

		it('reports "degraded" when system-wide prekey count is low', async () => {
			mockPreKeyRepo.count.mockResolvedValue(500);

			const { body } = await request(app.getHttpServer()).get('/auth/v1/signal/health').expect(200);

			expect(body.status).toBe('degraded');
			expect(body.issues).toEqual(expect.arrayContaining([expect.stringContaining('low')]));
		});

		it('includes scheduler stats in the response', async () => {
			const { body } = await request(app.getHttpServer()).get('/auth/v1/signal/health').expect(200);

			expect(body.scheduler).toEqual(expect.objectContaining({ isHealthy: true }));
		});

		it('includes prekey stats in the response', async () => {
			const { body } = await request(app.getHttpServer()).get('/auth/v1/signal/health').expect(200);

			expect(body.prekeys).toEqual(
				expect.objectContaining({
					totalUnused: 5000,
					devicesWithLowPrekeys: expect.any(Number),
					devicesWithNoPrekeys: expect.any(Number),
				})
			);
		});
	});

	// ---------------------------------------------------------------
	// POST /auth/v1/signal/health/cleanup
	// ---------------------------------------------------------------
	describe('POST /auth/v1/signal/health/cleanup', () => {
		it('returns 401 without any Authorization header (protected endpoint)', async () => {
			await request(app.getHttpServer()).post('/auth/v1/signal/health/cleanup').expect(401);
		});

		it('returns 401 with an invalid token', async () => {
			await request(app.getHttpServer())
				.post('/auth/v1/signal/health/cleanup')
				.set('Authorization', 'Bearer invalid-token')
				.expect(401);
		});

		it('returns 200 with a valid JWT and the cleanup result', async () => {
			const { body } = await request(app.getHttpServer())
				.post('/auth/v1/signal/health/cleanup')
				.set('Authorization', 'Bearer valid.access.token')
				.expect(200);

			expect(body).toEqual({
				message: 'Cleanup completed successfully',
				expiredKeysDeleted: 3,
				oldPreKeysDeleted: 7,
			});
			expect(mockSchedulerService.manualCleanup).toHaveBeenCalled();
		});
	});
});

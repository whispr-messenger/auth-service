/**
 * E2E tests for the Two-Factor Authentication (2FA) endpoints.
 *
 * Verifies the externally visible HTTP behaviour of:
 * - POST /auth/v1/2fa/setup          — set up 2FA (QR + secret + backup codes)
 * - POST /auth/v1/2fa/enable         — enable 2FA with TOTP verification
 * - POST /auth/v1/2fa/verify         — verify a TOTP / backup code
 * - POST /auth/v1/2fa/disable        — disable 2FA
 * - POST /auth/v1/2fa/backup-codes   — regenerate backup codes
 * - GET  /auth/v1/2fa/status         — check whether 2FA is enabled
 *
 * All endpoints require JWT auth. The guard is overridden to inject a
 * deterministic user id so tests exercise the real service logic against
 * mocked repositories.
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
import { JwtAuthGuard } from '../src/modules/tokens/guards/jwt-auth.guard';
import { DeviceRepository } from '../src/modules/devices/repositories/device.repository';
import { PreKeyRepository } from '../src/modules/signal/repositories/prekey.repository';
import { SignedPreKeyRepository } from '../src/modules/signal/repositories/signed-prekey.repository';
import { IdentityKeyRepository } from '../src/modules/signal/repositories/identity-key.repository';
import { createTestApp } from './helpers/create-test-app';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

/* ------------------------------------------------------------------ */
/* Shared constants & mock factories                                   */
/* ------------------------------------------------------------------ */

const TEST_USER_ID = 'test-user-2fa-id';

const baseUser: UserAuth = {
	id: TEST_USER_ID,
	phoneNumber: '+33600000000',
	twoFactorSecret: '',
	twoFactorEnabled: false,
	lastAuthenticatedAt: new Date(),
	createdAt: new Date(),
	updatedAt: new Date(),
};

/** Returns a fresh generic TypeORM repository mock. */
function makeMockRepository() {
	return {
		find: jest.fn().mockResolvedValue([]),
		findOne: jest.fn().mockResolvedValue(null),
		save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
		create: jest.fn().mockImplementation((data: any) => data),
		delete: jest.fn().mockResolvedValue({ affected: 0 }),
		update: jest.fn().mockResolvedValue({ affected: 0 }),
		count: jest.fn().mockResolvedValue(0),
	};
}

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

/* ------------------------------------------------------------------ */
/* Test suite                                                          */
/* ------------------------------------------------------------------ */

describe('Two-Factor Authentication endpoints (e2e)', () => {
	let app: INestApplication;
	let userAuthRepo: ReturnType<typeof makeMockRepository>;
	let backupCodeRepo: ReturnType<typeof makeMockRepository>;

	async function buildApp(): Promise<INestApplication> {
		userAuthRepo = makeMockRepository();
		backupCodeRepo = makeMockRepository();

		const genericRepo = makeMockRepository();

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(getRepositoryToken(UserAuth))
			.useValue(userAuthRepo)
			.overrideProvider(getRepositoryToken(Device))
			.useValue(genericRepo)
			.overrideProvider(getRepositoryToken(PreKey))
			.useValue(genericRepo)
			.overrideProvider(getRepositoryToken(SignedPreKey))
			.useValue(genericRepo)
			.overrideProvider(getRepositoryToken(IdentityKey))
			.useValue(genericRepo)
			.overrideProvider(getRepositoryToken(BackupCode))
			.useValue(backupCodeRepo)
			.overrideProvider(getRepositoryToken(LoginHistory))
			.useValue(genericRepo)
			.overrideProvider(RedisConfig)
			.useValue(mockRedisConfig)
			.overrideProvider(CacheService)
			.useValue(mockCacheService)
			.overrideProvider(DeviceRepository)
			.useValue(genericRepo)
			.overrideProvider(PreKeyRepository)
			.useValue(genericRepo)
			.overrideProvider(SignedPreKeyRepository)
			.useValue(genericRepo)
			.overrideProvider(IdentityKeyRepository)
			.useValue(genericRepo)
			.overrideGuard(JwtAuthGuard)
			.useValue({
				canActivate: (ctx: any) => {
					const req = ctx.switchToHttp().getRequest();
					req.user = { sub: TEST_USER_ID, deviceId: 'test-device' };
					return true;
				},
			})
			.compile();

		return createTestApp(moduleFixture);
	}

	beforeEach(async () => {
		app = await buildApp();
	});

	afterEach(async () => {
		if (app) await app.close();
		jest.clearAllMocks();
	});

	// ---------------------------------------------------------------
	// POST /auth/v1/2fa/setup
	// ---------------------------------------------------------------
	describe('POST /auth/v1/2fa/setup', () => {
		it('returns 400 when user is not found', async () => {
			userAuthRepo.findOne.mockResolvedValue(null);

			const { status, body } = await request(app.getHttpServer()).post('/auth/v1/2fa/setup');

			expect(status).toBe(400);
			expect(body.message).toBe('User not found');
		});

		it('returns 400 when 2FA is already enabled', async () => {
			userAuthRepo.findOne.mockResolvedValue({ ...baseUser, twoFactorEnabled: true });

			const { status, body } = await request(app.getHttpServer()).post('/auth/v1/2fa/setup');

			expect(status).toBe(400);
			expect(body.message).toBe('Two-factor authentication is already enabled');
		});

		it('returns 201 with secret, qrCodeUrl and backupCodes on success', async () => {
			userAuthRepo.findOne.mockResolvedValue({ ...baseUser });
			backupCodeRepo.delete.mockResolvedValue({ affected: 0 });

			const { status, body } = await request(app.getHttpServer()).post('/auth/v1/2fa/setup');

			expect(status).toBe(201);
			expect(body).toHaveProperty('secret');
			expect(body).toHaveProperty('qrCodeUrl');
			expect(body).toHaveProperty('backupCodes');
			expect(Array.isArray(body.backupCodes)).toBe(true);
		});
	});

	// ---------------------------------------------------------------
	// POST /auth/v1/2fa/enable
	// ---------------------------------------------------------------
	describe('POST /auth/v1/2fa/enable', () => {
		it('returns 400 when user is not found', async () => {
			userAuthRepo.findOne.mockResolvedValue(null);

			const { status, body } = await request(app.getHttpServer())
				.post('/auth/v1/2fa/enable')
				.send({ secret: 'JBSWY3DPEHPK3PXP', token: '000000' });

			expect(status).toBe(400);
			expect(body.message).toBe('User not found');
		});

		it('returns 400 when verification code is invalid', async () => {
			userAuthRepo.findOne.mockResolvedValue({ ...baseUser });

			const { status, body } = await request(app.getHttpServer())
				.post('/auth/v1/2fa/enable')
				.send({ secret: 'JBSWY3DPEHPK3PXP', token: '000000' });

			expect(status).toBe(400);
			expect(body.message).toBe('Invalid verification code');
		});
	});

	// ---------------------------------------------------------------
	// POST /auth/v1/2fa/verify
	// ---------------------------------------------------------------
	describe('POST /auth/v1/2fa/verify', () => {
		it('returns 400 when 2FA is not configured', async () => {
			userAuthRepo.findOne.mockResolvedValue({ ...baseUser, twoFactorEnabled: false });

			const { status, body } = await request(app.getHttpServer())
				.post('/auth/v1/2fa/verify')
				.send({ token: '000000' });

			expect(status).toBe(400);
			expect(body.message).toBe('Two-factor authentication is not configured');
		});

		it('returns 400 when 2FA is enabled but secret is missing', async () => {
			userAuthRepo.findOne.mockResolvedValue({
				...baseUser,
				twoFactorEnabled: true,
				twoFactorSecret: '',
			});

			const { status, body } = await request(app.getHttpServer())
				.post('/auth/v1/2fa/verify')
				.send({ token: '000000' });

			expect(status).toBe(400);
			expect(body.message).toBe('Two-factor authentication is not configured');
		});
	});

	// ---------------------------------------------------------------
	// POST /auth/v1/2fa/disable
	// ---------------------------------------------------------------
	describe('POST /auth/v1/2fa/disable', () => {
		it('returns 400 when user is not found', async () => {
			userAuthRepo.findOne.mockResolvedValue(null);

			const { status, body } = await request(app.getHttpServer())
				.post('/auth/v1/2fa/disable')
				.send({ token: '000000' });

			expect(status).toBe(400);
			expect(body.message).toBe('User not found');
		});

		it('returns 400 when 2FA is not enabled', async () => {
			userAuthRepo.findOne.mockResolvedValue({ ...baseUser, twoFactorEnabled: false });

			const { status, body } = await request(app.getHttpServer())
				.post('/auth/v1/2fa/disable')
				.send({ token: '000000' });

			expect(status).toBe(400);
			expect(body.message).toBe('Two-factor authentication is not enabled');
		});

		it('returns 401 when verification code is invalid (2FA enabled, wrong TOTP, no backup codes)', async () => {
			userAuthRepo.findOne.mockResolvedValue({
				...baseUser,
				twoFactorEnabled: true,
				twoFactorSecret: 'JBSWY3DPEHPK3PXP',
			});
			// No backup codes available — UnauthorizedException from backup-codes service
			backupCodeRepo.find.mockResolvedValue([]);

			const { status, body } = await request(app.getHttpServer())
				.post('/auth/v1/2fa/disable')
				.send({ token: '000000' });

			expect(status).toBe(401);
			expect(body.message).toBe('Invalid backup code');
		});
	});

	// ---------------------------------------------------------------
	// POST /auth/v1/2fa/backup-codes
	// ---------------------------------------------------------------
	describe('POST /auth/v1/2fa/backup-codes', () => {
		it('returns 400 when 2FA is not configured', async () => {
			userAuthRepo.findOne.mockResolvedValue({ ...baseUser, twoFactorEnabled: false });

			const { status, body } = await request(app.getHttpServer())
				.post('/auth/v1/2fa/backup-codes')
				.send({ token: '000000' });

			expect(status).toBe(400);
			expect(body.message).toBe('Two-factor authentication is not configured');
		});

		it('returns 401 when no backup codes exist (wrong TOTP, empty backup store)', async () => {
			userAuthRepo.findOne.mockResolvedValue({
				...baseUser,
				twoFactorEnabled: true,
				twoFactorSecret: 'JBSWY3DPEHPK3PXP',
			});
			backupCodeRepo.find.mockResolvedValue([]);

			const { status, body } = await request(app.getHttpServer())
				.post('/auth/v1/2fa/backup-codes')
				.send({ token: '000000' });

			expect(status).toBe(401);
			expect(body.message).toBe('Invalid backup code');
		});
	});

	// ---------------------------------------------------------------
	// GET /auth/v1/2fa/status
	// ---------------------------------------------------------------
	describe('GET /auth/v1/2fa/status', () => {
		it('returns 200 with enabled: false when 2FA is not enabled', async () => {
			userAuthRepo.findOne.mockResolvedValue({ ...baseUser, twoFactorEnabled: false });

			const { status, body } = await request(app.getHttpServer()).get('/auth/v1/2fa/status');

			expect(status).toBe(200);
			expect(body).toEqual({ enabled: false });
		});

		it('returns 200 with enabled: true when 2FA is enabled', async () => {
			userAuthRepo.findOne.mockResolvedValue({ ...baseUser, twoFactorEnabled: true });

			const { status, body } = await request(app.getHttpServer()).get('/auth/v1/2fa/status');

			expect(status).toBe(200);
			expect(body).toEqual({ enabled: true });
		});

		it('returns 200 with enabled: false when user is not found', async () => {
			userAuthRepo.findOne.mockResolvedValue(null);

			const { status, body } = await request(app.getHttpServer()).get('/auth/v1/2fa/status');

			expect(status).toBe(200);
			expect(body).toEqual({ enabled: false });
		});
	});
});

/**
 * E2E tests for the JWKS endpoint.
 *
 * Verifies the observable HTTP behaviour of GET /auth/.well-known/jwks.json:
 * - Returns 200 with a valid JWKS document
 * - Contains EC public key fields (kty, crv, alg, use, kid, x, y)
 * - Never leaks the private key parameter d
 * - Endpoint is public (no JWT required)
 *
 * Also verifies that JWTs signed by TokensService include a kid header
 * matching the kid returned by the JWKS endpoint.
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
import { TokensService } from '../src/modules/tokens/services/tokens.service';
import { JwksService } from '../src/modules/jwks/jwks.service';
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

describe('JWKS endpoint (e2e)', () => {
	let app: INestApplication;

	beforeEach(async () => {
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
			.useValue(mockRepository)
			.overrideProvider(SignedPreKeyRepository)
			.useValue(mockRepository)
			.overrideProvider(IdentityKeyRepository)
			.useValue(mockRepository)
			.compile();

		app = await createTestApp(moduleFixture);
	});

	afterEach(async () => {
		if (app) await app.close();
		jest.clearAllMocks();
	});

	describe('GET /auth/.well-known/jwks.json', () => {
		it('returns 200 without any Authorization header (public endpoint)', async () => {
			await request(app.getHttpServer()).get('/auth/.well-known/jwks.json').expect(200);
		});

		it('returns a JWKS document with a keys array', async () => {
			const response = await request(app.getHttpServer())
				.get('/auth/.well-known/jwks.json')
				.expect(200);

			expect(response.body).toHaveProperty('keys');
			expect(Array.isArray(response.body.keys)).toBe(true);
			expect(response.body.keys.length).toBeGreaterThan(0);
		});

		it('contains a key with correct EC P-256 fields', async () => {
			const response = await request(app.getHttpServer())
				.get('/auth/.well-known/jwks.json')
				.expect(200);

			const [key] = response.body.keys;
			expect(key.kty).toBe('EC');
			expect(key.crv).toBe('P-256');
			expect(key.alg).toBe('ES256');
			expect(key.use).toBe('sig');
		});

		it('contains a key with non-empty kid, x, and y', async () => {
			const response = await request(app.getHttpServer())
				.get('/auth/.well-known/jwks.json')
				.expect(200);

			const [key] = response.body.keys;
			expect(key.kid).toBeTruthy();
			expect(key.x).toBeTruthy();
			expect(key.y).toBeTruthy();
		});

		it('never includes the private key parameter d', async () => {
			const response = await request(app.getHttpServer())
				.get('/auth/.well-known/jwks.json')
				.expect(200);

			expect(JSON.stringify(response.body)).not.toContain('"d"');
		});
	});

	describe('kid consistency between JWKS and signed JWTs', () => {
		it('JWTs signed by TokensService include a kid header matching the JWKS kid', async () => {
			const jwksResponse = await request(app.getHttpServer())
				.get('/auth/.well-known/jwks.json')
				.expect(200);

			const jwksKid: string = jwksResponse.body.keys[0].kid;

			const tokensService = app.get(TokensService);
			const jwksService = app.get(JwksService);

			// The kid returned by JwksService must match the JWKS endpoint
			expect(jwksService.getKid()).toBe(jwksKid);

			// Generate a token pair and decode the header to check the kid
			const { accessToken } = await tokensService.generateTokenPair('user-id', 'device-id', {
				userAgent: 'test-agent',
				ipAddress: '127.0.0.1',
				deviceType: 'unknown',
				timestamp: Date.now(),
			});

			// Decode JWT header (no verification needed here — we're testing the kid claim)
			const [headerB64] = accessToken.split('.');
			const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));

			expect(header.kid).toBe(jwksKid);
		});
	});
});

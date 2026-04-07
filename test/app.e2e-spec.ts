import { INestApplication } from '@nestjs/common';
import { JwtAuthGuard } from '../src/modules/tokens/guards/jwt-auth.guard';
import { CacheService } from '../src/modules/cache';
import { PhoneAuthenticationService } from '../src/modules/phone-auth/services/phone-authentication.service';
import { TokensService } from '../src/modules/tokens/services/tokens.service';
import { JwtService } from '@nestjs/jwt';
import { PhoneVerificationService } from '../src/modules/phone-verification/services/phone-verification/phone-verification.service';
import { TwoFactorAuthenticationService } from '../src/modules/two-factor-authentication/services/two-factor-authentication.service';
import { DevicesService } from '../src/modules/devices/services/devices.service';
import { DataSource } from 'typeorm';
import { createTestModule } from './helpers/create-test-module';
import { createTestApp } from './helpers/create-test-app';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('AuthController (e2e)', () => {
	let app: INestApplication;

	const mockAuthService = {
		register: jest.fn(),
		login: jest.fn(),
		validateToken: jest.fn(),
		refreshToken: jest.fn(),
	};

	const mockVerificationService = {
		sendVerificationCode: jest.fn(),
		verifyCode: jest.fn(),
	};

	const mockTokenService = {
		generateToken: jest.fn(),
		validateToken: jest.fn(),
		refreshToken: jest.fn(),
	};

	const mockTwoFactorService = {
		generateSecret: jest.fn(),
		verifyToken: jest.fn(),
	};

	const mockDeviceService = {
		registerDevice: jest.fn(),
		getDevices: jest.fn(),
		removeDevice: jest.fn(),
	};

	const mockJwtService = {
		sign: jest.fn(),
		verify: jest.fn(),
		decode: jest.fn(),
	};

	const mockDataSource = {
		query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
	};

	beforeEach(async () => {
		try {
			const moduleFixture = await createTestModule({
				providers: [
					{ provide: PhoneAuthenticationService, useValue: mockAuthService },
					{ provide: PhoneVerificationService, useValue: mockVerificationService },
					{ provide: TokensService, useValue: mockTokenService },
					{ provide: TwoFactorAuthenticationService, useValue: mockTwoFactorService },
					{ provide: DevicesService, useValue: mockDeviceService },
					{ provide: JwtService, useValue: mockJwtService },
					{ provide: DataSource, useValue: mockDataSource },
					{
						provide: CacheService,
						useValue: {
							get: jest.fn().mockResolvedValue('ok'),
							set: jest.fn().mockResolvedValue(undefined),
							del: jest.fn().mockResolvedValue(undefined),
						},
					},
				],
				guards: [{ guard: JwtAuthGuard, useValue: { canActivate: () => true } }],
			});

			app = await createTestApp(moduleFixture);
		} catch (error) {
			console.error('Failed to initialize test app:', error);
			throw error;
		}
	});

	afterEach(async () => {
		if (app) {
			await app.close();
		}
	});

	describe('Application Bootstrap', () => {
		it('should respond to HTTP requests after bootstrap', async () => {
			const response = await request(app.getHttpServer()).get('/auth/v1/health/live');
			expect(response.status).toBe(200);
			expect(response.body.status).toBe('alive');
		});
	});

	describe('GET /auth/health', () => {
		it('should return ok with healthy services when database and cache are up', async () => {
			const response = await request(app.getHttpServer()).get('/auth/health').expect(200);

			expect(response.body.status).toBe('ok');
			expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
			expect(Date.parse(response.body.timestamp)).not.toBeNaN();
			expect(Number.isFinite(response.body.uptime)).toBe(true);
			expect(response.body.uptime).toBeGreaterThanOrEqual(0);
			expect(response.body.version).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/);
			expect(response.body.memory).toEqual(
				expect.objectContaining({
					rss: expect.any(Number),
					heapTotal: expect.any(Number),
					heapUsed: expect.any(Number),
				})
			);
			expect(response.body.services).toEqual({
				database: 'healthy',
				cache: 'healthy',
			});
		});

		it('should return 503 when database is unhealthy', async () => {
			mockDataSource.query.mockRejectedValueOnce(new Error('Connection refused'));

			const response = await request(app.getHttpServer()).get('/auth/health').expect(503);

			expect(response.body.status).toBe('error');
			expect(response.body.services.database).toBe('unhealthy');
		});
	});

	describe('GET /auth/health/live', () => {
		it('should return alive status without checking dependencies', async () => {
			const response = await request(app.getHttpServer()).get('/auth/health/live').expect(200);

			expect(response.body.status).toBe('alive');
			expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
			expect(Date.parse(response.body.timestamp)).not.toBeNaN();
			expect(Number.isFinite(response.body.uptime)).toBe(true);
			expect(response.body.uptime).toBeGreaterThanOrEqual(0);
			expect(response.body.version).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/);
			expect(response.body).not.toHaveProperty('services');
		});
	});
});

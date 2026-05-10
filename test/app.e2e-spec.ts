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

	describe('GET /auth/v1/health', () => {
		it('should return only { status: "ok" } when database and cache are up', async () => {
			const response = await request(app.getHttpServer()).get('/auth/v1/health').expect(200);

			expect(response.body).toEqual({ status: 'ok' });
		});

		it('should not leak runtime metadata (uptime, memory, version, services)', async () => {
			const response = await request(app.getHttpServer()).get('/auth/v1/health').expect(200);

			expect(response.body).not.toHaveProperty('uptime');
			expect(response.body).not.toHaveProperty('memory');
			expect(response.body).not.toHaveProperty('version');
			expect(response.body).not.toHaveProperty('timestamp');
			expect(response.body).not.toHaveProperty('services');
		});

		it('should return 503 when database is unhealthy', async () => {
			mockDataSource.query.mockRejectedValueOnce(new Error('Connection refused'));

			const response = await request(app.getHttpServer()).get('/auth/v1/health').expect(503);

			expect(response.body.status).toBe('error');
			// Pas de fuite des details services dans la reponse publique d'erreur.
			expect(response.body).not.toHaveProperty('services');
		});
	});

	describe('GET /auth/v1/health/live', () => {
		it('should return only { status: "alive" } without checking dependencies or leaking metadata', async () => {
			const response = await request(app.getHttpServer()).get('/auth/v1/health/live').expect(200);

			expect(response.body).toEqual({ status: 'alive' });
			expect(response.body).not.toHaveProperty('uptime');
			expect(response.body).not.toHaveProperty('version');
			expect(response.body).not.toHaveProperty('timestamp');
		});
	});
});

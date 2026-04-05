import { INestApplication } from '@nestjs/common';
import { JwtAuthGuard } from '../src/modules/tokens/guards/jwt-auth.guard';
import { CacheService } from '../src/modules/cache';
import { PhoneAuthenticationService } from '../src/modules/phone-auth/services/phone-authentication.service';
import { TokensService } from '../src/modules/tokens/services/tokens.service';
import { JwtService } from '@nestjs/jwt';
import { PhoneVerificationService } from '../src/modules/phone-verification/services/phone-verification/phone-verification.service';
import { TwoFactorAuthenticationService } from '../src/modules/two-factor-authentication/services/two-factor-authentication.service';
import { DevicesService } from '../src/modules/devices/services/devices.service';
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
		it('should bootstrap the application successfully', () => {
			expect(app).toBeDefined();
			expect(app.getHttpServer()).toBeDefined();
		});

		it('should have the correct environment setup', () => {
			expect(process.env.NODE_ENV).toBe('test');
		});
	});

	describe('Health Check', () => {
		it('should return application info', async () => {
			const response = await request(app.getHttpServer()).get('/auth/v1/health').expect(200);
			expect(response).toBeDefined();
			expect(response.body).toBeDefined();
			expect(response.body.status).toBeDefined();
			expect(response.body.timestamp).toBeDefined();
			expect(response.body.services).toBeDefined();
		});
	});
});

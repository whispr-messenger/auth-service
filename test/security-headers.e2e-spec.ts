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

// WHISPR-1347 : verifie que helmet pose bien les entetes de securite HTTP
// (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
describe('Security headers (e2e)', () => {
	let app: INestApplication;

	beforeEach(async () => {
		const moduleFixture = await createTestModule({
			providers: [
				{ provide: PhoneAuthenticationService, useValue: { register: jest.fn() } },
				{ provide: PhoneVerificationService, useValue: { sendVerificationCode: jest.fn() } },
				{ provide: TokensService, useValue: { generateToken: jest.fn() } },
				{ provide: TwoFactorAuthenticationService, useValue: { generateSecret: jest.fn() } },
				{ provide: DevicesService, useValue: { registerDevice: jest.fn() } },
				{ provide: JwtService, useValue: { sign: jest.fn() } },
				{
					provide: DataSource,
					useValue: { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) },
				},
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
	});

	afterEach(async () => {
		if (app) {
			await app.close();
		}
	});

	it('should set X-Content-Type-Options to nosniff', async () => {
		const response = await request(app.getHttpServer()).get('/auth/v1/health/live').expect(200);

		expect(response.headers['x-content-type-options']).toBe('nosniff');
	});

	it('should set X-Frame-Options to deny clickjacking', async () => {
		const response = await request(app.getHttpServer()).get('/auth/v1/health/live').expect(200);

		expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
	});

	it('should set a Referrer-Policy header', async () => {
		const response = await request(app.getHttpServer()).get('/auth/v1/health/live').expect(200);

		expect(response.headers['referrer-policy']).toBeDefined();
	});

	it('should set a Content-Security-Policy header', async () => {
		const response = await request(app.getHttpServer()).get('/auth/v1/health/live').expect(200);

		expect(response.headers['content-security-policy']).toBeDefined();
		expect(response.headers['content-security-policy']).toContain("default-src 'self'");
	});

	it('should remove the X-Powered-By header to hide framework fingerprint', async () => {
		const response = await request(app.getHttpServer()).get('/auth/v1/health/live').expect(200);

		expect(response.headers['x-powered-by']).toBeUndefined();
	});
});

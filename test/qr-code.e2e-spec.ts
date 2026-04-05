/**
 * E2E tests for the QR code authentication endpoints.
 *
 * Verifies the observable HTTP behaviour of:
 * - POST /auth/v1/qr-code/challenge/:deviceId — generates a QR challenge (JWT-protected)
 * - POST /auth/v1/qr-code/scan                — logs in by scanning a QR code (public)
 *
 * POST /challenge/:deviceId requires a valid JWT; POST /scan is public but
 * validates the challenge payload and extracts the device fingerprint from
 * request headers.
 */
import { BadRequestException, INestApplication } from '@nestjs/common';
import { QuickResponseCodeService } from '../src/modules/devices/quick-response-code/services/quick-response-code.service';
import { TokensService } from '../src/modules/tokens/services/tokens.service';
import { JwtPayload } from '../src/modules/tokens/types/jwt-payload.interface';
import { createTestApp } from './helpers/create-test-app';
import { createTestModule } from './helpers/create-test-module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

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

const mockQrCodeService = {
	generateQRChallenge: jest.fn().mockResolvedValue({
		challenge: 'signed-jwt-challenge-string',
		expiresIn: 300,
	}),
	scanLogin: jest.fn().mockResolvedValue({
		accessToken: 'mock-access-token',
		refreshToken: 'mock-refresh-token',
		expiresIn: 3600,
	}),
};

describe('QR code authentication endpoints (e2e)', () => {
	let app: INestApplication;

	beforeEach(async () => {
		const moduleFixture = await createTestModule({
			providers: [
				{ provide: QuickResponseCodeService, useValue: mockQrCodeService },
				{ provide: TokensService, useValue: mockTokensService },
			],
		});

		app = await createTestApp(moduleFixture);
	});

	afterEach(async () => {
		if (app) await app.close();
		jest.clearAllMocks();
	});

	// ---------------------------------------------------------------
	// POST /auth/v1/qr-code/challenge/:deviceId
	// ---------------------------------------------------------------
	describe('POST /auth/v1/qr-code/challenge/:deviceId', () => {
		it('returns 201 with challenge when authenticated', async () => {
			const { body } = await request(app.getHttpServer())
				.post('/auth/v1/qr-code/challenge/device-id')
				.set('Authorization', 'Bearer valid.access.token')
				.expect(201);

			expect(body).toEqual({
				challenge: 'signed-jwt-challenge-string',
				expiresIn: 300,
			});
			expect(mockQrCodeService.generateQRChallenge).toHaveBeenCalledWith('device-id');
		});

		it('returns 401 without Authorization header', async () => {
			await request(app.getHttpServer()).post('/auth/v1/qr-code/challenge/device-id').expect(401);
		});
	});

	// ---------------------------------------------------------------
	// POST /auth/v1/qr-code/scan
	// ---------------------------------------------------------------
	describe('POST /auth/v1/qr-code/scan', () => {
		it('returns 200 with token pair on valid scan', async () => {
			const { body } = await request(app.getHttpServer())
				.post('/auth/v1/qr-code/scan')
				.send({
					challenge: 'valid-challenge-jwt',
					authenticatedDeviceId: '550e8400-e29b-41d4-a716-446655440000',
				})
				.expect(200);

			expect(body).toEqual({
				accessToken: 'mock-access-token',
				refreshToken: 'mock-refresh-token',
				expiresIn: 3600,
			});
			expect(mockQrCodeService.scanLogin).toHaveBeenCalled();
		});

		it('returns 400 when challenge is invalid or expired', async () => {
			mockQrCodeService.scanLogin.mockRejectedValueOnce(new BadRequestException('Challenge expired'));

			await request(app.getHttpServer())
				.post('/auth/v1/qr-code/scan')
				.send({
					challenge: 'expired-challenge-jwt',
					authenticatedDeviceId: '550e8400-e29b-41d4-a716-446655440000',
				})
				.expect(400);
		});
	});
});

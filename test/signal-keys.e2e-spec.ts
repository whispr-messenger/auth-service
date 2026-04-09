/**
 * E2E tests for the Signal Protocol key management endpoints.
 *
 * Verifies the observable HTTP behaviour of:
 *
 * PUBLIC (no JWT required):
 * - GET  /auth/v1/signal/keys/:userId/devices/:deviceId         — Retrieve key bundle
 * - GET  /auth/v1/signal/keys/:userId/devices/:deviceId/status  — Get prekey status
 *
 * PROTECTED (JWT required):
 * - POST   /auth/v1/signal/keys/signed-prekey    — Upload signed prekey
 * - POST   /auth/v1/signal/keys/prekeys          — Upload batch of one-time prekeys
 * - GET    /auth/v1/signal/keys/recommendations   — Get key rotation recommendations
 * - DELETE /auth/v1/signal/keys/device/:deviceId  — Delete keys for a device
 * - DELETE /auth/v1/signal/keys                   — Delete all keys for user
 *
 * SignalKeysController delegates to SignalPreKeyBundleService.
 * SignalKeysManagementController delegates to SignalKeyRotationService,
 * SignalKeyValidationService, SignalKeyStorageService, and DevicesService.
 */
import { INestApplication, NotFoundException } from '@nestjs/common';
import { TokensService } from '../src/modules/tokens/services/tokens.service';
import { JwtPayload } from '../src/modules/tokens/types/jwt-payload.interface';
import { SignalPreKeyBundleService } from '../src/modules/signal/services/signal-prekey-bundle.service';
import { SignalKeyRotationService } from '../src/modules/signal/services/signal-key-rotation.service';
import { SignalKeyValidationService } from '../src/modules/signal/services/signal-key-validation.service';
import { SignalKeyStorageService } from '../src/modules/signal/services/signal-key-storage.service';
import { DevicesService } from '../src/modules/devices/services/devices.service';
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

const mockBundleService = {
	getBundleForUser: jest.fn().mockResolvedValue({
		userId: 'target-user-id',
		deviceId: 'target-device-id',
		identityKey: 'base64-identity-key',
		signedPreKey: {
			keyId: 1,
			publicKey: 'base64-signed-prekey',
			signature: 'base64-sig',
		},
		preKey: {
			keyId: 100,
			publicKey: 'base64-prekey',
		},
	}),
	getPreKeyStatus: jest.fn().mockResolvedValue({
		userId: 'target-user-id',
		availablePreKeys: 50,
		isLow: false,
		hasActiveSignedPreKey: true,
		totalPreKeys: 50,
		recommendedUpload: 0,
	}),
};

const mockRotationService = {
	rotateSignedPreKey: jest.fn().mockResolvedValue(undefined),
	replenishPreKeys: jest.fn().mockResolvedValue(undefined),
	getRotationRecommendations: jest.fn().mockResolvedValue({
		needsPreKeyReplenishment: false,
		needsSignedPreKeyRotation: false,
		availablePreKeys: 80,
		recommendedPreKeyUpload: 0,
		signedPreKeyExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
	}),
};

const mockValidationService = {
	validateSignedPreKey: jest.fn(),
	validateSignedPreKeyIdUniqueness: jest.fn().mockResolvedValue(undefined),
	validatePreKeys: jest.fn(),
};

const mockStorageService = {
	deleteAllKeysForDevice: jest.fn().mockResolvedValue(undefined),
	deleteAllKeysForUser: jest.fn().mockResolvedValue(undefined),
};

const mockDevicesService = {
	revokeDevice: jest.fn().mockResolvedValue(undefined),
	getUserDevices: jest.fn().mockResolvedValue([]),
	findById: jest.fn().mockResolvedValue(null),
};

describe('Signal key management endpoints (e2e)', () => {
	let app: INestApplication;

	beforeEach(async () => {
		const moduleFixture = await createTestModule({
			providers: [
				{ provide: SignalPreKeyBundleService, useValue: mockBundleService },
				{ provide: SignalKeyRotationService, useValue: mockRotationService },
				{ provide: SignalKeyValidationService, useValue: mockValidationService },
				{ provide: SignalKeyStorageService, useValue: mockStorageService },
				{ provide: DevicesService, useValue: mockDevicesService },
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
	// GET /auth/v1/signal/keys/:userId/devices/:deviceId
	// ---------------------------------------------------------------
	describe('GET /auth/v1/signal/keys/:userId/devices/:deviceId', () => {
		it('returns 200 with key bundle (public endpoint, no JWT needed)', async () => {
			const { body } = await request(app.getHttpServer())
				.get('/auth/v1/signal/keys/target-user-id/devices/target-device-id')
				.expect(200);

			expect(body).toHaveProperty('identityKey', 'base64-identity-key');
			expect(body).toHaveProperty('signedPreKey');
			expect(body.signedPreKey).toEqual({
				keyId: 1,
				publicKey: 'base64-signed-prekey',
				signature: 'base64-sig',
			});
			expect(body).toHaveProperty('preKey');
			expect(body.preKey).toEqual({
				keyId: 100,
				publicKey: 'base64-prekey',
			});
			expect(mockBundleService.getBundleForUser).toHaveBeenCalledWith(
				'target-user-id',
				'target-device-id'
			);
		});

		it('returns 404 when key bundle is not found', async () => {
			mockBundleService.getBundleForUser.mockRejectedValueOnce(
				new NotFoundException('Key bundle not found')
			);

			await request(app.getHttpServer())
				.get('/auth/v1/signal/keys/unknown-user/devices/unknown-device')
				.expect(404);
		});
	});

	// ---------------------------------------------------------------
	// GET /auth/v1/signal/keys/:userId/devices/:deviceId/status
	// ---------------------------------------------------------------
	describe('GET /auth/v1/signal/keys/:userId/devices/:deviceId/status', () => {
		it('returns 200 with prekey status (public endpoint)', async () => {
			const { body } = await request(app.getHttpServer())
				.get('/auth/v1/signal/keys/target-user-id/devices/target-device-id/status')
				.expect(200);

			expect(body).toHaveProperty('availablePreKeys', 50);
			expect(body).toHaveProperty('isLow', false);
			expect(body).toHaveProperty('hasActiveSignedPreKey', true);
			expect(mockBundleService.getPreKeyStatus).toHaveBeenCalledWith(
				'target-user-id',
				'target-device-id'
			);
		});
	});

	// ---------------------------------------------------------------
	// POST /auth/v1/signal/keys/signed-prekey
	// ---------------------------------------------------------------
	describe('POST /auth/v1/signal/keys/signed-prekey', () => {
		const validSignedPreKey = {
			keyId: 2,
			publicKey: 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3',
			signature: 'c2lnbmF0dXJlLWJhc2U2NC1lbmNvZGVkLXZhbHVl',
		};

		it('returns 201 with a valid JWT', async () => {
			await request(app.getHttpServer())
				.post('/auth/v1/signal/keys/signed-prekey')
				.set('Authorization', 'Bearer valid.access.token')
				.send(validSignedPreKey)
				.expect(201);

			expect(mockValidationService.validateSignedPreKey).toHaveBeenCalled();
			expect(mockValidationService.validateSignedPreKeyIdUniqueness).toHaveBeenCalledWith(
				'user-id',
				'device-id',
				validSignedPreKey.keyId
			);
			expect(mockRotationService.rotateSignedPreKey).toHaveBeenCalledWith(
				'user-id',
				'device-id',
				expect.objectContaining({ keyId: validSignedPreKey.keyId })
			);
		});

		it('returns 401 without an Authorization header', async () => {
			await request(app.getHttpServer())
				.post('/auth/v1/signal/keys/signed-prekey')
				.send(validSignedPreKey)
				.expect(401);
		});

		it('returns 401 with an invalid token', async () => {
			await request(app.getHttpServer())
				.post('/auth/v1/signal/keys/signed-prekey')
				.set('Authorization', 'Bearer invalid-token')
				.send(validSignedPreKey)
				.expect(401);
		});
	});

	// ---------------------------------------------------------------
	// POST /auth/v1/signal/keys/prekeys
	// ---------------------------------------------------------------
	describe('POST /auth/v1/signal/keys/prekeys', () => {
		const validPreKeys = {
			preKeys: [
				{ keyId: 100, publicKey: 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3' },
				{ keyId: 101, publicKey: 'enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmExMjM0NTY' },
			],
		};

		it('returns 201 with a valid JWT and batch of prekeys', async () => {
			const { body } = await request(app.getHttpServer())
				.post('/auth/v1/signal/keys/prekeys')
				.set('Authorization', 'Bearer valid.access.token')
				.send(validPreKeys)
				.expect(201);

			expect(body).toHaveProperty('message', 'PreKeys uploaded successfully');
			expect(body).toHaveProperty('uploaded', 2);
			expect(mockValidationService.validatePreKeys).toHaveBeenCalled();
			expect(mockRotationService.replenishPreKeys).toHaveBeenCalledWith(
				'user-id',
				'device-id',
				expect.any(Array)
			);
		});

		it('returns 401 without an Authorization header', async () => {
			await request(app.getHttpServer())
				.post('/auth/v1/signal/keys/prekeys')
				.send(validPreKeys)
				.expect(401);
		});
	});

	// ---------------------------------------------------------------
	// GET /auth/v1/signal/keys/recommendations
	// ---------------------------------------------------------------
	describe('GET /auth/v1/signal/keys/recommendations', () => {
		it('returns 200 with rotation recommendations', async () => {
			const { body } = await request(app.getHttpServer())
				.get('/auth/v1/signal/keys/recommendations')
				.set('Authorization', 'Bearer valid.access.token')
				.expect(200);

			expect(body).toHaveProperty('needsPreKeyReplenishment', false);
			expect(body).toHaveProperty('needsSignedPreKeyRotation', false);
			expect(body).toHaveProperty('availablePreKeys', 80);
			expect(body).toHaveProperty('recommendedPreKeyUpload', 0);
			expect(mockRotationService.getRotationRecommendations).toHaveBeenCalledWith(
				'user-id',
				'device-id'
			);
		});

		it('returns 401 without an Authorization header', async () => {
			await request(app.getHttpServer()).get('/auth/v1/signal/keys/recommendations').expect(401);
		});
	});

	// ---------------------------------------------------------------
	// DELETE /auth/v1/signal/keys/device/:deviceId
	// ---------------------------------------------------------------
	describe('DELETE /auth/v1/signal/keys/device/:deviceId', () => {
		it('returns 204 with a valid JWT', async () => {
			await request(app.getHttpServer())
				.delete('/auth/v1/signal/keys/device/target-device-id')
				.set('Authorization', 'Bearer valid.access.token')
				.expect(204);

			expect(mockDevicesService.revokeDevice).toHaveBeenCalledWith('user-id', 'target-device-id');
			expect(mockStorageService.deleteAllKeysForDevice).toHaveBeenCalledWith(
				'user-id',
				'target-device-id'
			);
		});

		it('returns 401 without an Authorization header', async () => {
			await request(app.getHttpServer())
				.delete('/auth/v1/signal/keys/device/target-device-id')
				.expect(401);
		});
	});

	// ---------------------------------------------------------------
	// DELETE /auth/v1/signal/keys
	// ---------------------------------------------------------------
	describe('DELETE /auth/v1/signal/keys', () => {
		it('returns 204 with a valid JWT', async () => {
			await request(app.getHttpServer())
				.delete('/auth/v1/signal/keys')
				.set('Authorization', 'Bearer valid.access.token')
				.expect(204);

			expect(mockStorageService.deleteAllKeysForUser).toHaveBeenCalledWith('user-id');
		});

		it('returns 401 without an Authorization header', async () => {
			await request(app.getHttpServer()).delete('/auth/v1/signal/keys').expect(401);
		});
	});
});

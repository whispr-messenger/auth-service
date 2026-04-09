/**
 * E2E tests for the Devices endpoints.
 *
 * Verifies the observable HTTP behaviour of:
 * - GET    /auth/device            — returns all devices for the authenticated user
 * - DELETE /auth/device/:deviceId  — revokes/deletes a specific device
 *
 * Both endpoints require JWT authentication.
 */
import { INestApplication, NotFoundException } from '@nestjs/common';
import { DevicesService } from '../src/modules/devices/services/devices.service';
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

const mockDevicesService = {
	getUserDevices: jest.fn().mockResolvedValue([
		{
			id: 'device-1',
			deviceName: 'iPhone 15',
			deviceType: 'mobile',
			lastActive: new Date().toISOString(),
			isVerified: true,
			isActive: true,
			createdAt: new Date().toISOString(),
		},
		{
			id: 'device-2',
			deviceName: 'MacBook Pro',
			deviceType: 'desktop',
			lastActive: new Date().toISOString(),
			isVerified: true,
			isActive: true,
			createdAt: new Date().toISOString(),
		},
	]),
	revokeDevice: jest.fn().mockResolvedValue(undefined),
	getDevice: jest.fn().mockResolvedValue({ id: 'device-1', deviceName: 'iPhone 15', deviceType: 'mobile' }),
};

describe('Devices endpoints (e2e)', () => {
	let app: INestApplication;

	beforeEach(async () => {
		const moduleFixture = await createTestModule({
			providers: [
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
	// GET /auth/device
	// ---------------------------------------------------------------
	describe('GET /auth/device', () => {
		it('returns 200 with the device list when authenticated', async () => {
			const { body } = await request(app.getHttpServer())
				.get('/auth/device')
				.set('Authorization', 'Bearer valid.access.token')
				.expect(200);

			expect(body).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						id: 'device-1',
						deviceName: 'iPhone 15',
						deviceType: 'mobile',
					}),
					expect.objectContaining({
						id: 'device-2',
						deviceName: 'MacBook Pro',
						deviceType: 'desktop',
					}),
				])
			);
			expect(mockDevicesService.getUserDevices).toHaveBeenCalledWith(validPayload.sub);
		});

		it('returns 401 without Authorization header', async () => {
			await request(app.getHttpServer()).get('/auth/device').expect(401);
		});
	});

	// ---------------------------------------------------------------
	// DELETE /auth/device/:deviceId
	// ---------------------------------------------------------------
	describe('DELETE /auth/device/:deviceId', () => {
		it('returns 204 on successful revocation', async () => {
			await request(app.getHttpServer())
				.delete('/auth/device/device-1')
				.set('Authorization', 'Bearer valid.access.token')
				.expect(204);

			expect(mockDevicesService.revokeDevice).toHaveBeenCalledWith(validPayload.sub, 'device-1');
		});

		it('returns 401 without Authorization header', async () => {
			await request(app.getHttpServer()).delete('/auth/device/device-1').expect(401);
		});

		it('returns 404 when device not found', async () => {
			mockDevicesService.revokeDevice.mockRejectedValueOnce(new NotFoundException('Device not found'));

			await request(app.getHttpServer())
				.delete('/auth/device/nonexistent-device')
				.set('Authorization', 'Bearer valid.access.token')
				.expect(404);
		});
	});
});

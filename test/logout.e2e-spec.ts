/**
 * E2E tests for POST /auth/v1/logout.
 *
 * Verifies the observable HTTP behaviour of the logout endpoint, and in
 * particular that an authenticated user cannot revoke a session that belongs
 * to a different user (WHISPR-763).
 */
import { ForbiddenException, INestApplication, NotFoundException } from '@nestjs/common';
import { DevicesService } from '../src/modules/devices/services/devices.service';
import { DeviceActivityService } from '../src/modules/devices/services/device-activity/device-activity.service';
import { TokensService } from '../src/modules/tokens/services/tokens.service';
import { JwtPayload } from '../src/modules/tokens/types/jwt-payload.interface';
import { createTestApp } from './helpers/create-test-app';
import { createTestModule } from './helpers/create-test-module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

const AUTH_USER_ID = 'user-A';
const AUTH_DEVICE_ID = 'device-A';
const OTHER_OWN_DEVICE_ID = 'device-A-other';
const VICTIM_DEVICE_ID = 'device-B';

const validPayload: JwtPayload = {
	sub: AUTH_USER_ID,
	jti: 'access-token-jti-uuid',
	iat: Math.floor(Date.now() / 1000),
	exp: Math.floor(Date.now() / 1000) + 3600,
	deviceId: AUTH_DEVICE_ID,
	scope: 'user',
	fingerprint: 'abc123',
};

describe('Logout endpoint (e2e)', () => {
	let app: INestApplication;

	const mockTokensService = {
		validateToken: jest.fn().mockReturnValue(validPayload),
		isTokenRevoked: jest.fn().mockResolvedValue(false),
		isDeviceRevoked: jest.fn().mockResolvedValue(false),
		revokeAllTokensForDevice: jest.fn().mockResolvedValue(undefined),
	};

	const mockDevicesService = {
		// Permissive default: only VICTIM_DEVICE_ID is rejected.
		assertDeviceBelongsToUser: jest.fn((userId: string, deviceId: string) => {
			if (userId === AUTH_USER_ID && deviceId === VICTIM_DEVICE_ID) {
				return Promise.reject(
					new ForbiddenException('Device does not belong to the authenticated user')
				);
			}
			return Promise.resolve();
		}),
	};

	const mockDeviceActivityService = {
		updateLastActive: jest.fn().mockResolvedValue(undefined),
	};

	beforeEach(async () => {
		const moduleFixture = await createTestModule({
			providers: [
				{ provide: TokensService, useValue: mockTokensService },
				{ provide: DevicesService, useValue: mockDevicesService },
				{ provide: DeviceActivityService, useValue: mockDeviceActivityService },
			],
		});

		app = await createTestApp(moduleFixture);
	});

	afterEach(async () => {
		if (app) await app.close();
		jest.clearAllMocks();
	});

	it('returns 204 and revokes the current device when no deviceId is provided', async () => {
		await request(app.getHttpServer())
			.post('/auth/v1/logout')
			.set('Authorization', 'Bearer valid.access.token')
			.send({})
			.expect(204);

		expect(mockDevicesService.assertDeviceBelongsToUser).not.toHaveBeenCalled();
		expect(mockTokensService.revokeAllTokensForDevice).toHaveBeenCalledWith(AUTH_DEVICE_ID);
	});

	it('returns 204 without ownership check when the target deviceId equals the current one', async () => {
		await request(app.getHttpServer())
			.post('/auth/v1/logout')
			.set('Authorization', 'Bearer valid.access.token')
			.send({ deviceId: AUTH_DEVICE_ID })
			.expect(204);

		expect(mockDevicesService.assertDeviceBelongsToUser).not.toHaveBeenCalled();
		expect(mockTokensService.revokeAllTokensForDevice).toHaveBeenCalledWith(AUTH_DEVICE_ID);
	});

	it('returns 204 when the target deviceId is another device owned by the same user', async () => {
		await request(app.getHttpServer())
			.post('/auth/v1/logout')
			.set('Authorization', 'Bearer valid.access.token')
			.send({ deviceId: OTHER_OWN_DEVICE_ID })
			.expect(204);

		expect(mockDevicesService.assertDeviceBelongsToUser).toHaveBeenCalledWith(
			AUTH_USER_ID,
			OTHER_OWN_DEVICE_ID
		);
		expect(mockTokensService.revokeAllTokensForDevice).toHaveBeenCalledWith(OTHER_OWN_DEVICE_ID);
	});

	it('returns 403 and does NOT revoke the session when the target deviceId belongs to another user', async () => {
		await request(app.getHttpServer())
			.post('/auth/v1/logout')
			.set('Authorization', 'Bearer valid.access.token')
			.send({ deviceId: VICTIM_DEVICE_ID })
			.expect(403);

		expect(mockDevicesService.assertDeviceBelongsToUser).toHaveBeenCalledWith(
			AUTH_USER_ID,
			VICTIM_DEVICE_ID
		);
		expect(mockTokensService.revokeAllTokensForDevice).not.toHaveBeenCalled();
		expect(mockDeviceActivityService.updateLastActive).not.toHaveBeenCalled();
	});

	it('ignores a userId sent in the body (field stripped by validation whitelist)', async () => {
		await request(app.getHttpServer())
			.post('/auth/v1/logout')
			.set('Authorization', 'Bearer valid.access.token')
			.send({ userId: 'spoofed-user-id' })
			.expect(204);

		expect(mockDevicesService.assertDeviceBelongsToUser).not.toHaveBeenCalled();
		// The service logout() receives userId from the JWT (req.user.sub), never from the body.
		expect(mockTokensService.revokeAllTokensForDevice).toHaveBeenCalledWith(AUTH_DEVICE_ID);
	});

	it('returns 204 even when updateLastActive throws NotFoundException (web session)', async () => {
		mockDeviceActivityService.updateLastActive.mockRejectedValueOnce(
			new NotFoundException('Device not found')
		);

		await request(app.getHttpServer())
			.post('/auth/v1/logout')
			.set('Authorization', 'Bearer valid.access.token')
			.send({})
			.expect(204);

		expect(mockTokensService.revokeAllTokensForDevice).toHaveBeenCalledWith(AUTH_DEVICE_ID);
	});
});

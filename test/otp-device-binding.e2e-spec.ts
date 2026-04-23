/**
 * WHISPR-762 — OTP impersonation regression test.
 *
 * Scenario protected against:
 *   1. Device A calls POST /verify/login/request with its own deviceId, for a
 *      phone number that belongs to a real user.
 *   2. Device B learns (or guesses) the verificationId and the SMS code that
 *      arrived on the victim's phone.
 *   3. Device B must NOT be able to confirm the OTP nor login as the victim.
 *
 * The binding is backward-compatible: verifications created without a deviceId
 * remain usable from any device (legacy clients).
 */
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserAuth } from '../src/modules/common/entities/user-auth.entity';
import { Device } from '../src/modules/devices/entities/device.entity';
import { CacheService } from '../src/modules/cache';
import { JwtAuthGuard } from '../src/modules/tokens/guards/jwt-auth.guard';
import { TokensService } from '../src/modules/tokens/services/tokens.service';
import { DeviceRepository } from '../src/modules/devices/repositories/device.repository';
import { PreKeyRepository } from '../src/modules/signal/repositories/prekey.repository';
import { SignedPreKeyRepository } from '../src/modules/signal/repositories/signed-prekey.repository';
import { IdentityKeyRepository } from '../src/modules/signal/repositories/identity-key.repository';
import { DeviceRegistrationService } from '../src/modules/devices/services/device-registration/device-registration.service';
import { createTestModule } from './helpers/create-test-module';
import { createTestApp } from './helpers/create-test-app';
import { HASHED_VERIFICATION_CODE, VERIFICATION_CODE } from './fixtures/phone-verification';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

const PHONE_NUMBER = '+33612345678';
const VERIFICATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const DEVICE_A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const DEVICE_B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

const EXISTING_USER = {
	id: 'existing-user-id',
	phoneNumber: PHONE_NUMBER,
	twoFactorEnabled: false,
	lastAuthenticatedAt: new Date(),
};

const EXISTING_DEVICE = {
	id: 'existing-device-id',
	userId: EXISTING_USER.id,
	name: 'Test Device',
};

describe('OTP Device Binding (e2e) — WHISPR-762', () => {
	let app: INestApplication;

	const mockDeviceRegistrationService = {
		registerDevice: jest.fn().mockResolvedValue(EXISTING_DEVICE),
	};

	const mockUserAuthRepository = {
		find: jest.fn(),
		findOne: jest.fn().mockResolvedValue(EXISTING_USER),
		save: jest.fn().mockImplementation((user) => Promise.resolve({ ...EXISTING_USER, ...user })),
		create: jest.fn().mockImplementation((u) => u),
		delete: jest.fn(),
		update: jest.fn(),
	};

	const mockDeviceRepository = {
		find: jest.fn(),
		findOne: jest.fn().mockResolvedValue(EXISTING_DEVICE),
		save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'existing-device-id', ...d })),
		create: jest.fn().mockImplementation((d) => ({ id: 'existing-device-id', ...d })),
		delete: jest.fn(),
		update: jest.fn(),
	};

	const mockSignedPreKeyRepository = {
		find: jest.fn(),
		findOne: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		delete: jest.fn(),
		update: jest.fn(),
		upsertSignedPreKey: jest.fn(),
		findActiveByUserIdAndDeviceId: jest.fn(),
		deleteByUserId: jest.fn(),
		deleteByUserIdAndDeviceId: jest.fn(),
	};

	const mockPreKeyRepository = {
		find: jest.fn(),
		findOne: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		delete: jest.fn(),
		update: jest.fn(),
		replacePreKeys: jest.fn(),
		getRandomUnusedPreKey: jest.fn(),
		countUnusedByUserIdAndDeviceId: jest.fn(),
		markAsUsed: jest.fn(),
		deleteByUserId: jest.fn(),
		deleteByUserIdAndDeviceId: jest.fn(),
	};

	const mockIdentityKeyRepository = {
		find: jest.fn(),
		findOne: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		delete: jest.fn(),
		update: jest.fn(),
		upsertIdentityKey: jest.fn(),
		findByUserIdAndDeviceId: jest.fn(),
		deleteByUserId: jest.fn(),
		deleteByUserIdAndDeviceId: jest.fn(),
	};

	const mockCacheService = {
		get: jest.fn(),
		set: jest.fn().mockResolvedValue(undefined),
		del: jest.fn().mockResolvedValue(undefined),
	};

	const mockTokensService = {
		generateTokenPair: jest.fn().mockResolvedValue({
			accessToken: 'test-access-token',
			refreshToken: 'test-refresh-token',
		}),
		clearDeviceRevocation: jest.fn().mockResolvedValue(undefined),
	};

	function setupBoundVerificationCache(opts: {
		boundDeviceId?: string;
		verified?: boolean;
		purpose?: 'login' | 'registration';
	}) {
		const { boundDeviceId, verified = false, purpose = 'login' } = opts;
		mockCacheService.get.mockImplementation((key: string) => {
			if (
				key.startsWith('phone_verification_confirmed:') ||
				key.startsWith('phone_verification:') ||
				key.startsWith('verification:')
			) {
				return Promise.resolve({
					phoneNumber: PHONE_NUMBER,
					hashedCode: HASHED_VERIFICATION_CODE,
					attempts: 0,
					purpose,
					verified,
					expiresAt: Date.now() + 600000,
					...(boundDeviceId ? { deviceId: boundDeviceId } : {}),
				});
			}
			// Rate limit keys -> no previous counter
			return Promise.resolve(null);
		});
	}

	async function buildApp(): Promise<INestApplication> {
		const moduleFixture = await createTestModule({
			providers: [
				{ provide: getRepositoryToken(UserAuth), useValue: mockUserAuthRepository },
				{ provide: getRepositoryToken(Device), useValue: mockDeviceRepository },
				{ provide: CacheService, useValue: mockCacheService },
				{ provide: TokensService, useValue: mockTokensService },
				{ provide: DeviceRegistrationService, useValue: mockDeviceRegistrationService },
				{ provide: DeviceRepository, useValue: mockDeviceRepository },
				{ provide: PreKeyRepository, useValue: mockPreKeyRepository },
				{ provide: SignedPreKeyRepository, useValue: mockSignedPreKeyRepository },
				{ provide: IdentityKeyRepository, useValue: mockIdentityKeyRepository },
			],
			guards: [{ guard: JwtAuthGuard, useValue: { canActivate: () => true } }],
		});

		return createTestApp(moduleFixture);
	}

	beforeEach(async () => {
		app = await buildApp();
	});

	afterEach(async () => {
		if (app) await app.close();
		jest.clearAllMocks();
	});

	describe('POST /auth/verify/login/confirm', () => {
		it('rejects confirmation from a different device than the one that requested the OTP', async () => {
			setupBoundVerificationCache({ boundDeviceId: DEVICE_A, verified: false });

			const response = await request(app.getHttpServer()).post('/auth/v1/verify/login/confirm').send({
				verificationId: VERIFICATION_ID,
				code: VERIFICATION_CODE,
				deviceId: DEVICE_B,
			});

			expect(response.status).toBe(400);
			expect(response.body.message).toMatch(/Invalid or expired verification code/);
		});

		it('accepts confirmation when the deviceId matches the one that requested the OTP', async () => {
			setupBoundVerificationCache({ boundDeviceId: DEVICE_A, verified: false });

			const response = await request(app.getHttpServer()).post('/auth/v1/verify/login/confirm').send({
				verificationId: VERIFICATION_ID,
				code: VERIFICATION_CODE,
				deviceId: DEVICE_A,
			});

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('verified', true);
		});

		it('remains backward compatible when the session has no deviceId stored (legacy client)', async () => {
			setupBoundVerificationCache({ boundDeviceId: undefined, verified: false });

			const response = await request(app.getHttpServer())
				.post('/auth/v1/verify/login/confirm')
				.send({ verificationId: VERIFICATION_ID, code: VERIFICATION_CODE });

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('verified', true);
		});
	});

	describe('POST /auth/login (consume confirmed OTP)', () => {
		it('rejects login attempt from a different device than the one bound to the OTP', async () => {
			setupBoundVerificationCache({ boundDeviceId: DEVICE_A, verified: true });

			const response = await request(app.getHttpServer())
				.post('/auth/v1/login')
				.send({
					verificationId: VERIFICATION_ID,
					deviceId: DEVICE_B,
					deviceName: 'Attacker Device',
					deviceType: 'mobile',
				})
				.set('User-Agent', 'Attacker Agent');

			expect(response.status).toBe(400);
			expect(response.body.message).toMatch(/Invalid or expired verification code/);
		});

		it('allows login when the consumer deviceId matches the bound one', async () => {
			setupBoundVerificationCache({ boundDeviceId: DEVICE_A, verified: true });

			const response = await request(app.getHttpServer())
				.post('/auth/v1/login')
				.send({
					verificationId: VERIFICATION_ID,
					deviceId: DEVICE_A,
					deviceName: 'Legit Device',
					deviceType: 'mobile',
				})
				.set('User-Agent', 'Test Agent');

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('accessToken');
		});
	});
});

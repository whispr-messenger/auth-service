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
import { JwtAuthGuard } from '../src/modules/tokens/guards/jwt-auth.guard';
import { TokensService } from '../src/modules/tokens/services/tokens.service';
import { DeviceRepository } from '../src/modules/devices/repositories/device.repository';
import { PreKeyRepository } from '../src/modules/signal/repositories/prekey.repository';
import { SignedPreKeyRepository } from '../src/modules/signal/repositories/signed-prekey.repository';
import { IdentityKeyRepository } from '../src/modules/signal/repositories/identity-key.repository';
import { DeviceRegistrationService } from '../src/modules/devices/services/device-registration/device-registration.service';
import { createTestApp } from './helpers/create-test-app';
import { HASHED_VERIFICATION_CODE } from './fixtures/phone-verification';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

const PHONE_NUMBER = '+33612345678';
const HASHED_CODE = HASHED_VERIFICATION_CODE;
const VERIFICATION_ID = '550e8400-e29b-41d4-a716-446655440000';

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

const SIGNAL_KEY_BUNDLE = {
	identityKey: 'base64-identity-key',
	signedPreKey: { keyId: 1, publicKey: 'base64-spk', signature: 'base64-sig' },
	preKeys: [
		{ keyId: 1, publicKey: 'base64-pk1' },
		{ keyId: 2, publicKey: 'base64-pk2' },
	],
};

describe('Login Flow (e2e)', () => {
	let app: INestApplication;

	const mockDeviceRegistrationService = {
		registerDevice: jest.fn().mockResolvedValue(EXISTING_DEVICE),
	};

	const mockUserAuthRepository = {
		find: jest.fn(),
		findOne: jest.fn(),
		save: jest.fn().mockImplementation((user) => Promise.resolve({ ...EXISTING_USER, ...user })),
		create: jest.fn().mockImplementation((u) => u),
		delete: jest.fn(),
		update: jest.fn(),
	};

	const mockDeviceRepository = {
		find: jest.fn(),
		findOne: jest.fn(),
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

	const mockGenericRepository = {
		find: jest.fn(),
		findOne: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		delete: jest.fn(),
		update: jest.fn(),
	};

	const mockCacheService = {
		get: jest.fn(),
		set: jest.fn().mockResolvedValue(undefined),
		del: jest.fn().mockResolvedValue(undefined),
	};

	const mockRedisConfig = {
		health: { isHealthy: true, lastError: null },
		getClient: jest.fn(),
		onModuleDestroy: jest.fn(),
	};

	const mockTokensService = {
		generateTokenPair: jest.fn().mockResolvedValue({
			accessToken: 'test-access-token',
			refreshToken: 'test-refresh-token',
		}),
	};

	function setupVerificationCache(verified: boolean = true) {
		mockCacheService.get.mockImplementation((key: string) => {
			if (key.startsWith('phone_verification_confirmed:')) {
				return Promise.resolve({
					phoneNumber: PHONE_NUMBER,
					hashedCode: HASHED_CODE,
					attempts: 0,
					purpose: 'login',
					verified,
					expiresAt: Date.now() + 600000,
				});
			}
			if (key.startsWith('phone_verification:') || key.startsWith('verification:')) {
				return Promise.resolve({
					phoneNumber: PHONE_NUMBER,
					hashedCode: HASHED_CODE,
					attempts: 0,
					purpose: 'login',
					verified,
					expiresAt: Date.now() + 600000,
				});
			}
			return Promise.resolve(null);
		});
	}

	async function buildApp(): Promise<INestApplication> {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(getRepositoryToken(UserAuth))
			.useValue(mockUserAuthRepository)
			.overrideProvider(getRepositoryToken(Device))
			.useValue(mockDeviceRepository)
			.overrideProvider(getRepositoryToken(PreKey))
			.useValue(mockGenericRepository)
			.overrideProvider(getRepositoryToken(SignedPreKey))
			.useValue(mockGenericRepository)
			.overrideProvider(getRepositoryToken(IdentityKey))
			.useValue(mockGenericRepository)
			.overrideProvider(getRepositoryToken(BackupCode))
			.useValue(mockGenericRepository)
			.overrideProvider(getRepositoryToken(LoginHistory))
			.useValue(mockGenericRepository)
			.overrideProvider(RedisConfig)
			.useValue(mockRedisConfig)
			.overrideProvider(CacheService)
			.useValue(mockCacheService)
			.overrideProvider(TokensService)
			.useValue(mockTokensService)
			.overrideProvider(DeviceRegistrationService)
			.useValue(mockDeviceRegistrationService)
			.overrideProvider(DeviceRepository)
			.useValue(mockDeviceRepository)
			.overrideProvider(PreKeyRepository)
			.useValue(mockPreKeyRepository)
			.overrideProvider(SignedPreKeyRepository)
			.useValue(mockSignedPreKeyRepository)
			.overrideProvider(IdentityKeyRepository)
			.useValue(mockIdentityKeyRepository)
			.overrideGuard(JwtAuthGuard)
			.useValue({ canActivate: () => true })
			.compile();

		const nestApp = await createTestApp(moduleFixture);
		return nestApp;
	}

	beforeEach(async () => {
		setupVerificationCache();

		mockUserAuthRepository.findOne.mockResolvedValue(EXISTING_USER);
		mockDeviceRepository.findOne.mockResolvedValue(EXISTING_DEVICE);
		mockDeviceRegistrationService.registerDevice.mockResolvedValue(EXISTING_DEVICE);

		mockIdentityKeyRepository.upsertIdentityKey.mockResolvedValue({
			id: 'ik-id',
			userId: EXISTING_USER.id,
			deviceId: EXISTING_DEVICE.id,
			publicKey: SIGNAL_KEY_BUNDLE.identityKey,
		});

		mockSignedPreKeyRepository.upsertSignedPreKey.mockResolvedValue({
			id: 'spk-id',
			userId: EXISTING_USER.id,
			deviceId: EXISTING_DEVICE.id,
			keyId: SIGNAL_KEY_BUNDLE.signedPreKey.keyId,
			publicKey: SIGNAL_KEY_BUNDLE.signedPreKey.publicKey,
			signature: SIGNAL_KEY_BUNDLE.signedPreKey.signature,
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		});

		mockPreKeyRepository.replacePreKeys.mockResolvedValue(
			SIGNAL_KEY_BUNDLE.preKeys.map((pk, i) => ({
				id: `pk-id-${i}`,
				userId: EXISTING_USER.id,
				deviceId: EXISTING_DEVICE.id,
				keyId: pk.keyId,
				publicKey: pk.publicKey,
				isOneTime: true,
				isUsed: false,
			}))
		);

		app = await buildApp();
	});

	afterEach(async () => {
		if (app) {
			await app.close();
		}
		jest.clearAllMocks();
	});

	describe('POST /auth/login', () => {
		it('should return 200 with tokens on first login', async () => {
			const response = await request(app.getHttpServer())
				.post('/auth/v1/login')
				.send({
					verificationId: VERIFICATION_ID,
					deviceName: 'Test Device',
					deviceType: 'mobile',
					signalKeyBundle: SIGNAL_KEY_BUNDLE,
				})
				.set('User-Agent', 'Test Agent')
				.expect(200);

			expect(response.body).toHaveProperty('accessToken');
			expect(response.body).toHaveProperty('refreshToken');
		});

		it('should return 200 on re-login with the same device and signal key bundle (no duplicate key error)', async () => {
			const loginPayload = {
				verificationId: VERIFICATION_ID,
				deviceName: 'Test Device',
				deviceType: 'mobile',
				signalKeyBundle: SIGNAL_KEY_BUNDLE,
			};

			const first = await request(app.getHttpServer())
				.post('/auth/v1/login')
				.send(loginPayload)
				.set('User-Agent', 'Test Agent')
				.expect(200);

			expect(first.body).toHaveProperty('accessToken');

			setupVerificationCache();

			const second = await request(app.getHttpServer())
				.post('/auth/v1/login')
				.send(loginPayload)
				.set('User-Agent', 'Test Agent')
				.expect(200);

			expect(second.body).toHaveProperty('accessToken');
			expect(mockSignedPreKeyRepository.upsertSignedPreKey).toHaveBeenCalledTimes(2);
			expect(mockPreKeyRepository.replacePreKeys).toHaveBeenCalledTimes(2);
		});

		it('should return 400 when user is not found', async () => {
			mockUserAuthRepository.findOne.mockResolvedValueOnce(null);

			const response = await request(app.getHttpServer())
				.post('/auth/v1/login')
				.send({ verificationId: VERIFICATION_ID })
				.set('User-Agent', 'Test Agent');

			expect(response.status).toBe(400);
		});
	});
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/modules/app/app.module';
import { ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../src/modules/tokens/guards/jwt-auth.guard';
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
import { PhoneAuthenticationService } from '../src/modules/phone-auth/services/phone-authentication.service';
import { TokensService } from '../src/modules/tokens/services/tokens.service';
import { JwtService } from '@nestjs/jwt';
import { PhoneVerificationService } from '../src/modules/phone-verification/services/phone-verification/phone-verification.service';
import { TwoFactorAuthenticationService } from '../src/modules/two-factor-authentication/services/two-factor-authentication.service';
import { DevicesService } from '../src/modules/devices/services/devices.service';
import { DeviceRepository } from '../src/modules/devices/repositories/device.repository';
import { PreKeyRepository } from '../src/modules/signal/repositories/prekey.repository';
import { SignedPreKeyRepository } from '../src/modules/signal/repositories/signed-prekey.repository';
import { IdentityKeyRepository } from '../src/modules/signal/repositories/identity-key.repository';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('AuthController (e2e)', () => {
	let app: INestApplication;

	const mockRepository = {
		find: jest.fn(),
		findOne: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		delete: jest.fn(),
		update: jest.fn(),
	};

	const mockCacheService = {
		get: jest.fn().mockResolvedValue('ok'),
		set: jest.fn().mockResolvedValue(undefined),
		del: jest.fn().mockResolvedValue(undefined),
	};

	const mockRedisConfig = {
		health: { isHealthy: true, lastError: null },
		getClient: jest.fn(),
		onModuleDestroy: jest.fn(),
	};

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
			const moduleFixture: TestingModule = await Test.createTestingModule({
				imports: [AppModule],
			})
				.overrideProvider(getRepositoryToken(UserAuth))
				.useValue(mockRepository)
				.overrideProvider(getRepositoryToken(Device))
				.useValue(mockRepository)
				.overrideProvider(getRepositoryToken(PreKey))
				.useValue(mockRepository)
				.overrideProvider(getRepositoryToken(SignedPreKey))
				.useValue(mockRepository)
				.overrideProvider(getRepositoryToken(IdentityKey))
				.useValue(mockRepository)
				.overrideProvider(getRepositoryToken(BackupCode))
				.useValue(mockRepository)
				.overrideProvider(getRepositoryToken(LoginHistory))
				.useValue(mockRepository)
				.overrideProvider(RedisConfig)
				.useValue(mockRedisConfig)
				.overrideProvider(CacheService)
				.useValue(mockCacheService)
				.overrideProvider(PhoneAuthenticationService)
				.useValue(mockAuthService)
				.overrideProvider(PhoneVerificationService)
				.useValue(mockVerificationService)
				.overrideProvider(TokensService)
				.useValue(mockTokenService)
				.overrideProvider(TwoFactorAuthenticationService)
				.useValue(mockTwoFactorService)
				.overrideProvider(DevicesService)
				.useValue(mockDeviceService)
				.overrideProvider(DeviceRepository)
				.useValue(mockRepository)
				.overrideProvider(PreKeyRepository)
				.useValue(mockRepository)
				.overrideProvider(SignedPreKeyRepository)
				.useValue(mockRepository)
				.overrideProvider(IdentityKeyRepository)
				.useValue(mockRepository)
				.overrideProvider(JwtService)
				.useValue(mockJwtService)
				.overrideGuard(JwtAuthGuard)
				.useValue({ canActivate: () => true })
				.compile();

			app = moduleFixture.createNestApplication();
			app.useGlobalPipes(new ValidationPipe());
			await app.init();
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
			const response = await request(app.getHttpServer()).get('/health').expect(200);
			expect(response).toBeDefined();
			expect(response.body).toBeDefined();
			expect(response.body.status).toBeDefined();
			expect(response.body.timestamp).toBeDefined();
			expect(response.body.services).toBeDefined();
		});
	});
});

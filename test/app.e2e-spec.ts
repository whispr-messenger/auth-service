import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { AppModule } from '../src/app.module'
import { ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { JwtAuthGuard } from '../src/modules/authentication/guards/jwt-auth.guard'
import { RateLimitGuard } from '../src/modules/authentication/guards/rate-limit.guard'
import { getRepositoryToken } from '@nestjs/typeorm'
import { UserAuth } from '../src/modules/two-factor-authentication/user-auth.entity'
import { Device } from '../src/modules/devices/device.entity'
import { PreKey } from '../src/modules/authentication/entities/prekey.entity'
import { SignedPreKey } from '../src/modules/authentication/entities/signed-prekey.entity'
import { IdentityKey } from '../src/modules/authentication/entities/identity-key.entity'
import { BackupCode } from '../src/modules/authentication/entities/backup-code.entity'
import { LoginHistory } from '../src/modules/authentication/entities/login-history.entity'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { AuthService } from '../src/modules/authentication/services/auth.service'
import { VerificationService } from '../src/modules/authentication/services/verification.service'
import { TokenService } from '../src/modules/authentication/services/token.service'
import { TwoFactorService } from '../src/modules/authentication/services/two-factor.service'
import { DeviceService } from '../src/modules/authentication/services/device.service'
import { JwtService } from '@nestjs/jwt'

describe('AuthController (e2e)', () => {
    let app: INestApplication

    const mockRepository = {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
    }

    const mockCacheManager = {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        reset: jest.fn(),
    }

    const mockAuthService = {
        register: jest.fn(),
        login: jest.fn(),
        validateToken: jest.fn(),
        refreshToken: jest.fn(),
    }

    const mockVerificationService = {
        sendVerificationCode: jest.fn(),
        verifyCode: jest.fn(),
    }

    const mockTokenService = {
        generateToken: jest.fn(),
        validateToken: jest.fn(),
        refreshToken: jest.fn(),
    }

    const mockTwoFactorService = {
        generateSecret: jest.fn(),
        verifyToken: jest.fn(),
    }

    const mockDeviceService = {
        registerDevice: jest.fn(),
        getDevices: jest.fn(),
        removeDevice: jest.fn(),
    }

    const mockJwtService = {
        sign: jest.fn(),
        verify: jest.fn(),
        decode: jest.fn(),
    }

    beforeEach(async () => {
        try {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [AppModule],
                }
            )
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
                .overrideProvider(CACHE_MANAGER)
                .useValue(mockCacheManager)
                .overrideProvider(AuthService)
                .useValue(mockAuthService)
                .overrideProvider(VerificationService)
                .useValue(mockVerificationService)
                .overrideProvider(TokenService)
                .useValue(mockTokenService)
                .overrideProvider(TwoFactorService)
                .useValue(mockTwoFactorService)
                .overrideProvider(DeviceService)
                .useValue(mockDeviceService)
                .overrideProvider(JwtService)
                .useValue(mockJwtService)
                .overrideGuard(JwtAuthGuard)
                .useValue({ canActivate: () => true })
                .overrideGuard(RateLimitGuard)
                .useValue({ canActivate: () => true })
                .compile()

            app = moduleFixture.createNestApplication()
            app.useGlobalPipes(new ValidationPipe())
            await app.init()
        } catch (error) {
            console.error('Failed to initialize test app:', error)
            throw error
        }
    })

    afterEach(async () => {
        if (app) {
            await app.close()
        }
    })

    describe('Application Bootstrap', () => {
        it('should bootstrap the application successfully', () => {
            expect(app).toBeDefined()
            expect(app.getHttpServer()).toBeDefined()
        })

        it('should have the correct environment setup', () => {
            expect(process.env.NODE_ENV).toBe('test')
        })
    })

    describe('Health Check', () => {
        it('should return application info', async () => {
            const response = await request(app.getHttpServer())
                .get('/')
                .expect(200)
            expect(response).toBeDefined()
        })
    })
})

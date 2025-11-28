import { Test, TestingModule } from '@nestjs/testing'
import { VerificationService } from './verification.service'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { SmsService } from './sms.service'
import { BadRequestException, HttpException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'

describe('VerificationService', () => {
    let service: VerificationService

    const mockCacheManager = {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
    }

    const mockSmsService = {
        sendVerificationCode: jest.fn(),
    }

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VerificationService,
                {
                    provide: CACHE_MANAGER,
                    useValue: mockCacheManager,
                },
                {
                    provide: SmsService,
                    useValue: mockSmsService,
                },
            ],
        }).compile()

        service = module.get<VerificationService>(VerificationService)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should be defined', () => {
        expect(service).toBeDefined()
    })

    describe('requestVerification', () => {
        const phoneNumber = '+33123456789'
        const purpose = 'registration' as const

        it('should request verification successfully', async () => {
            mockCacheManager.get.mockResolvedValue(null)
            mockCacheManager.set.mockResolvedValue(undefined)
            mockSmsService.sendVerificationCode.mockResolvedValue(undefined)

            const result = await service.requestVerification(
                phoneNumber,
                purpose
            )

            expect(typeof result).toBe('string')
            expect(mockCacheManager.set).toHaveBeenCalled()
            expect(mockSmsService.sendVerificationCode).toHaveBeenCalledWith(
                phoneNumber,
                expect.any(String),
                purpose
            )
        })
    })

    describe('verifyCode', () => {
        const verificationId = 'test-verification-id'
        const code = '123456'

        it('should verify code successfully', async () => {
            const hashedCode = await bcrypt.hash(code, 10)
            const mockData = JSON.stringify({
                phoneNumber: '+33123456789',
                hashedCode,
                purpose: 'registration',
                attempts: 0,
                expiresAt: Date.now() + 900000,
            })

            mockCacheManager.get.mockResolvedValue(mockData)

            const result = await service.verifyCode(verificationId, code)

            expect(result).toHaveProperty('phoneNumber', '+33123456789')
            expect(result).toHaveProperty('purpose', 'registration')
        })

        it('should throw error for invalid verification ID', async () => {
            mockCacheManager.get.mockResolvedValue(null)

            await expect(
                service.verifyCode(verificationId, code)
            ).rejects.toThrow(BadRequestException)
        })

        it('should throw error for invalid code', async () => {
            const mockData = JSON.stringify({
                phoneNumber: '+33123456789',
                hashedCode: '$2b$10$test-hashed-code',
                purpose: 'registration',
                attempts: 0,
                expiresAt: Date.now() + 900000,
            })

            mockCacheManager.get.mockResolvedValue(mockData)
            mockCacheManager.set.mockResolvedValue(undefined)

            await expect(
                service.verifyCode(verificationId, '000000')
            ).rejects.toThrow(BadRequestException)
        })

        it('should throw error for too many attempts', async () => {
            const mockData = JSON.stringify({
                phoneNumber: '+33123456789',
                hashedCode: '$2b$10$test-hashed-code',
                purpose: 'registration',
                attempts: 5,
                expiresAt: Date.now() + 900000,
            })

            mockCacheManager.get.mockResolvedValue(mockData)
            mockCacheManager.del.mockResolvedValue(undefined)

            await expect(
                service.verifyCode(verificationId, '000000')
            ).rejects.toThrow(HttpException)
        })
    })

    describe('consumeVerification', () => {
        it('should consume verification successfully', async () => {
            mockCacheManager.del.mockResolvedValue(undefined)

            await service.consumeVerification('test-verification-id')

            expect(mockCacheManager.del).toHaveBeenCalledWith(
                'verification:test-verification-id'
            )
        })
    })
})

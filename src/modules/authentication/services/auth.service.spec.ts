import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

import { AuthService } from './auth.service';
import { UserAuth } from '../../two-factor-authentication/user-auth.entity';
import { Device } from '../../devices/device.entity';
import { DevicesService } from 'src/modules/devices/devices.service';
import { TokensService } from '../../tokens/services/tokens.service';
import { NotificationService } from './notification.service';
import { RegisterDto } from '../dto/auth/register.dto';
import { LoginDto, ScanLoginDto } from '../dto/auth.dto';
import { PhoneVerificationService } from 'src/modules/phone-verification/services/phone-verification/phone-verification.service';
import { TokenPair } from 'src/modules/tokens/types/token-pair.interface';
import { DeviceFingerprint } from 'src/modules/devices/device-fingerprint.interface';
import { TwoFactorAuthenticationService } from 'src/modules/two-factor-authentication/two-factor-authentication.service';
import { QuickResponseCodeService } from 'src/modules/devices/quick-response-code/quick-response-code.service';

describe('AuthService', () => {
    let service: AuthService;
    let userAuthRepository: jest.Mocked<Repository<UserAuth>>;
    let verificationService: jest.Mocked<PhoneVerificationService>;
    let tokenService: jest.Mocked<TokensService>;
    let deviceService: jest.Mocked<DevicesService>;
    let qrCodeService: jest.Mocked<QuickResponseCodeService>;

    const mockUserAuth = {
        id: 'user-id',
        phoneNumber: '+1234567890',
        twoFactorSecret: '',
        twoFactorEnabled: false,
        lastAuthenticatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
    } as UserAuth;

    const mockDevice = {
        id: 'device-id',
        userId: 'user-id',
        deviceName: 'Test Device',
        deviceType: 'mobile',
        deviceFingerprint: 'test-fingerprint',
        model: 'iPhone 13',
        osVersion: 'iOS 15.0',
        appVersion: '1.0.0',
        fcmToken: '',
        apnsToken: 'test-apns-token',
        publicKey: 'test-public-key',
        lastActive: new Date(),
        ipAddress: '127.0.0.1',
        isVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUserAuth,
    } as Device;

    const mockTokenPair: TokenPair = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
    };

    const mockFingerprint: DeviceFingerprint = {
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
        deviceType: 'mobile',
        timestamp: Date.now(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: getRepositoryToken(UserAuth),
                    useValue: {
                        findOne: jest.fn(),
                        save: jest.fn(),
                        create: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(Device),
                    useValue: {
                        find: jest.fn(),
                        findOne: jest.fn(),
                        save: jest.fn(),
                    },
                },
                {
                    provide: PhoneVerificationService,
                    useValue: {
                        verifyCode: jest.fn(),
                        consumeVerification: jest.fn(),
                    },
                },
                {
                    provide: TokensService,
                    useValue: {
                        generateTokenPair: jest.fn(),
                        revokeAllTokensForDevice: jest.fn(),
                    },
                },
                {
                    provide: TwoFactorAuthenticationService,
                    useValue: {
                        isTwoFactorEnabled: jest.fn(),
                    },
                },
                {
                    provide: DevicesService,
                    useValue: {
                        registerDevice: jest.fn(),
                        validateQRChallenge: jest.fn(),
                        revokeDevice: jest.fn(),
                        getUserDevices: jest.fn(),
                    },
                },
                {
                    provide: NotificationService,
                    useValue: {
                        notifyNewDeviceLogin: jest.fn(),
                        notifyQRLogin: jest.fn(),
                    },
                },
                {
                    provide: QuickResponseCodeService,
                    useValue: {
                        validateQRChallenge: jest.fn(),
                    },
                },
                {
                    provide: CACHE_MANAGER,
                    useValue: {
                        get: jest.fn(),
                        set: jest.fn(),
                        del: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        userAuthRepository = module.get(getRepositoryToken(UserAuth));
        verificationService = module.get(PhoneVerificationService);
        tokenService = module.get(TokensService);
        deviceService = module.get(DevicesService);
        qrCodeService = module.get(QuickResponseCodeService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('register', () => {
        const registerDto: RegisterDto = {
            verificationId: 'verification-id',
            firstName: 'John',
            lastName: 'Doe',
            deviceName: 'iPhone 13',
            deviceType: 'mobile',
            publicKey: 'public-key',
        };

        it('should register user successfully', async () => {
            verificationService.verifyCode.mockResolvedValue({
                phoneNumber: '+1234567890',
                purpose: 'registration',
                hashedCode: 'hashed-code',
                attempts: 0,
                expiresAt: Date.now() + 900000,
            });
            userAuthRepository.findOne.mockResolvedValue(null);
            userAuthRepository.create.mockReturnValue(mockUserAuth);
            userAuthRepository.save.mockResolvedValue(mockUserAuth);
            deviceService.registerDevice.mockResolvedValue(mockDevice);
            tokenService.generateTokenPair.mockResolvedValue(mockTokenPair);

            const result = await service.register(registerDto, mockFingerprint);

            expect(verificationService.verifyCode).toHaveBeenCalledWith(registerDto.verificationId, '');
            expect(userAuthRepository.save).toHaveBeenCalled();
            expect(deviceService.registerDevice).toHaveBeenCalled();
            expect(result).toEqual(mockTokenPair);
        });

        it('should throw BadRequestException if user already exists', async () => {
            verificationService.verifyCode.mockResolvedValue({
                phoneNumber: '+1234567890',
                purpose: 'login',
                hashedCode: 'hashed-code',
                attempts: 0,
                expiresAt: Date.now() + 900000,
            });
            userAuthRepository.findOne.mockResolvedValue(mockUserAuth);

            await expect(service.register(registerDto, mockFingerprint)).rejects.toThrow(BadRequestException);
        });
    });

    describe('login', () => {
        const loginDto: LoginDto = {
            verificationId: 'verification-id',
            deviceName: 'iPhone 13',
            deviceType: 'mobile',
            publicKey: 'public-key',
        };

        it('should login user successfully', async () => {
            const verificationData = {
                phoneNumber: '+1234567890',
                purpose: 'login' as const,
                hashedCode: 'hashed-code',
                attempts: 0,
                expiresAt: Date.now() + 900000,
            };

            verificationService.verifyCode.mockResolvedValue(verificationData);
            userAuthRepository.findOne.mockResolvedValue(mockUserAuth);
            deviceService.registerDevice.mockResolvedValue(mockDevice);
            tokenService.generateTokenPair.mockResolvedValue(mockTokenPair);

            const result = await service.login(loginDto, mockFingerprint);

            expect(verificationService.verifyCode).toHaveBeenCalled();
            expect(userAuthRepository.findOne).toHaveBeenCalled();
            expect(result).toEqual(mockTokenPair);
        });

        it('should throw BadRequestException if user not found', async () => {
            const verificationData = {
                phoneNumber: '+1234567890',
                purpose: 'login' as const,
                hashedCode: 'hashed-code',
                attempts: 0,
                expiresAt: Date.now() + 900000,
            };

            verificationService.verifyCode.mockResolvedValue(verificationData);
            userAuthRepository.findOne.mockResolvedValue(null);

            await expect(service.login(loginDto, mockFingerprint)).rejects.toThrow(BadRequestException);
        });
    });

    describe('scanLogin', () => {
        const scanLoginDto: ScanLoginDto = {
            challenge: 'challenge-token',
            authenticatedDeviceId: 'device-id',
            deviceName: 'iPhone 13',
            deviceType: 'mobile',
        };

        it('should perform QR login successfully', async () => {
            const challengeData = {
                userId: mockUserAuth.id,
                deviceId: 'device-id',
                publicKey: 'public-key',
                expiresAt: Date.now() + 300000,
            };

            qrCodeService.validateQRChallenge.mockResolvedValue(challengeData);
            userAuthRepository.findOne.mockResolvedValue(mockUserAuth);
            deviceService.registerDevice.mockResolvedValue(mockDevice);
            tokenService.generateTokenPair.mockResolvedValue(mockTokenPair);

            const result = await qrCodeService.scanLogin(scanLoginDto, mockFingerprint);

            expect(qrCodeService.validateQRChallenge).toHaveBeenCalledWith(
                scanLoginDto.challenge,
                scanLoginDto.authenticatedDeviceId
            );
            expect(deviceService.registerDevice).toHaveBeenCalled();
            expect(result).toEqual(mockTokenPair);
        });

        it('should throw BadRequestException with invalid challenge', async () => {
            qrCodeService.validateQRChallenge.mockRejectedValue(new BadRequestException('Invalid challenge'));

            await expect(qrCodeService.scanLogin(scanLoginDto, mockFingerprint)).rejects.toThrow(
                BadRequestException
            );
        });
    });

    describe('getUserDevices', () => {
        it('should return user devices', async () => {
            const devices = [mockDevice];
            deviceService.getUserDevices.mockResolvedValue(devices);

            const result = await deviceService.getUserDevices(mockUserAuth.id);

            expect(deviceService.getUserDevices).toHaveBeenCalledWith(mockUserAuth.id);
            expect(result).toEqual(devices);
        });
    });

    describe('revokeDevice', () => {
        it('should revoke device successfully', async () => {
            deviceService.revokeDevice.mockResolvedValue(undefined);
            tokenService.revokeAllTokensForDevice.mockResolvedValue(undefined);

            await deviceService.revokeDevice(mockUserAuth.id, mockDevice.id);

            expect(deviceService.revokeDevice).toHaveBeenCalledWith(mockUserAuth.id, mockDevice.id);
            expect(tokenService.revokeAllTokensForDevice).toHaveBeenCalledWith(mockDevice.id);
        });

        it('should throw BadRequestException if device not found', async () => {
            deviceService.revokeDevice.mockRejectedValue(new BadRequestException('Device not found'));

            await expect(deviceService.revokeDevice(mockUserAuth.id, 'invalid-id')).rejects.toThrow(
                BadRequestException
            );
        });
    });
});

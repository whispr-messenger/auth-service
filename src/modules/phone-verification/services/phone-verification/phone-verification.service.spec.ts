import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhoneVerificationService } from './phone-verification.service';
import { UserAuthService } from '../../../common/services/user-auth.service';
import { VerificationCodeGeneratorService } from '../verification-code-generator/verification-code-generator.service';
import { PhoneNumberService } from '../phone-number/phone-number.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { VerificationCode } from '../../types';

describe('PhoneVerificationService', () => {
	let service: PhoneVerificationService;

	const mockVerificationRepo = {
		save: jest.fn(),
		findById: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
	};

	const mockCodeGenerator = {
		generateCode: jest.fn().mockReturnValue('123456'),
		hashCode: jest.fn().mockResolvedValue('hashed-123456'),
		compareCode: jest.fn(),
	};

	const mockPhoneService = {
		normalize: jest.fn().mockImplementation((phone: string) => phone),
	};

	const mockRateLimitService = {
		checkLimit: jest.fn(),
		increment: jest.fn(),
	};

	const mockVerificationChannel = {
		sendVerification: jest.fn(),
	};

	const mockUserAuthService = {
		findByPhoneNumber: jest.fn(),
		findById: jest.fn(),
	};

	const buildModule = async (configOverrides: Record<string, string> = {}) => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PhoneVerificationService,
				{ provide: 'VerificationRepository', useValue: mockVerificationRepo },
				{ provide: VerificationCodeGeneratorService, useValue: mockCodeGenerator },
				{ provide: PhoneNumberService, useValue: mockPhoneService },
				{ provide: RateLimitService, useValue: mockRateLimitService },
				{ provide: 'VerificationChannelStrategy', useValue: mockVerificationChannel },
				{
					provide: ConfigService,
					useValue: {
						get: jest.fn().mockImplementation((key: string) => configOverrides[key]),
					},
				},
				{ provide: UserAuthService, useValue: mockUserAuthService },
			],
		}).compile();

		return module.get<PhoneVerificationService>(PhoneVerificationService);
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		service = await buildModule();
	});

	describe('requestRegistrationVerification', () => {
		it('should return verificationId when phone not already registered', async () => {
			mockUserAuthService.findByPhoneNumber.mockResolvedValue(null);
			mockRateLimitService.checkLimit.mockResolvedValue(undefined);
			mockRateLimitService.increment.mockResolvedValue(undefined);
			mockVerificationRepo.save.mockResolvedValue(undefined);
			mockVerificationChannel.sendVerification.mockResolvedValue(undefined);

			const result = await service.requestRegistrationVerification({ phoneNumber: '+33612345678' });

			expect(result).toHaveProperty('verificationId');
			expect(typeof result.verificationId).toBe('string');
		});

		it('should throw ConflictException when phone already registered', async () => {
			mockUserAuthService.findByPhoneNumber.mockResolvedValue({ id: 'user-id' });

			await expect(
				service.requestRegistrationVerification({ phoneNumber: '+33612345678' })
			).rejects.toThrow(ConflictException);
		});

		it('should include code in response when demo mode is active', async () => {
			service = await buildModule({ DEMO_MODE: 'true' });
			mockUserAuthService.findByPhoneNumber.mockResolvedValue(null);
			mockRateLimitService.checkLimit.mockResolvedValue(undefined);
			mockRateLimitService.increment.mockResolvedValue(undefined);
			mockVerificationRepo.save.mockResolvedValue(undefined);

			const result = await service.requestRegistrationVerification({ phoneNumber: '+33612345678' });

			expect(result.code).toBe('123456');
		});

		it('should throw HttpException when rate limit is exceeded', async () => {
			mockUserAuthService.findByPhoneNumber.mockResolvedValue(null);
			mockRateLimitService.checkLimit.mockRejectedValue(
				new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS)
			);

			await expect(
				service.requestRegistrationVerification({ phoneNumber: '+33612345678' })
			).rejects.toThrow(HttpException);
		});
	});

	describe('requestLoginVerification', () => {
		it('should return verificationId when user exists', async () => {
			mockUserAuthService.findByPhoneNumber.mockResolvedValue({ id: 'user-id' });
			mockRateLimitService.checkLimit.mockResolvedValue(undefined);
			mockRateLimitService.increment.mockResolvedValue(undefined);
			mockVerificationRepo.save.mockResolvedValue(undefined);
			mockVerificationChannel.sendVerification.mockResolvedValue(undefined);

			const result = await service.requestLoginVerification({ phoneNumber: '+33612345678' });

			expect(result).toHaveProperty('verificationId');
		});

		it('should throw BadRequestException when user does not exist', async () => {
			mockUserAuthService.findByPhoneNumber.mockResolvedValue(null);

			await expect(service.requestLoginVerification({ phoneNumber: '+33612345678' })).rejects.toThrow(
				BadRequestException
			);
		});
	});

	describe('confirmRegistrationVerification', () => {
		it('should return verified: true when code is correct', async () => {
			const verificationData: VerificationCode = {
				phoneNumber: '+33612345678',
				hashedCode: 'hashed-123456',
				purpose: 'registration',
				attempts: 0,
				expiresAt: Date.now() + 900000,
			};
			mockVerificationRepo.findById.mockResolvedValue(verificationData);
			mockCodeGenerator.compareCode.mockResolvedValue(true);
			mockVerificationRepo.update.mockResolvedValue(undefined);

			const result = await service.confirmRegistrationVerification({
				verificationId: 'verification-id',
				code: '123456',
			});

			expect(result).toEqual({ verified: true });
		});

		it('should update verificationId with a 60-second TTL after confirm when remaining TTL > 60s', async () => {
			const verificationData: VerificationCode = {
				phoneNumber: '+33612345678',
				hashedCode: 'hashed-123456',
				purpose: 'registration',
				attempts: 0,
				expiresAt: Date.now() + 900000,
			};
			mockVerificationRepo.findById.mockResolvedValue(verificationData);
			mockCodeGenerator.compareCode.mockResolvedValue(true);
			mockVerificationRepo.update.mockResolvedValue(undefined);

			await service.confirmRegistrationVerification({
				verificationId: 'verification-id',
				code: '123456',
			});

			expect(mockVerificationRepo.update).toHaveBeenCalledWith(
				'verification-id',
				expect.objectContaining({ verified: true }),
				60 * 1000
			);
		});

		it('should use remaining TTL when it is less than 60 seconds', async () => {
			const verificationData: VerificationCode = {
				phoneNumber: '+33612345678',
				hashedCode: 'hashed-123456',
				purpose: 'registration',
				attempts: 0,
				expiresAt: Date.now() + 30000, // 30 seconds remaining
			};
			mockVerificationRepo.findById.mockResolvedValue(verificationData);
			mockCodeGenerator.compareCode.mockResolvedValue(true);
			mockVerificationRepo.update.mockResolvedValue(undefined);

			await service.confirmRegistrationVerification({
				verificationId: 'verification-id',
				code: '123456',
			});

			const [, , ttl] = mockVerificationRepo.update.mock.calls[0];
			expect(ttl).toBeLessThanOrEqual(30000);
			expect(ttl).toBeGreaterThan(0);
		});

		it('should delete verificationId and throw BadRequestException when already expired at confirm time', async () => {
			const verificationData: VerificationCode = {
				phoneNumber: '+33612345678',
				hashedCode: 'hashed-123456',
				purpose: 'registration',
				attempts: 0,
				expiresAt: Date.now() - 1000, // already expired
			};
			mockVerificationRepo.findById.mockResolvedValue(verificationData);
			mockCodeGenerator.compareCode.mockResolvedValue(true);
			mockVerificationRepo.delete.mockResolvedValue(undefined);

			await expect(
				service.confirmRegistrationVerification({
					verificationId: 'verification-id',
					code: '123456',
				})
			).rejects.toThrow(BadRequestException);

			expect(mockVerificationRepo.delete).toHaveBeenCalledWith('verification-id');
			expect(mockVerificationRepo.update).not.toHaveBeenCalled();
		});

		it('should throw BadRequestException when verification not found', async () => {
			mockVerificationRepo.findById.mockResolvedValue(null);

			await expect(
				service.confirmRegistrationVerification({
					verificationId: 'bad-id',
					code: '123456',
				})
			).rejects.toThrow(BadRequestException);
		});

		it('should throw BadRequestException when code is wrong', async () => {
			const verificationData: VerificationCode = {
				phoneNumber: '+33612345678',
				hashedCode: 'hashed-123456',
				purpose: 'registration',
				attempts: 0,
				expiresAt: Date.now() + 900000,
			};
			mockVerificationRepo.findById.mockResolvedValue(verificationData);
			mockCodeGenerator.compareCode.mockResolvedValue(false);
			mockVerificationRepo.update.mockResolvedValue(undefined);

			await expect(
				service.confirmRegistrationVerification({
					verificationId: 'verification-id',
					code: 'wrong',
				})
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('confirmLoginVerification', () => {
		it('should return verified and requires2FA status', async () => {
			const verificationData: VerificationCode = {
				phoneNumber: '+33612345678',
				hashedCode: 'hashed-123456',
				purpose: 'login',
				attempts: 0,
				expiresAt: Date.now() + 900000,
			};
			mockVerificationRepo.findById.mockResolvedValue(verificationData);
			mockCodeGenerator.compareCode.mockResolvedValue(true);
			mockVerificationRepo.update.mockResolvedValue(undefined);
			mockUserAuthService.findByPhoneNumber.mockResolvedValue({
				id: 'user-id',
				twoFactorEnabled: false,
			});

			const result = await service.confirmLoginVerification({
				verificationId: 'verification-id',
				code: '123456',
			});

			expect(result).toEqual({ verified: true, requires2FA: false });
		});

		it('should update verificationId with a 60-second TTL after confirm when remaining TTL > 60s', async () => {
			const verificationData: VerificationCode = {
				phoneNumber: '+33612345678',
				hashedCode: 'hashed-123456',
				purpose: 'login',
				attempts: 0,
				expiresAt: Date.now() + 900000,
			};
			mockVerificationRepo.findById.mockResolvedValue(verificationData);
			mockCodeGenerator.compareCode.mockResolvedValue(true);
			mockVerificationRepo.update.mockResolvedValue(undefined);
			mockUserAuthService.findByPhoneNumber.mockResolvedValue({
				id: 'user-id',
				twoFactorEnabled: false,
			});

			await service.confirmLoginVerification({
				verificationId: 'verification-id',
				code: '123456',
			});

			expect(mockVerificationRepo.update).toHaveBeenCalledWith(
				'verification-id',
				expect.objectContaining({ verified: true }),
				60 * 1000
			);
		});

		it('should return requires2FA: true when 2FA is enabled', async () => {
			const verificationData: VerificationCode = {
				phoneNumber: '+33612345678',
				hashedCode: 'hashed-123456',
				purpose: 'login',
				attempts: 0,
				expiresAt: Date.now() + 900000,
			};
			mockVerificationRepo.findById.mockResolvedValue(verificationData);
			mockCodeGenerator.compareCode.mockResolvedValue(true);
			mockVerificationRepo.update.mockResolvedValue(undefined);
			mockUserAuthService.findByPhoneNumber.mockResolvedValue({
				id: 'user-id',
				twoFactorEnabled: true,
			});

			const result = await service.confirmLoginVerification({
				verificationId: 'verification-id',
				code: '123456',
			});

			expect(result).toEqual({ verified: true, requires2FA: true });
		});

		it('should throw BadRequestException when user not found after verification', async () => {
			const verificationData: VerificationCode = {
				phoneNumber: '+33612345678',
				hashedCode: 'hashed-123456',
				purpose: 'login',
				attempts: 0,
				expiresAt: Date.now() + 900000,
			};
			mockVerificationRepo.findById.mockResolvedValue(verificationData);
			mockCodeGenerator.compareCode.mockResolvedValue(true);
			mockVerificationRepo.update.mockResolvedValue(undefined);
			mockUserAuthService.findByPhoneNumber.mockResolvedValue(null);

			await expect(
				service.confirmLoginVerification({
					verificationId: 'verification-id',
					code: '123456',
				})
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('verifyCode', () => {
		it('should throw TOO_MANY_REQUESTS when max attempts exceeded', async () => {
			const verificationData: VerificationCode = {
				phoneNumber: '+33612345678',
				hashedCode: 'hashed',
				purpose: 'login',
				attempts: 5,
				expiresAt: Date.now() + 900000,
			};
			mockVerificationRepo.findById.mockResolvedValue(verificationData);
			mockVerificationRepo.delete.mockResolvedValue(undefined);

			await expect(service.verifyCode('verification-id', '123456')).rejects.toThrow(
				new HttpException('Too many verification attempts', HttpStatus.TOO_MANY_REQUESTS)
			);
		});

		it('should return verification data if already verified and code is empty', async () => {
			const verificationData: VerificationCode = {
				phoneNumber: '+33612345678',
				hashedCode: 'hashed',
				purpose: 'login',
				attempts: 0,
				expiresAt: Date.now() + 900000,
				verified: true,
			};
			mockVerificationRepo.findById.mockResolvedValue(verificationData);

			const result = await service.verifyCode('verification-id', '');

			expect(result).toEqual(verificationData);
		});

		it('should accept OTP bypass code when configured', async () => {
			service = await buildModule({ OTP_BYPASS_CODE: 'BYPASS123' });
			const verificationData: VerificationCode = {
				phoneNumber: '+33612345678',
				hashedCode: 'hashed',
				purpose: 'login',
				attempts: 0,
				expiresAt: Date.now() + 900000,
			};
			mockVerificationRepo.findById.mockResolvedValue(verificationData);

			const result = await service.verifyCode('verification-id', 'BYPASS123');

			expect(result).toEqual(verificationData);
		});
	});

	describe('getConfirmedVerification', () => {
		it('should return verification data when confirmed', async () => {
			const verificationData: VerificationCode = {
				phoneNumber: '+33612345678',
				hashedCode: 'hashed',
				purpose: 'registration',
				attempts: 0,
				expiresAt: Date.now() + 900000,
				verified: true,
			};
			mockVerificationRepo.findById.mockResolvedValue(verificationData);

			const result = await service.getConfirmedVerification('verification-id');

			expect(result).toEqual(verificationData);
		});

		it('should throw BadRequestException when not found', async () => {
			mockVerificationRepo.findById.mockResolvedValue(null);

			await expect(service.getConfirmedVerification('bad-id')).rejects.toThrow(BadRequestException);
		});

		it('should throw BadRequestException when not yet confirmed', async () => {
			const verificationData: VerificationCode = {
				phoneNumber: '+33612345678',
				hashedCode: 'hashed',
				purpose: 'registration',
				attempts: 0,
				expiresAt: Date.now() + 900000,
				verified: false,
			};
			mockVerificationRepo.findById.mockResolvedValue(verificationData);

			await expect(service.getConfirmedVerification('verification-id')).rejects.toThrow(
				BadRequestException
			);
		});
	});

	describe('consumeVerification', () => {
		it('should delete verification from storage', async () => {
			mockVerificationRepo.delete.mockResolvedValue(undefined);

			await service.consumeVerification('verification-id');

			expect(mockVerificationRepo.delete).toHaveBeenCalledWith('verification-id');
		});
	});

	describe('OTP bypass mode', () => {
		it('should skip SMS sending when bypass code is set', async () => {
			service = await buildModule({ OTP_BYPASS_CODE: 'BYPASS123' });
			mockUserAuthService.findByPhoneNumber.mockResolvedValue(null);
			mockRateLimitService.checkLimit.mockResolvedValue(undefined);
			mockRateLimitService.increment.mockResolvedValue(undefined);
			mockVerificationRepo.save.mockResolvedValue(undefined);

			await service.requestRegistrationVerification({ phoneNumber: '+33612345678' });

			expect(mockVerificationChannel.sendVerification).not.toHaveBeenCalled();
		});
	});
});

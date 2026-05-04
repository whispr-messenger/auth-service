import { Test, TestingModule } from '@nestjs/testing';
import { PhoneAuthenticationController } from './phone-authentication.controller';
import { PhoneAuthenticationService } from '../services/phone-authentication.service';
import { DeviceFingerprintService } from '../../devices/services/device-fingerprint/device-fingerprint.service';
import { JwtAuthGuard } from '../../tokens/guards';
import { AuthenticatedRequest } from '../../tokens/types/authenticated-request.interface';
import { AdaptiveRateLimitService } from '../../adaptive-rate-limit/adaptive-rate-limit.service';

describe('PhoneAuthenticationController', () => {
	let controller: PhoneAuthenticationController;

	const mockAuthService = {
		register: jest.fn(),
		login: jest.fn(),
		logout: jest.fn(),
	};

	const mockFingerprintService = {
		extractFingerprint: jest.fn(),
	};

	const mockRequest = {
		headers: { 'user-agent': 'Mozilla/5.0' },
		user: { sub: 'user-id', deviceId: 'device-id' },
	} as unknown as AuthenticatedRequest;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [PhoneAuthenticationController],
			providers: [
				{ provide: PhoneAuthenticationService, useValue: mockAuthService },
				{ provide: DeviceFingerprintService, useValue: mockFingerprintService },
				{
					provide: AdaptiveRateLimitService,
					useValue: {
						getFailureCount: jest.fn().mockResolvedValue(0),
						recordFailure: jest.fn().mockResolvedValue(0),
						recordSuccess: jest.fn().mockResolvedValue(undefined),
						shouldBlock: jest.fn().mockReturnValue(false),
						threshold: 5,
						windowSeconds: 900,
					},
				},
			],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue({ canActivate: () => true })
			.compile();

		controller = module.get<PhoneAuthenticationController>(PhoneAuthenticationController);
	});

	describe('register', () => {
		it('should extract fingerprint and delegate to authService', async () => {
			const dto = { verificationId: 'vid-1', userId: 'user-1', deviceType: 'mobile' as any };
			const fingerprint = { hash: 'fp-hash', userAgent: 'Mozilla/5.0', deviceType: 'mobile' };
			const response = { accessToken: 'at', refreshToken: 'rt' };

			mockFingerprintService.extractFingerprint.mockReturnValue(fingerprint);
			mockAuthService.register.mockResolvedValue(response);

			const result = await controller.register(dto as any, mockRequest);

			expect(mockFingerprintService.extractFingerprint).toHaveBeenCalledWith(
				mockRequest,
				dto.deviceType
			);
			expect(mockAuthService.register).toHaveBeenCalledWith(dto, fingerprint);
			expect(result).toEqual(response);
		});
	});

	describe('login', () => {
		it('should extract fingerprint and delegate to authService', async () => {
			const dto = {
				verificationId: 'vid-2',
				phoneNumber: '+33612345678',
				deviceType: 'desktop' as any,
			};
			const fingerprint = { hash: 'fp-hash', userAgent: 'Mozilla/5.0', deviceType: 'desktop' };
			const response = { accessToken: 'at2', refreshToken: 'rt2' };

			mockFingerprintService.extractFingerprint.mockReturnValue(fingerprint);
			mockAuthService.login.mockResolvedValue(response);

			const result = await controller.login(dto as any, mockRequest);

			expect(mockFingerprintService.extractFingerprint).toHaveBeenCalledWith(
				mockRequest,
				dto.deviceType
			);
			expect(mockAuthService.login).toHaveBeenCalledWith(dto, fingerprint);
			expect(result).toEqual(response);
		});
	});

	describe('logout', () => {
		it('should always pass userId from JWT and forward optional deviceId from body', async () => {
			const dto = { deviceId: 'other-device-id' };
			mockAuthService.logout.mockResolvedValue(undefined);

			await controller.logout(dto as any, mockRequest);

			expect(mockAuthService.logout).toHaveBeenCalledWith('user-id', 'device-id', 'other-device-id');
		});

		it('should pass undefined targetDeviceId when body is empty (logs out current device)', async () => {
			const dto = {};
			mockAuthService.logout.mockResolvedValue(undefined);

			await controller.logout(dto as any, mockRequest);

			expect(mockAuthService.logout).toHaveBeenCalledWith('user-id', 'device-id', undefined);
		});
	});
});

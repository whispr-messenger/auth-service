import { Test, TestingModule } from '@nestjs/testing';
import { TwoFactorAuthenticationController } from './two-factor-authentication.controller';
import { TwoFactorAuthenticationService } from '../services/two-factor-authentication.service';
import { JwtAuthGuard } from '../../tokens/guards';
import { AuthenticatedRequest } from '../../tokens/types/authenticated-request.interface';

describe('TwoFactorAuthenticationController', () => {
	let controller: TwoFactorAuthenticationController;

	const mockTwoFactorService = {
		setupTwoFactor: jest.fn(),
		enableTwoFactor: jest.fn(),
		verifyTwoFactor: jest.fn(),
		disableTwoFactor: jest.fn(),
		generateNewBackupCodes: jest.fn(),
		isTwoFactorEnabled: jest.fn(),
		getRemainingBackupCodesCount: jest.fn(),
	};

	const mockRequest = { user: { sub: 'user-id' } } as unknown as AuthenticatedRequest;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [TwoFactorAuthenticationController],
			providers: [{ provide: TwoFactorAuthenticationService, useValue: mockTwoFactorService }],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue({ canActivate: () => true })
			.compile();

		controller = module.get<TwoFactorAuthenticationController>(TwoFactorAuthenticationController);
	});

	describe('setupTwoFactor', () => {
		it('should return setup data with secret, otpauthUri and qrCodeUrl', async () => {
			const setup = {
				secret: 'BASE32SECRET',
				otpauthUri: 'otpauth://totp/Whispr?secret=BASE32SECRET',
				qrCodeUrl: 'data:image/png;base64,abc',
			};
			mockTwoFactorService.setupTwoFactor.mockResolvedValue(setup);

			const result = await controller.setupTwoFactor(mockRequest);

			expect(result).toEqual(setup);
			expect(mockTwoFactorService.setupTwoFactor).toHaveBeenCalledWith('user-id');
		});
	});

	describe('enableTwoFactor', () => {
		it('should enable 2FA and return backup codes', async () => {
			mockTwoFactorService.enableTwoFactor.mockResolvedValue(['CODE1', 'CODE2']);

			const result = await controller.enableTwoFactor(mockRequest, { token: '123456' });

			expect(result).toEqual({ backupCodes: ['CODE1', 'CODE2'] });
			expect(mockTwoFactorService.enableTwoFactor).toHaveBeenCalledWith('user-id', '123456');
		});
	});

	describe('verifyTwoFactor', () => {
		it('should return valid: true when token is correct', async () => {
			mockTwoFactorService.verifyTwoFactor.mockResolvedValue(true);

			const result = await controller.verifyTwoFactor(mockRequest, { token: '123456' });

			expect(result).toEqual({ valid: true });
		});

		it('should return valid: false when token is incorrect', async () => {
			mockTwoFactorService.verifyTwoFactor.mockResolvedValue(false);

			const result = await controller.verifyTwoFactor(mockRequest, { token: 'wrong' });

			expect(result).toEqual({ valid: false });
		});
	});

	describe('disableTwoFactor', () => {
		it('should disable 2FA and return disabled: true', async () => {
			mockTwoFactorService.disableTwoFactor.mockResolvedValue(undefined);

			const result = await controller.disableTwoFactor(mockRequest, { token: '123456' });

			expect(result).toEqual({ disabled: true });
		});
	});

	describe('generateBackupCodes', () => {
		it('should return new backup codes', async () => {
			mockTwoFactorService.generateNewBackupCodes.mockResolvedValue(['CODE1', 'CODE2']);

			const result = await controller.generateBackupCodes(mockRequest, { token: '123456' });

			expect(result).toEqual({ backupCodes: ['CODE1', 'CODE2'] });
		});
	});

	describe('regenerateBackupCodes', () => {
		it('should rotate backup codes after TOTP verification', async () => {
			mockTwoFactorService.generateNewBackupCodes.mockResolvedValue(['NEW1', 'NEW2']);

			const result = await controller.regenerateBackupCodes(mockRequest, { token: '123456' });

			expect(result).toEqual({ backupCodes: ['NEW1', 'NEW2'] });
			expect(mockTwoFactorService.generateNewBackupCodes).toHaveBeenCalledWith('user-id', '123456');
		});

		it('should propagate service errors when token is invalid', async () => {
			mockTwoFactorService.generateNewBackupCodes.mockRejectedValue(
				new Error('Invalid verification code')
			);

			await expect(controller.regenerateBackupCodes(mockRequest, { token: 'bad' })).rejects.toThrow(
				'Invalid verification code'
			);
		});
	});

	describe('getRemainingBackupCodes', () => {
		it('should return the remaining codes count', async () => {
			mockTwoFactorService.getRemainingBackupCodesCount.mockResolvedValue(7);

			const result = await controller.getRemainingBackupCodes(mockRequest);

			expect(result).toEqual({ remaining: 7 });
			expect(mockTwoFactorService.getRemainingBackupCodesCount).toHaveBeenCalledWith('user-id');
		});

		it('should return 0 when user has no remaining codes', async () => {
			mockTwoFactorService.getRemainingBackupCodesCount.mockResolvedValue(0);

			const result = await controller.getRemainingBackupCodes(mockRequest);

			expect(result).toEqual({ remaining: 0 });
		});
	});

	describe('getTwoFactorStatus', () => {
		it('should return enabled: true when 2FA is active', async () => {
			mockTwoFactorService.isTwoFactorEnabled.mockResolvedValue(true);

			const result = await controller.getTwoFactorStatus(mockRequest);

			expect(result).toEqual({ enabled: true });
		});

		it('should return enabled: false when 2FA is inactive', async () => {
			mockTwoFactorService.isTwoFactorEnabled.mockResolvedValue(false);

			const result = await controller.getTwoFactorStatus(mockRequest);

			expect(result).toEqual({ enabled: false });
		});
	});
});

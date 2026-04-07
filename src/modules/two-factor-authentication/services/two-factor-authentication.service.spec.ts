import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { TwoFactorAuthenticationService } from './two-factor-authentication.service';
import { UserAuthService } from '../../common/services/user-auth.service';
import { BackupCodesService } from '../backup-codes/backup-codes.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

jest.mock('speakeasy');
jest.mock('qrcode');

describe('TwoFactorAuthenticationService', () => {
	let service: TwoFactorAuthenticationService;

	const mockUserAuthService = {
		findById: jest.fn(),
		saveUser: jest.fn(),
	};

	const mockBackupCodesService = {
		generateBackupCodes: jest.fn(),
		verifyBackupCode: jest.fn(),
		deleteAllBackupCodes: jest.fn(),
	};

	const mockUser = {
		id: 'user-id',
		phoneNumber: '+33612345678',
		twoFactorEnabled: false,
		twoFactorSecret: '',
		twoFactorPendingSecret: null,
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TwoFactorAuthenticationService,
				{ provide: UserAuthService, useValue: mockUserAuthService },
				{ provide: BackupCodesService, useValue: mockBackupCodesService },
			],
		}).compile();

		service = module.get<TwoFactorAuthenticationService>(TwoFactorAuthenticationService);
	});

	describe('setupTwoFactor', () => {
		it('should persist pending secret and return qrCodeUrl without generating backup codes', async () => {
			const user = { ...mockUser };
			mockUserAuthService.findById.mockResolvedValue(user);
			(speakeasy.generateSecret as jest.Mock).mockReturnValue({ base32: 'BASE32SECRET' });
			(speakeasy.otpauthURL as jest.Mock).mockReturnValue('otpauth://totp/Whispr?secret=BASE32SECRET');
			(QRCode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,abc');
			mockUserAuthService.saveUser.mockResolvedValue(undefined);

			const result = await service.setupTwoFactor('user-id');

			expect(result).toEqual({
				secret: 'BASE32SECRET',
				otpauthUri: 'otpauth://totp/Whispr?secret=BASE32SECRET',
				qrCodeUrl: 'data:image/png;base64,abc',
			});
			expect(speakeasy.otpauthURL).toHaveBeenCalledWith(
				expect.objectContaining({ secret: 'BASE32SECRET', encoding: 'base32' })
			);
			expect(QRCode.toDataURL).toHaveBeenCalledWith('otpauth://totp/Whispr?secret=BASE32SECRET');
			expect(mockUserAuthService.saveUser).toHaveBeenCalledWith(
				expect.objectContaining({ twoFactorPendingSecret: 'BASE32SECRET' })
			);
			expect(mockBackupCodesService.generateBackupCodes).not.toHaveBeenCalled();
		});

		it('should throw BadRequestException when user not found', async () => {
			mockUserAuthService.findById.mockResolvedValue(null);

			await expect(service.setupTwoFactor('user-id')).rejects.toThrow(BadRequestException);
		});

		it('should throw BadRequestException when 2FA already enabled', async () => {
			mockUserAuthService.findById.mockResolvedValue({ ...mockUser, twoFactorEnabled: true });

			await expect(service.setupTwoFactor('user-id')).rejects.toThrow(BadRequestException);
		});

		it('should reuse existing pending secret and not call saveUser when twoFactorPendingSecret is already set', async () => {
			const user = { ...mockUser, twoFactorPendingSecret: 'EXISTING_SECRET' };
			mockUserAuthService.findById.mockResolvedValue(user);
			(speakeasy.otpauthURL as jest.Mock).mockReturnValue(
				'otpauth://totp/Whispr?secret=EXISTING_SECRET'
			);
			(QRCode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,existing');

			const result = await service.setupTwoFactor('user-id');

			expect(result).toEqual({
				secret: 'EXISTING_SECRET',
				otpauthUri: 'otpauth://totp/Whispr?secret=EXISTING_SECRET',
				qrCodeUrl: 'data:image/png;base64,existing',
			});
			expect(speakeasy.generateSecret).not.toHaveBeenCalled();
			expect(speakeasy.otpauthURL).toHaveBeenCalledWith(
				expect.objectContaining({ secret: 'EXISTING_SECRET', encoding: 'base32' })
			);
			expect(QRCode.toDataURL).toHaveBeenCalledWith('otpauth://totp/Whispr?secret=EXISTING_SECRET');
			expect(mockUserAuthService.saveUser).not.toHaveBeenCalled();
		});
	});

	describe('enableTwoFactor', () => {
		it('should save user with 2FA enabled and return backup codes when token is valid', async () => {
			mockUserAuthService.findById.mockResolvedValue({
				...mockUser,
				twoFactorPendingSecret: 'PENDING_SECRET',
			});
			(speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
			mockUserAuthService.saveUser.mockResolvedValue(undefined);
			mockBackupCodesService.generateBackupCodes.mockResolvedValue(['CODE1', 'CODE2']);

			const result = await service.enableTwoFactor('user-id', '123456');

			expect(mockUserAuthService.saveUser).toHaveBeenCalledWith(
				expect.objectContaining({
					twoFactorSecret: 'PENDING_SECRET',
					twoFactorPendingSecret: null,
					twoFactorEnabled: true,
				})
			);
			expect(mockBackupCodesService.generateBackupCodes).toHaveBeenCalledWith('user-id');
			expect(result).toEqual(['CODE1', 'CODE2']);
		});

		it('should throw BadRequestException when user not found', async () => {
			mockUserAuthService.findById.mockResolvedValue(null);

			await expect(service.enableTwoFactor('user-id', '123456')).rejects.toThrow(BadRequestException);
		});

		it('should throw BadRequestException when no pending secret exists', async () => {
			mockUserAuthService.findById.mockResolvedValue({ ...mockUser, twoFactorPendingSecret: null });

			await expect(service.enableTwoFactor('user-id', '123456')).rejects.toThrow(BadRequestException);
		});

		it('should throw BadRequestException when token is invalid', async () => {
			mockUserAuthService.findById.mockResolvedValue({
				...mockUser,
				twoFactorPendingSecret: 'PENDING_SECRET',
			});
			(speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

			await expect(service.enableTwoFactor('user-id', 'wrong')).rejects.toThrow(BadRequestException);
		});
	});

	describe('verifyTwoFactor', () => {
		const userWith2FA = { ...mockUser, twoFactorEnabled: true, twoFactorSecret: 'SECRET' };

		it('should return true when TOTP token is valid', async () => {
			mockUserAuthService.findById.mockResolvedValue(userWith2FA);
			(speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

			const result = await service.verifyTwoFactor('user-id', '123456');

			expect(result).toBe(true);
		});

		it('should fall back to backup code when TOTP fails', async () => {
			mockUserAuthService.findById.mockResolvedValue(userWith2FA);
			(speakeasy.totp.verify as jest.Mock).mockReturnValue(false);
			mockBackupCodesService.verifyBackupCode.mockResolvedValue(true);

			const result = await service.verifyTwoFactor('user-id', 'BACK-UP01');

			expect(result).toBe(true);
			expect(mockBackupCodesService.verifyBackupCode).toHaveBeenCalledWith('user-id', 'BACK-UP01');
		});

		it('should throw BadRequestException when 2FA not configured', async () => {
			mockUserAuthService.findById.mockResolvedValue({ ...mockUser, twoFactorEnabled: false });

			await expect(service.verifyTwoFactor('user-id', '123456')).rejects.toThrow(BadRequestException);
		});

		it('should throw BadRequestException when user not found', async () => {
			mockUserAuthService.findById.mockResolvedValue(null);

			await expect(service.verifyTwoFactor('user-id', '123456')).rejects.toThrow(BadRequestException);
		});
	});

	describe('disableTwoFactor', () => {
		const userWith2FA = { ...mockUser, twoFactorEnabled: true, twoFactorSecret: 'SECRET' };

		it('should disable 2FA when token is valid', async () => {
			mockUserAuthService.findById.mockResolvedValue({ ...userWith2FA });
			(speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
			mockUserAuthService.saveUser.mockResolvedValue(undefined);
			mockBackupCodesService.deleteAllBackupCodes.mockResolvedValue(undefined);

			await service.disableTwoFactor('user-id', '123456');

			expect(mockBackupCodesService.deleteAllBackupCodes).toHaveBeenCalledWith('user-id');
			expect(mockUserAuthService.saveUser).toHaveBeenCalledWith(
				expect.objectContaining({ twoFactorSecret: '', twoFactorEnabled: false })
			);
		});

		it('should throw BadRequestException when user not found', async () => {
			mockUserAuthService.findById.mockResolvedValue(null);

			await expect(service.disableTwoFactor('user-id', '123456')).rejects.toThrow(BadRequestException);
		});

		it('should throw BadRequestException when 2FA not enabled', async () => {
			mockUserAuthService.findById.mockResolvedValue({ ...mockUser, twoFactorEnabled: false });

			await expect(service.disableTwoFactor('user-id', '123456')).rejects.toThrow(BadRequestException);
		});

		it('should throw UnauthorizedException when token is invalid', async () => {
			mockUserAuthService.findById.mockResolvedValue({ ...userWith2FA });
			(speakeasy.totp.verify as jest.Mock).mockReturnValue(false);
			mockBackupCodesService.verifyBackupCode.mockResolvedValue(false);

			await expect(service.disableTwoFactor('user-id', 'wrong')).rejects.toThrow(UnauthorizedException);
		});
	});

	describe('generateNewBackupCodes', () => {
		const userWith2FA = { ...mockUser, twoFactorEnabled: true, twoFactorSecret: 'SECRET' };

		it('should return new backup codes when token is valid', async () => {
			mockUserAuthService.findById.mockResolvedValue({ ...userWith2FA });
			(speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
			mockBackupCodesService.generateBackupCodes.mockResolvedValue(['NEW1', 'NEW2']);

			const result = await service.generateNewBackupCodes('user-id', '123456');

			expect(result).toEqual(['NEW1', 'NEW2']);
			expect(mockBackupCodesService.generateBackupCodes).toHaveBeenCalledWith('user-id');
		});

		it('should throw BadRequestException when 2FA not configured', async () => {
			mockUserAuthService.findById.mockResolvedValue({ ...mockUser, twoFactorEnabled: false });

			await expect(service.generateNewBackupCodes('user-id', '123456')).rejects.toThrow(
				BadRequestException
			);
		});

		it('should throw UnauthorizedException when token is invalid', async () => {
			mockUserAuthService.findById.mockResolvedValue({ ...userWith2FA });
			(speakeasy.totp.verify as jest.Mock).mockReturnValue(false);
			mockBackupCodesService.verifyBackupCode.mockResolvedValue(false);

			await expect(service.generateNewBackupCodes('user-id', 'wrong')).rejects.toThrow(
				UnauthorizedException
			);
		});
	});

	describe('isTwoFactorEnabled', () => {
		it('should return true when 2FA is enabled', async () => {
			mockUserAuthService.findById.mockResolvedValue({ ...mockUser, twoFactorEnabled: true });

			const result = await service.isTwoFactorEnabled('user-id');

			expect(result).toBe(true);
		});

		it('should return false when 2FA is not enabled', async () => {
			mockUserAuthService.findById.mockResolvedValue({ ...mockUser, twoFactorEnabled: false });

			const result = await service.isTwoFactorEnabled('user-id');

			expect(result).toBe(false);
		});

		it('should return false when user not found', async () => {
			mockUserAuthService.findById.mockResolvedValue(null);

			const result = await service.isTwoFactorEnabled('user-id');

			expect(result).toBe(false);
		});
	});
});

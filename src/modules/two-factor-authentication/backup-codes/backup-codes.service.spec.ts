import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BackupCodesService } from './backup-codes.service';
import { BackupCode } from '../entities/backup-code.entity';

jest.mock('bcrypt', () => ({
	hash: jest.fn().mockResolvedValue('hashed-code'),
	compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('BackupCodesService', () => {
	let service: BackupCodesService;

	const mockBackupCodeRepository = {
		findOne: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		find: jest.fn(),
		remove: jest.fn(),
		delete: jest.fn(),
		count: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BackupCodesService,
				{
					provide: getRepositoryToken(BackupCode),
					useValue: mockBackupCodeRepository,
				},
			],
		}).compile();

		service = module.get<BackupCodesService>(BackupCodesService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('generateBackupCodes', () => {
		it('should generate 10 backup codes and save them', async () => {
			mockBackupCodeRepository.delete.mockResolvedValue(undefined);
			mockBackupCodeRepository.create.mockImplementation((data) => data);
			mockBackupCodeRepository.save.mockResolvedValue([]);

			const codes = await service.generateBackupCodes('user-id');

			expect(mockBackupCodeRepository.delete).toHaveBeenCalledWith({ userId: 'user-id' });
			expect(mockBackupCodeRepository.save).toHaveBeenCalled();
			expect(codes).toHaveLength(10);
			// Codes match format XXXX-XXXX
			codes.forEach((code) => {
				expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
			});
		});
	});

	describe('verifyBackupCode', () => {
		it('should return true and mark code as used when code matches', async () => {
			const backupCodes = [
				{ id: '1', userId: 'user-id', codeHash: 'hashed', used: false, usedAt: null },
			] as unknown as BackupCode[];
			mockBackupCodeRepository.find.mockResolvedValue(backupCodes);
			(bcrypt.compare as jest.Mock).mockResolvedValue(true);
			mockBackupCodeRepository.save.mockResolvedValue({ ...backupCodes[0], used: true });

			const result = await service.verifyBackupCode('user-id', 'ABCD-1234');

			expect(result).toBe(true);
			expect(mockBackupCodeRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({ used: true })
			);
		});

		it('should return false when no code matches', async () => {
			const backupCodes = [
				{ id: '1', userId: 'user-id', codeHash: 'hashed', used: false },
			] as unknown as BackupCode[];
			mockBackupCodeRepository.find.mockResolvedValue(backupCodes);
			(bcrypt.compare as jest.Mock).mockResolvedValue(false);

			const result = await service.verifyBackupCode('user-id', 'WRONG-CODE');

			expect(result).toBe(false);
		});

		it('should throw UnauthorizedException when no unused codes exist', async () => {
			mockBackupCodeRepository.find.mockResolvedValue([]);

			await expect(service.verifyBackupCode('user-id', 'ABCD-1234')).rejects.toThrow(
				UnauthorizedException
			);
		});
	});

	describe('getRemainingCodesCount', () => {
		it('should return count of unused backup codes', async () => {
			mockBackupCodeRepository.count.mockResolvedValue(7);

			const result = await service.getRemainingCodesCount('user-id');

			expect(result).toBe(7);
			expect(mockBackupCodeRepository.count).toHaveBeenCalledWith({
				where: { userId: 'user-id', used: false },
			});
		});
	});

	describe('hasBackupCodes', () => {
		it('should return true when codes remain', async () => {
			mockBackupCodeRepository.count.mockResolvedValue(3);

			const result = await service.hasBackupCodes('user-id');

			expect(result).toBe(true);
		});

		it('should return false when no codes remain', async () => {
			mockBackupCodeRepository.count.mockResolvedValue(0);

			const result = await service.hasBackupCodes('user-id');

			expect(result).toBe(false);
		});
	});

	describe('deleteAllBackupCodes', () => {
		it('should delete all backup codes for a user', async () => {
			mockBackupCodeRepository.delete.mockResolvedValue(undefined);

			await service.deleteAllBackupCodes('user-id');

			expect(mockBackupCodeRepository.delete).toHaveBeenCalledWith({ userId: 'user-id' });
		});
	});
});

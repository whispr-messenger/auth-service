import { Test, TestingModule } from '@nestjs/testing';
import { CacheVerificationRepository } from './cache-verification.repository';
import { CacheService } from '../../cache/cache.service';
import { VerificationCode } from '../types/verification-code.interface';

describe('CacheVerificationRepository', () => {
	let repository: CacheVerificationRepository;

	const mockCacheService = {
		set: jest.fn(),
		get: jest.fn(),
		del: jest.fn(),
	};

	const verificationData: VerificationCode = {
		phoneNumber: '+33612345678',
		hashedCode: 'hashed-code',
		purpose: 'registration',
		attempts: 0,
		expiresAt: Date.now() + 900000,
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [CacheVerificationRepository, { provide: CacheService, useValue: mockCacheService }],
		}).compile();

		repository = module.get<CacheVerificationRepository>(CacheVerificationRepository);
	});

	describe('save', () => {
		it('should store verification with TTL converted to seconds', async () => {
			mockCacheService.set.mockResolvedValue(undefined);

			await repository.save('verification-id', verificationData, 900000);

			expect(mockCacheService.set).toHaveBeenCalledWith(
				'verification:verification-id',
				verificationData,
				900
			);
		});

		it('should ceil the TTL in seconds', async () => {
			mockCacheService.set.mockResolvedValue(undefined);

			await repository.save('verification-id', verificationData, 900001);

			expect(mockCacheService.set).toHaveBeenCalledWith(
				'verification:verification-id',
				verificationData,
				901
			);
		});

		// WHISPR-1393
		it('should also write the reverse phone-purpose index for resend invalidation', async () => {
			mockCacheService.set.mockResolvedValue(undefined);

			await repository.save('verification-id', verificationData, 900000);

			expect(mockCacheService.set).toHaveBeenCalledWith(
				'verification:phone-purpose:+33612345678:registration',
				'verification-id',
				900
			);
		});
	});

	// WHISPR-1393
	describe('findByPhoneAndPurpose', () => {
		it('should return the active verificationId when reverse index is present', async () => {
			mockCacheService.get.mockResolvedValue('active-id');

			const result = await repository.findByPhoneAndPurpose('+33612345678', 'registration');

			expect(result).toEqual({ verificationId: 'active-id' });
			expect(mockCacheService.get).toHaveBeenCalledWith(
				'verification:phone-purpose:+33612345678:registration'
			);
		});

		it('should return null when no reverse index exists', async () => {
			mockCacheService.get.mockResolvedValue(null);

			const result = await repository.findByPhoneAndPurpose('+33612345678', 'login');

			expect(result).toBeNull();
		});
	});

	describe('findById', () => {
		it('should return verification data when found', async () => {
			mockCacheService.get.mockResolvedValue(verificationData);

			const result = await repository.findById('verification-id');

			expect(result).toEqual(verificationData);
			expect(mockCacheService.get).toHaveBeenCalledWith('verification:verification-id');
		});

		it('should return null when not found', async () => {
			mockCacheService.get.mockResolvedValue(null);

			const result = await repository.findById('bad-id');

			expect(result).toBeNull();
		});
	});

	describe('update', () => {
		it('should delegate to save with same args', async () => {
			mockCacheService.set.mockResolvedValue(undefined);

			await repository.update('verification-id', verificationData, 500000);

			expect(mockCacheService.set).toHaveBeenCalledWith(
				'verification:verification-id',
				verificationData,
				500
			);
		});
	});

	describe('delete', () => {
		it('should delete the verification key and clear the reverse index', async () => {
			mockCacheService.get.mockResolvedValue(verificationData);
			mockCacheService.del.mockResolvedValue(undefined);

			await repository.delete('verification-id');

			expect(mockCacheService.del).toHaveBeenCalledWith('verification:verification-id');
			expect(mockCacheService.del).toHaveBeenCalledWith(
				'verification:phone-purpose:+33612345678:registration'
			);
		});

		// WHISPR-1393: protection si l'enregistrement a déjà expiré
		it('should still delete the main key when verification record is missing', async () => {
			mockCacheService.get.mockResolvedValue(null);
			mockCacheService.del.mockResolvedValue(undefined);

			await repository.delete('verification-id');

			expect(mockCacheService.del).toHaveBeenCalledWith('verification:verification-id');
			expect(mockCacheService.del).toHaveBeenCalledTimes(1);
		});
	});
});

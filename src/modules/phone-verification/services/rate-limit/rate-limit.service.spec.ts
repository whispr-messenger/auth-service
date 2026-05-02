import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { CacheService } from '../../../cache/cache.service';

describe('RateLimitService', () => {
	let service: RateLimitService;

	const mockCacheService = {
		get: jest.fn(),
		set: jest.fn(),
		del: jest.fn(),
		incr: jest.fn(),
		expire: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [RateLimitService, { provide: CacheService, useValue: mockCacheService }],
		}).compile();

		service = module.get<RateLimitService>(RateLimitService);
	});

	describe('checkLimit', () => {
		it('should not throw when count is below max', async () => {
			mockCacheService.get.mockResolvedValue('3');

			await expect(service.checkLimit('key', 5, 3600, 'Too many')).resolves.toBeUndefined();
		});

		it('should not throw when no count exists yet', async () => {
			mockCacheService.get.mockResolvedValue(null);

			await expect(service.checkLimit('key', 5, 3600, 'Too many')).resolves.toBeUndefined();
		});

		it('should throw TOO_MANY_REQUESTS when count reaches max', async () => {
			mockCacheService.get.mockResolvedValue('5');

			await expect(service.checkLimit('key', 5, 3600, 'Too many requests')).rejects.toThrow(
				new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS)
			);
		});

		it('should throw TOO_MANY_REQUESTS when count exceeds max', async () => {
			mockCacheService.get.mockResolvedValue('10');

			await expect(service.checkLimit('key', 5, 3600)).rejects.toThrow(
				new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS)
			);
		});

		it('should use default error message when none provided', async () => {
			mockCacheService.get.mockResolvedValue('5');

			await expect(service.checkLimit('key', 5, 3600)).rejects.toThrow('Too many requests');
		});
	});

	describe('increment', () => {
		it('should INCR and set expiry when key is first created', async () => {
			mockCacheService.incr.mockResolvedValue(1);

			await service.increment('key', 3600);

			expect(mockCacheService.incr).toHaveBeenCalledWith('key');
			expect(mockCacheService.expire).toHaveBeenCalledWith('key', 3600);
		});

		it('should INCR without refreshing expiry on subsequent calls', async () => {
			mockCacheService.incr.mockResolvedValue(4);

			await service.increment('key', 3600);

			expect(mockCacheService.incr).toHaveBeenCalledWith('key');
			expect(mockCacheService.expire).not.toHaveBeenCalled();
		});
	});

	describe('getRemainingAttempts', () => {
		it('should return remaining attempts when count exists', async () => {
			mockCacheService.get.mockResolvedValue(3);

			const result = await service.getRemainingAttempts('key', 5);

			expect(result).toBe(2);
		});

		it('should return max attempts when no count exists', async () => {
			mockCacheService.get.mockResolvedValue(null);

			const result = await service.getRemainingAttempts('key', 5);

			expect(result).toBe(5);
		});

		it('should return 0 when count exceeds max', async () => {
			mockCacheService.get.mockResolvedValue(10);

			const result = await service.getRemainingAttempts('key', 5);

			expect(result).toBe(0);
		});
	});

	describe('reset', () => {
		it('should delete the rate limit key', async () => {
			mockCacheService.del.mockResolvedValue(undefined);

			await service.reset('key');

			expect(mockCacheService.del).toHaveBeenCalledWith('key');
		});
	});
});

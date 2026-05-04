import { Test, TestingModule } from '@nestjs/testing';
import { AdaptiveRateLimitService } from './adaptive-rate-limit.service';
import { RedisConfig } from '../../config/redis.config';

describe('AdaptiveRateLimitService', () => {
	const redisClient = {
		get: jest.fn(),
		incr: jest.fn(),
		expire: jest.fn(),
		del: jest.fn(),
	};

	const makeService = async (getClient: () => unknown = () => redisClient) => {
		const redisConfig = { getClient: jest.fn().mockImplementation(getClient) };
		const module: TestingModule = await Test.createTestingModule({
			providers: [AdaptiveRateLimitService, { provide: RedisConfig, useValue: redisConfig }],
		}).compile();
		return module.get(AdaptiveRateLimitService);
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('getFailureCount', () => {
		it('returns 0 when no entry exists', async () => {
			redisClient.get.mockResolvedValue(null);
			const service = await makeService();

			expect(await service.getFailureCount('1.2.3.4', '/login')).toBe(0);
			expect(redisClient.get).toHaveBeenCalledWith('adaptive-rate:/login:1.2.3.4');
		});

		it('parses the stored string value', async () => {
			redisClient.get.mockResolvedValue('3');
			const service = await makeService();

			expect(await service.getFailureCount('1.2.3.4', '/login')).toBe(3);
		});

		it('returns 0 when Redis is unavailable', async () => {
			const service = await makeService(() => null);

			expect(await service.getFailureCount('1.2.3.4', '/login')).toBe(0);
			expect(redisClient.get).not.toHaveBeenCalled();
		});

		it('fails open when Redis throws', async () => {
			redisClient.get.mockRejectedValue(new Error('boom'));
			const service = await makeService();

			expect(await service.getFailureCount('1.2.3.4', '/login')).toBe(0);
		});
	});

	describe('recordFailure', () => {
		it('increments and sets TTL on first failure', async () => {
			redisClient.incr.mockResolvedValue(1);
			redisClient.expire.mockResolvedValue(1);
			const service = await makeService();

			const result = await service.recordFailure('1.2.3.4', '/login');

			expect(redisClient.incr).toHaveBeenCalledWith('adaptive-rate:/login:1.2.3.4');
			expect(redisClient.expire).toHaveBeenCalledWith('adaptive-rate:/login:1.2.3.4', 900);
			expect(result).toBe(1);
		});

		it('does not reset TTL on subsequent failures', async () => {
			redisClient.incr.mockResolvedValue(4);
			const service = await makeService();

			await service.recordFailure('1.2.3.4', '/login');

			expect(redisClient.expire).not.toHaveBeenCalled();
		});

		it('returns 0 when Redis is unavailable', async () => {
			const service = await makeService(() => null);

			expect(await service.recordFailure('1.2.3.4', '/login')).toBe(0);
			expect(redisClient.incr).not.toHaveBeenCalled();
		});

		it('fails open when Redis throws', async () => {
			redisClient.incr.mockRejectedValue(new Error('redis down'));
			const service = await makeService();

			expect(await service.recordFailure('1.2.3.4', '/login')).toBe(0);
		});
	});

	describe('recordSuccess', () => {
		it('clears the counter', async () => {
			redisClient.del.mockResolvedValue(1);
			const service = await makeService();

			await service.recordSuccess('1.2.3.4', '/login');

			expect(redisClient.del).toHaveBeenCalledWith('adaptive-rate:/login:1.2.3.4');
		});

		it('no-ops when Redis is unavailable', async () => {
			const service = await makeService(() => null);

			await expect(service.recordSuccess('1.2.3.4', '/login')).resolves.toBeUndefined();
			expect(redisClient.del).not.toHaveBeenCalled();
		});

		it('swallows Redis errors', async () => {
			redisClient.del.mockRejectedValue(new Error('boom'));
			const service = await makeService();

			await expect(service.recordSuccess('1.2.3.4', '/login')).resolves.toBeUndefined();
		});
	});

	describe('shouldBlock', () => {
		it('blocks at or above threshold', async () => {
			const service = await makeService();

			expect(service.shouldBlock(0)).toBe(false);
			expect(service.shouldBlock(4)).toBe(false);
			expect(service.shouldBlock(5)).toBe(true);
			expect(service.shouldBlock(99)).toBe(true);
		});
	});

	describe('getters', () => {
		it('exposes threshold and window for consumers', async () => {
			const service = await makeService();

			expect(service.threshold).toBe(5);
			expect(service.windowSeconds).toBe(900);
		});
	});
});

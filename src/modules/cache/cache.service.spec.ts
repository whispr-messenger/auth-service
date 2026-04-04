import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { RedisConfig } from '../../config/redis.config';

describe('CacheService', () => {
	let service: CacheService;

	const mockRedis = {
		set: jest.fn(),
		setex: jest.fn(),
		get: jest.fn(),
		del: jest.fn(),
		exists: jest.fn(),
		expire: jest.fn(),
		keys: jest.fn(),
		incr: jest.fn(),
		decr: jest.fn(),
		pipeline: jest.fn(),
	};

	const mockRedisConfig = {
		getClient: jest.fn().mockReturnValue(mockRedis),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [CacheService, { provide: RedisConfig, useValue: mockRedisConfig }],
		}).compile();

		service = module.get<CacheService>(CacheService);
	});

	describe('set', () => {
		it('should call setex when ttl is provided', async () => {
			await service.set('key', { foo: 'bar' }, 60);

			expect(mockRedis.setex).toHaveBeenCalledWith('key', 60, JSON.stringify({ foo: 'bar' }));
		});

		it('should call set without ttl when no ttl provided', async () => {
			await service.set('key', 'value');

			expect(mockRedis.set).toHaveBeenCalledWith('key', JSON.stringify('value'));
		});

		it('should throw when redis set fails', async () => {
			mockRedis.set.mockRejectedValue(new Error('Redis error'));

			await expect(service.set('key', 'value')).rejects.toThrow('Redis error');
		});
	});

	describe('get', () => {
		it('should return parsed value when key exists', async () => {
			mockRedis.get.mockResolvedValue(JSON.stringify({ foo: 'bar' }));

			const result = await service.get('key');

			expect(result).toEqual({ foo: 'bar' });
		});

		it('should return null when key does not exist', async () => {
			mockRedis.get.mockResolvedValue(null);

			const result = await service.get('key');

			expect(result).toBeNull();
		});

		it('should return null on redis error', async () => {
			mockRedis.get.mockRejectedValue(new Error('Redis error'));

			const result = await service.get('key');

			expect(result).toBeNull();
		});
	});

	describe('del', () => {
		it('should delete a key', async () => {
			mockRedis.del.mockResolvedValue(1);

			await service.del('key');

			expect(mockRedis.del).toHaveBeenCalledWith('key');
		});

		it('should throw when redis del fails', async () => {
			mockRedis.del.mockRejectedValue(new Error('Redis error'));

			await expect(service.del('key')).rejects.toThrow('Redis error');
		});
	});

	describe('delMany', () => {
		it('should delete multiple keys', async () => {
			mockRedis.del.mockResolvedValue(2);

			await service.delMany(['key1', 'key2']);

			expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2');
		});

		it('should do nothing when keys array is empty', async () => {
			await service.delMany([]);

			expect(mockRedis.del).not.toHaveBeenCalled();
		});

		it('should throw when redis del fails', async () => {
			mockRedis.del.mockRejectedValue(new Error('Redis error'));

			await expect(service.delMany(['key1'])).rejects.toThrow('Redis error');
		});
	});

	describe('exists', () => {
		it('should return true when key exists', async () => {
			mockRedis.exists.mockResolvedValue(1);

			const result = await service.exists('key');

			expect(result).toBe(true);
		});

		it('should return false when key does not exist', async () => {
			mockRedis.exists.mockResolvedValue(0);

			const result = await service.exists('key');

			expect(result).toBe(false);
		});

		it('should return false on redis error', async () => {
			mockRedis.exists.mockRejectedValue(new Error('Redis error'));

			const result = await service.exists('key');

			expect(result).toBe(false);
		});
	});

	describe('expire', () => {
		it('should set TTL for a key', async () => {
			mockRedis.expire.mockResolvedValue(1);

			await service.expire('key', 300);

			expect(mockRedis.expire).toHaveBeenCalledWith('key', 300);
		});

		it('should throw when redis expire fails', async () => {
			mockRedis.expire.mockRejectedValue(new Error('Redis error'));

			await expect(service.expire('key', 300)).rejects.toThrow('Redis error');
		});
	});

	describe('keys', () => {
		it('should return matching keys', async () => {
			mockRedis.keys.mockResolvedValue(['key1', 'key2']);

			const result = await service.keys('key*');

			expect(result).toEqual(['key1', 'key2']);
		});

		it('should return empty array on redis error', async () => {
			mockRedis.keys.mockRejectedValue(new Error('Redis error'));

			const result = await service.keys('key*');

			expect(result).toEqual([]);
		});
	});

	describe('incr', () => {
		it('should increment counter and return new value', async () => {
			mockRedis.incr.mockResolvedValue(5);

			const result = await service.incr('counter');

			expect(result).toBe(5);
			expect(mockRedis.incr).toHaveBeenCalledWith('counter');
		});

		it('should throw when redis incr fails', async () => {
			mockRedis.incr.mockRejectedValue(new Error('Redis error'));

			await expect(service.incr('counter')).rejects.toThrow('Redis error');
		});
	});

	describe('decr', () => {
		it('should decrement counter and return new value', async () => {
			mockRedis.decr.mockResolvedValue(3);

			const result = await service.decr('counter');

			expect(result).toBe(3);
			expect(mockRedis.decr).toHaveBeenCalledWith('counter');
		});

		it('should throw when redis decr fails', async () => {
			mockRedis.decr.mockRejectedValue(new Error('Redis error'));

			await expect(service.decr('counter')).rejects.toThrow('Redis error');
		});
	});

	describe('pipeline', () => {
		it('should execute pipeline commands and return results', async () => {
			const mockPipeline = {
				set: jest.fn().mockReturnThis(),
				exec: jest.fn().mockResolvedValue([
					[null, 'OK'],
					[null, 1],
				]),
			};
			mockRedis.pipeline.mockReturnValue(mockPipeline);

			const result = await service.pipeline([
				['set', 'key1', 'val1'],
				['set', 'key2', 'val2'],
			]);

			expect(result).toEqual(['OK', 1]);
		});

		it('should throw when a pipeline command returns an error', async () => {
			const pipelineError = new Error('Command failed');
			const mockPipeline = {
				set: jest.fn().mockReturnThis(),
				exec: jest.fn().mockResolvedValue([[pipelineError, null]]),
			};
			mockRedis.pipeline.mockReturnValue(mockPipeline);

			await expect(service.pipeline([['set', 'key', 'val']])).rejects.toThrow('Command failed');
		});

		it('should return empty array when exec returns null', async () => {
			const mockPipeline = {
				exec: jest.fn().mockResolvedValue(null),
			};
			mockRedis.pipeline.mockReturnValue(mockPipeline);

			const result = await service.pipeline([]);

			expect(result).toEqual([]);
		});

		it('should throw when pipeline itself fails', async () => {
			mockRedis.pipeline.mockImplementation(() => {
				throw new Error('Pipeline error');
			});

			await expect(service.pipeline([['set', 'key', 'val']])).rejects.toThrow('Pipeline error');
		});
	});
});

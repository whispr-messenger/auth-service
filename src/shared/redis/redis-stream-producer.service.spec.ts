import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisStreamProducer } from './redis-stream-producer.service';

const mockXadd = jest.fn();
const mockQuit = jest.fn().mockResolvedValue('OK');
const mockOn = jest.fn();

jest.mock('ioredis', () => {
	return {
		__esModule: true,
		default: jest.fn(() => ({
			xadd: mockXadd,
			quit: mockQuit,
			on: mockOn,
		})),
	};
});

jest.mock('../../config/redis.config', () => ({
	buildRedisOptions: () => ({ host: 'localhost', port: 6379, db: 1 }),
}));

describe('RedisStreamProducer', () => {
	let service: RedisStreamProducer;

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				RedisStreamProducer,
				{
					provide: ConfigService,
					useValue: { get: jest.fn() },
				},
			],
		}).compile();

		service = module.get<RedisStreamProducer>(RedisStreamProducer);
	});

	describe('emit', () => {
		it('should call xadd with correct stream, MAXLEN, and flattened fields', async () => {
			mockXadd.mockResolvedValue('1718000000000-0');

			const result = await service.emit('stream:user.registered', {
				userId: 'user-1',
				phoneNumber: '+33600000001',
				timestamp: '2026-01-01T00:00:00.000Z',
			});

			expect(mockXadd).toHaveBeenCalledWith(
				'stream:user.registered',
				'MAXLEN',
				'~',
				'10000',
				'*',
				'userId',
				'user-1',
				'phoneNumber',
				'+33600000001',
				'timestamp',
				'2026-01-01T00:00:00.000Z'
			);
			expect(result).toBe('1718000000000-0');
		});

		it('should serialize non-string values to string', async () => {
			mockXadd.mockResolvedValue('1718000000000-1');

			await service.emit('stream:test', {
				count: 42,
				active: true,
			});

			expect(mockXadd).toHaveBeenCalledWith(
				'stream:test',
				'MAXLEN',
				'~',
				'10000',
				'*',
				'count',
				'42',
				'active',
				'true'
			);
		});

		it('should JSON.stringify non-string non-primitive values', async () => {
			mockXadd.mockResolvedValue('1718000000000-2');

			await service.emit('stream:test', {
				metadata: { nested: true },
				tags: ['a', 'b'],
			});

			expect(mockXadd).toHaveBeenCalledWith(
				'stream:test',
				'MAXLEN',
				'~',
				'10000',
				'*',
				'metadata',
				'{"nested":true}',
				'tags',
				'["a","b"]'
			);
		});

		it('should throw when xadd returns null', async () => {
			mockXadd.mockResolvedValue(null);

			await expect(service.emit('stream:test', { key: 'value' })).rejects.toThrow(
				'XADD to stream:test returned null'
			);
		});
	});

	describe('onModuleDestroy', () => {
		it('should call redis.quit()', async () => {
			await service.onModuleDestroy();

			expect(mockQuit).toHaveBeenCalled();
		});
	});
});

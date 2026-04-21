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

	const makeService = async (configOverrides: Record<string, unknown> = {}) => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				RedisStreamProducer,
				{
					provide: ConfigService,
					useValue: {
						get: jest.fn((key: string, def?: unknown) =>
							key in configOverrides ? configOverrides[key] : def
						),
					},
				},
			],
		}).compile();

		return module.get<RedisStreamProducer>(RedisStreamProducer);
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		// Base tests run with 0ms backoff so retry pauses don't slow the suite.
		service = await makeService({ REDIS_STREAM_BASE_BACKOFF_MS: 0 });
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

		it('should serialize null and undefined values as empty strings', async () => {
			mockXadd.mockResolvedValue('1718000000000-3');

			await service.emit('stream:test', {
				nullField: null,
				undefinedField: undefined,
			});

			expect(mockXadd).toHaveBeenCalledWith(
				'stream:test',
				'MAXLEN',
				'~',
				'10000',
				'*',
				'nullField',
				'',
				'undefinedField',
				''
			);
		});

		it('should serialize bigint values to string', async () => {
			mockXadd.mockResolvedValue('1718000000000-4');

			await service.emit('stream:test', {
				bigValue: BigInt('9007199254740993'),
			});

			expect(mockXadd).toHaveBeenCalledWith(
				'stream:test',
				'MAXLEN',
				'~',
				'10000',
				'*',
				'bigValue',
				'9007199254740993'
			);
		});

		it('should throw when data is empty', async () => {
			await expect(service.emit('stream:test', {})).rejects.toThrow(
				'XADD to stream:test requires at least one field'
			);
		});

		it('should throw when xadd returns null on every attempt', async () => {
			mockXadd.mockResolvedValue(null);

			await expect(service.emit('stream:test', { key: 'value' })).rejects.toThrow(
				'XADD to stream:test returned null'
			);
		});
	});

	// WHISPR-992: retry with exponential backoff
	describe('emit retry', () => {
		it('retries after a transient failure and succeeds on the second attempt', async () => {
			service = await makeService({ REDIS_STREAM_BASE_BACKOFF_MS: 0 });
			mockXadd.mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValueOnce('id-ok');

			const id = await service.emit('stream:test', { key: 'value' });

			expect(id).toBe('id-ok');
			expect(mockXadd).toHaveBeenCalledTimes(2);
		});

		it('retries twice then succeeds on the third attempt', async () => {
			service = await makeService({ REDIS_STREAM_BASE_BACKOFF_MS: 0 });
			mockXadd
				.mockRejectedValueOnce(new Error('ETIMEDOUT'))
				.mockRejectedValueOnce(new Error('ECONNRESET'))
				.mockResolvedValueOnce('id-ok');

			const id = await service.emit('stream:test', { key: 'value' });

			expect(id).toBe('id-ok');
			expect(mockXadd).toHaveBeenCalledTimes(3);
		});

		it('rethrows the last error after exhausting all attempts', async () => {
			service = await makeService({ REDIS_STREAM_BASE_BACKOFF_MS: 0 });
			mockXadd
				.mockRejectedValueOnce(new Error('fail-1'))
				.mockRejectedValueOnce(new Error('fail-2'))
				.mockRejectedValueOnce(new Error('fail-final'));

			await expect(service.emit('stream:test', { key: 'value' })).rejects.toThrow('fail-final');

			expect(mockXadd).toHaveBeenCalledTimes(3);
		});

		it('retries when xadd returns null until an id is produced', async () => {
			service = await makeService({ REDIS_STREAM_BASE_BACKOFF_MS: 0 });
			mockXadd.mockResolvedValueOnce(null).mockResolvedValueOnce('id-ok');

			const id = await service.emit('stream:test', { key: 'value' });

			expect(id).toBe('id-ok');
			expect(mockXadd).toHaveBeenCalledTimes(2);
		});

		it('does not retry when data is empty (programmer error)', async () => {
			service = await makeService({ REDIS_STREAM_BASE_BACKOFF_MS: 0 });

			await expect(service.emit('stream:test', {})).rejects.toThrow('requires at least one field');

			expect(mockXadd).not.toHaveBeenCalled();
		});

		it('honors REDIS_STREAM_MAX_ATTEMPTS config override', async () => {
			service = await makeService({
				REDIS_STREAM_MAX_ATTEMPTS: 5,
				REDIS_STREAM_BASE_BACKOFF_MS: 0,
			});
			for (let i = 0; i < 5; i++) {
				mockXadd.mockRejectedValueOnce(new Error(`fail-${i + 1}`));
			}

			await expect(service.emit('stream:test', { key: 'value' })).rejects.toThrow('fail-5');

			expect(mockXadd).toHaveBeenCalledTimes(5);
		});

		it('waits with exponential backoff between attempts (100ms, then 200ms)', async () => {
			jest.useFakeTimers();
			try {
				service = await makeService({ REDIS_STREAM_BASE_BACKOFF_MS: 100 });
				mockXadd
					.mockRejectedValueOnce(new Error('fail-1'))
					.mockRejectedValueOnce(new Error('fail-2'))
					.mockResolvedValueOnce('id-ok');

				const promise = service.emit('stream:test', { key: 'value' });

				// First attempt runs immediately.
				await Promise.resolve();
				expect(mockXadd).toHaveBeenCalledTimes(1);

				// Not enough time for the first backoff to fire (needs 100ms).
				await jest.advanceTimersByTimeAsync(99);
				expect(mockXadd).toHaveBeenCalledTimes(1);

				// Cross the 100ms mark → second attempt fires.
				await jest.advanceTimersByTimeAsync(1);
				expect(mockXadd).toHaveBeenCalledTimes(2);

				// Second backoff is 200ms. At +199ms total = 299ms, still 2 calls.
				await jest.advanceTimersByTimeAsync(199);
				expect(mockXadd).toHaveBeenCalledTimes(2);

				// Cross 300ms → third attempt fires.
				await jest.advanceTimersByTimeAsync(1);
				expect(mockXadd).toHaveBeenCalledTimes(3);

				await expect(promise).resolves.toBe('id-ok');
			} finally {
				jest.useRealTimers();
			}
		});
	});

	describe('onModuleDestroy', () => {
		it('should call redis.quit()', async () => {
			await service.onModuleDestroy();

			expect(mockQuit).toHaveBeenCalled();
		});

		it('should fall back to disconnect() if quit() rejects', async () => {
			const mockDisconnect = jest.fn();
			(service as any).redis.disconnect = mockDisconnect;
			mockQuit.mockRejectedValueOnce(new Error('Connection lost'));

			await service.onModuleDestroy();

			expect(mockDisconnect).toHaveBeenCalled();
		});
	});
});

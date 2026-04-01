import { ConfigService } from '@nestjs/config';
import { RedisConfig, buildRedisOptions, parseSentinels } from './redis.config';

const mockQuit = jest.fn().mockResolvedValue('OK');
const mockOn = jest.fn();
const mockRedisInstance = { quit: mockQuit, on: mockOn };

jest.mock('ioredis', () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(() => mockRedisInstance),
}));

describe('parseSentinels', () => {
	it('parses a single sentinel', () => {
		expect(parseSentinels('redis-sentinel:26379')).toEqual([{ host: 'redis-sentinel', port: 26379 }]);
	});

	it('parses multiple sentinels', () => {
		expect(parseSentinels('s1:26379,s2:26380')).toEqual([
			{ host: 's1', port: 26379 },
			{ host: 's2', port: 26380 },
		]);
	});
});

describe('buildRedisOptions', () => {
	const makeConfig = (overrides: Record<string, string> = {}) =>
		({
			get: jest.fn((key: string, defaultValue?: string) => overrides[key] ?? defaultValue),
		}) as unknown as ConfigService;

	it('returns direct options by default', () => {
		const opts = buildRedisOptions(makeConfig());
		expect(opts).toMatchObject({ host: 'localhost', port: 6379, db: 0, maxRetriesPerRequest: 3 });
	});

	it('returns sentinel options when REDIS_MODE=sentinel', () => {
		const opts = buildRedisOptions(
			makeConfig({
				REDIS_MODE: 'sentinel',
				REDIS_SENTINELS: 's1:26379',
				REDIS_MASTER_NAME: 'mymaster',
				REDIS_SENTINEL_PASSWORD: 'secret',
			})
		);
		expect(opts).toMatchObject({ name: 'mymaster', enableReadyCheck: true });
	});

	it('throws when sentinel config is incomplete', () => {
		expect(() => buildRedisOptions(makeConfig({ REDIS_MODE: 'sentinel' }))).toThrow(
			'REDIS_SENTINELS is required'
		);
	});
});

describe('RedisConfig', () => {
	const makeConfigService = (overrides: Record<string, string> = {}) =>
		({
			get: jest.fn((key: string, defaultValue?: string) => overrides[key] ?? defaultValue),
		}) as unknown as ConfigService;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('calls client.quit() on module destroy', async () => {
		const redisConfig = new RedisConfig(makeConfigService());
		await redisConfig.onModuleDestroy();
		expect(mockQuit).toHaveBeenCalledTimes(1);
	});

	it('exposes the Redis client via getClient()', () => {
		const redisConfig = new RedisConfig(makeConfigService());
		expect(redisConfig.getClient()).toBe(mockRedisInstance);
	});

	it('reports healthy by default', () => {
		const redisConfig = new RedisConfig(makeConfigService());
		expect(redisConfig.health.isHealthy).toBe(true);
	});
});

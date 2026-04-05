import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { RedisConfig, buildRedisOptions, parseSentinels } from './redis.config';

const mockQuit = jest.fn().mockResolvedValue('OK');
const mockOn = jest.fn();
const mockAuth = jest.fn().mockResolvedValue('OK');
const mockRedisInstance = { quit: mockQuit, on: mockOn, auth: mockAuth };

jest.mock('ioredis', () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(() => mockRedisInstance),
}));

jest.mock('fs');

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

	it('includes reconnectOnError that matches NOAUTH errors', () => {
		const opts = buildRedisOptions(makeConfig());
		expect(opts.reconnectOnError).toBeDefined();
		expect(opts.reconnectOnError!(new Error('NOAUTH Authentication required'))).toBe(true);
		expect(opts.reconnectOnError!(new Error('ERR unknown command'))).toBe(false);
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
		jest.spyOn(fs, 'existsSync').mockReturnValue(false);
		const redisConfig = new RedisConfig(makeConfigService());
		await redisConfig.onModuleDestroy();
		expect(mockQuit).toHaveBeenCalledTimes(1);
	});

	it('exposes the Redis client via getClient()', () => {
		jest.spyOn(fs, 'existsSync').mockReturnValue(false);
		const redisConfig = new RedisConfig(makeConfigService());
		expect(redisConfig.getClient()).toBe(mockRedisInstance);
	});

	it('reports healthy by default', () => {
		jest.spyOn(fs, 'existsSync').mockReturnValue(false);
		const redisConfig = new RedisConfig(makeConfigService());
		expect(redisConfig.health.isHealthy).toBe(true);
	});

	describe('credential file watching', () => {
		it('does not start a watcher when REDIS_PASSWORD_FILE is not set', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(false);
			const watchSpy = jest.spyOn(fs, 'watch');
			new RedisConfig(makeConfigService());
			expect(watchSpy).not.toHaveBeenCalled();
		});

		it('does not start a watcher when the credential file does not exist', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(false);
			const watchSpy = jest.spyOn(fs, 'watch');
			new RedisConfig(makeConfigService({ REDIS_PASSWORD_FILE: '/secrets/redis/password' }));
			expect(watchSpy).not.toHaveBeenCalled();
		});

		it('starts a watcher when REDIS_PASSWORD_FILE exists', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			const mockWatcher = { on: jest.fn(), close: jest.fn() } as unknown as fs.FSWatcher;
			const watchSpy = jest.spyOn(fs, 'watch').mockReturnValue(mockWatcher);

			new RedisConfig(makeConfigService({ REDIS_PASSWORD_FILE: '/secrets/redis/password' }));

			expect(watchSpy).toHaveBeenCalledWith(
				'/secrets/redis/password',
				{ persistent: false },
				expect.any(Function)
			);
		});

		it('calls redis.auth() with the new password on file change', async () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue('newpassword\n');

			let capturedCallback: ((event: string) => void) | null = null;
			const mockWatcher = { on: jest.fn(), close: jest.fn() } as unknown as fs.FSWatcher;

			(fs as any).watch = jest.fn((_path: unknown, _opts: unknown, cb: unknown) => {
				capturedCallback = cb as (event: string) => void;
				return mockWatcher;
			});

			new RedisConfig(makeConfigService({ REDIS_PASSWORD_FILE: '/secrets/redis/password' }));

			expect(capturedCallback).not.toBeNull();
			capturedCallback!('change');

			await Promise.resolve();

			expect(mockAuth).toHaveBeenCalledWith('newpassword');
		});

		it('closes the watcher on module destroy', async () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			const mockWatcher = { on: jest.fn(), close: jest.fn() } as unknown as fs.FSWatcher;
			jest.spyOn(fs, 'watch').mockReturnValue(mockWatcher);

			const redisConfig = new RedisConfig(
				makeConfigService({ REDIS_PASSWORD_FILE: '/secrets/redis/password' })
			);
			await redisConfig.onModuleDestroy();

			expect(mockWatcher.close).toHaveBeenCalledTimes(1);
		});
	});
});

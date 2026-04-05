import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { RedisConfig, buildRedisOptions, parseSentinels, readPasswordFile } from './redis.config';

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

describe('readPasswordFile', () => {
	afterEach(() => jest.restoreAllMocks());

	it('returns trimmed file contents', () => {
		jest.spyOn(fs, 'readFileSync').mockReturnValue('mypassword\n');
		expect(readPasswordFile('/secrets/redis/password')).toBe('mypassword');
	});

	it('returns undefined when file cannot be read', () => {
		jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
			throw new Error('ENOENT');
		});
		expect(readPasswordFile('/missing')).toBeUndefined();
	});
});

describe('buildRedisOptions', () => {
	const makeConfig = (overrides: Record<string, string> = {}) =>
		({
			get: jest.fn((key: string, defaultValue?: string) => overrides[key] ?? defaultValue),
		}) as unknown as ConfigService;

	afterEach(() => jest.restoreAllMocks());

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

	it('reads password from REDIS_PASSWORD_FILE when set', () => {
		jest.spyOn(fs, 'readFileSync').mockReturnValue('filepassword\n');
		const opts = buildRedisOptions(makeConfig({ REDIS_PASSWORD_FILE: '/secrets/redis/password' }));
		expect(opts.password).toBe('filepassword');
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

	afterEach(() => jest.restoreAllMocks());

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

		it('watches the parent directory when REDIS_PASSWORD_FILE exists', () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue('initialpassword\n');
			const mockWatcher = { on: jest.fn(), close: jest.fn() } as unknown as fs.FSWatcher;
			const watchSpy = jest.spyOn(fs, 'watch').mockReturnValue(mockWatcher);

			new RedisConfig(makeConfigService({ REDIS_PASSWORD_FILE: '/secrets/redis/password' }));

			expect(watchSpy).toHaveBeenCalledWith(
				'/secrets/redis',
				{ persistent: false },
				expect.any(Function)
			);
		});

		it('calls redis.auth() with the new password when the credential file changes', async () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync')
				.mockReturnValue('initialpassword\n')
				.mockReturnValueOnce('initialpassword\n')
				.mockReturnValue('newpassword\n');

			let capturedCallback: ((event: string, filename: string | null) => void) | null = null;
			const mockWatcher = { on: jest.fn(), close: jest.fn() } as unknown as fs.FSWatcher;
			(
				jest.spyOn(fs, 'watch') as unknown as jest.MockInstance<fs.FSWatcher, unknown[]>
			).mockImplementation((_path: unknown, _opts: unknown, cb: unknown) => {
				capturedCallback = cb as (event: string, filename: string | null) => void;
				return mockWatcher;
			});

			new RedisConfig(makeConfigService({ REDIS_PASSWORD_FILE: '/secrets/redis/password' }));

			expect(capturedCallback).not.toBeNull();
			capturedCallback!('change', 'password');

			await Promise.resolve();

			expect(mockAuth).toHaveBeenCalledWith('newpassword');
		});

		it('ignores events for other files in the same directory', async () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue('initialpassword\n');

			let capturedCallback: ((event: string, filename: string | null) => void) | null = null;
			const mockWatcher = { on: jest.fn(), close: jest.fn() } as unknown as fs.FSWatcher;
			(
				jest.spyOn(fs, 'watch') as unknown as jest.MockInstance<fs.FSWatcher, unknown[]>
			).mockImplementation((_path: unknown, _opts: unknown, cb: unknown) => {
				capturedCallback = cb as (event: string, filename: string | null) => void;
				return mockWatcher;
			});

			new RedisConfig(makeConfigService({ REDIS_PASSWORD_FILE: '/secrets/redis/password' }));

			capturedCallback!('change', 'other-file');

			await Promise.resolve();

			expect(mockAuth).not.toHaveBeenCalled();
		});

		it('closes the watcher on module destroy', async () => {
			jest.spyOn(fs, 'existsSync').mockReturnValue(true);
			jest.spyOn(fs, 'readFileSync').mockReturnValue('initialpassword\n');
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

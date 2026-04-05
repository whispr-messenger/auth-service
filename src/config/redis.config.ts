import * as fs from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

export interface RedisHealthStatus {
	isHealthy: boolean;
	lastError: Error | null;
}

export function parseSentinels(sentinelsStr: string): Array<{ host: string; port: number }> {
	return sentinelsStr.split(',').map((s) => {
		const [host, port] = s.trim().split(':');
		return { host, port: Number.parseInt(port, 10) };
	});
}

export function readPasswordFile(filePath: string): string | undefined {
	try {
		return fs.readFileSync(filePath, 'utf8').trim();
	} catch {
		return undefined;
	}
}

export function buildRedisOptions(configService: ConfigService): RedisOptions {
	const mode = configService.get<string>('REDIS_MODE', 'direct');
	const db = Number.parseInt(configService.get<string>('REDIS_DB', '0'), 10);
	const username = configService.get<string>('REDIS_USERNAME');
	const passwordFile = configService.get<string>('REDIS_PASSWORD_FILE');
	const password = passwordFile
		? readPasswordFile(passwordFile)
		: configService.get<string>('REDIS_PASSWORD');

	const reconnectOnError = (err: Error) => err.message.includes('NOAUTH');

	if (mode === 'sentinel') {
		const sentinelsStr = configService.get<string>('REDIS_SENTINELS');
		const masterName = configService.get<string>('REDIS_MASTER_NAME');
		const sentinelPassword = configService.get<string>('REDIS_SENTINEL_PASSWORD');

		if (!sentinelsStr) {
			throw new Error('REDIS_SENTINELS is required when REDIS_MODE=sentinel');
		}
		if (!masterName) {
			throw new Error('REDIS_MASTER_NAME is required when REDIS_MODE=sentinel');
		}
		if (!sentinelPassword) {
			throw new Error('REDIS_SENTINEL_PASSWORD is required when REDIS_MODE=sentinel');
		}

		return {
			sentinels: parseSentinels(sentinelsStr),
			name: masterName,
			db,
			username,
			password,
			sentinelPassword,
			enableReadyCheck: true,
			maxRetriesPerRequest: 3,
			reconnectOnError,
		};
	}

	// Direct mode (dev local, docker-compose)
	const host = configService.get<string>('REDIS_HOST', 'localhost');
	const port = Number.parseInt(configService.get<string>('REDIS_PORT', '6379'), 10);

	return {
		host,
		port,
		db,
		username,
		password,
		maxRetriesPerRequest: 3,
		lazyConnect: true,
		reconnectOnError,
	};
}

@Injectable()
export class RedisConfig {
	private readonly client: Redis;
	private readonly logger = new Logger(RedisConfig.name);
	private readonly _health: RedisHealthStatus = { isHealthy: true, lastError: null };
	private credentialWatcher: fs.FSWatcher | null = null;

	constructor(private readonly configService: ConfigService) {
		const mode = this.configService.get<string>('REDIS_MODE', 'direct');
		const options = buildRedisOptions(this.configService);

		this.client = new Redis(options);

		this.client.on('error', (err: Error) => {
			this.logger.error('Redis connection error', err.stack);
			this._health.isHealthy = false;
			this._health.lastError = err;
		});

		this.client.on('ready', () => {
			this._health.isHealthy = true;
			this._health.lastError = null;
		});

		this.client.on('connect', () => {
			this._health.isHealthy = true;
			this._health.lastError = null;
		});

		this.client.on('close', () => {
			this._health.isHealthy = false;
		});

		if (mode === 'sentinel') {
			const sentinelsStr = this.configService.get<string>('REDIS_SENTINELS', '');
			this.logger.log(`Redis mode: sentinel (master: ${options.name}, sentinels: ${sentinelsStr})`);
		} else {
			this.logger.log(`Redis mode: direct (${options.host}:${options.port}/${options.db})`);
		}

		const passwordFile = this.configService.get<string>('REDIS_PASSWORD_FILE');
		if (passwordFile) {
			this.watchCredentialFile(passwordFile);
		}
	}

	get health(): RedisHealthStatus {
		return this._health;
	}

	getClient(): Redis {
		return this.client;
	}

	private reloadCredential(filePath: string): void {
		try {
			const newPassword = fs.readFileSync(filePath, 'utf8').trim();
			this.client
				.auth(newPassword)
				.then(() => {
					this.logger.log('Redis credentials refreshed successfully');
				})
				.catch((err: Error) => {
					this.logger.error('Redis credential refresh failed', err.stack);
				});
		} catch (err) {
			const stack = err instanceof Error ? err.stack : String(err);
			this.logger.error('Failed to read Redis credential file', stack);
		}
	}

	private watchCredentialFile(filePath: string): void {
		if (!fs.existsSync(filePath)) {
			this.logger.warn(`REDIS_PASSWORD_FILE not found at ${filePath}, skipping credential watch`);
			return;
		}

		this.logger.log(`Watching Redis credential file: ${filePath}`);

		// Watch the parent directory to catch atomic symlink swaps (Kubernetes secret rotation)
		// which emit 'rename' on the file rather than 'change'.
		const dir = filePath.substring(0, filePath.lastIndexOf('/')) || '.';
		const filename = filePath.substring(filePath.lastIndexOf('/') + 1);

		this.credentialWatcher = fs.watch(dir, { persistent: false }, (event, changedFile) => {
			if (changedFile !== filename) return;
			this.reloadCredential(filePath);
		});

		this.credentialWatcher.on('error', (err: Error) => {
			this.logger.error('Credential file watcher error', err.stack);
		});
	}

	async onModuleDestroy() {
		this.credentialWatcher?.close();
		await this.client.quit();
	}
}

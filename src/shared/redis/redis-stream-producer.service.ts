import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { buildRedisOptions } from '../../config/redis.config';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_BACKOFF_MS = 100;
const BACKOFF_MULTIPLIER = 2;

/**
 * Publishes events to a Redis Stream (XADD) instead of Pub/Sub.
 *
 * Streams persist messages until trimmed by MAXLEN (safety cap at ~10k entries).
 * Consumer-side acknowledgement and trimming is handled by the consumer group.
 */
@Injectable()
export class RedisStreamProducer implements OnModuleDestroy {
	private readonly redis: Redis;
	private readonly logger = new Logger(RedisStreamProducer.name);
	private readonly maxAttempts: number;
	private readonly baseBackoffMs: number;

	constructor(private readonly configService: ConfigService) {
		const options = buildRedisOptions(this.configService);
		options.db = this.configService.get<number>('REDIS_STREAM_DB', 0);
		this.redis = new Redis(options);

		this.redis.on('error', (err) => {
			this.logger.error('Redis stream producer connection error', err.stack);
		});

		this.maxAttempts = this.configService.get<number>('REDIS_STREAM_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS);
		this.baseBackoffMs = this.configService.get<number>(
			'REDIS_STREAM_BASE_BACKOFF_MS',
			DEFAULT_BASE_BACKOFF_MS
		);
	}

	/**
	 * Publish a message to a Redis Stream.
	 * Uses MAXLEN ~ 10000 to cap the stream at approximately 10k entries.
	 * Retries transient failures with exponential backoff (WHISPR-992) so a
	 * momentary Redis hiccup doesn't silently drop the event.
	 */
	async emit<T extends object>(stream: string, data: T): Promise<string> {
		const entries = Object.entries(data);
		if (entries.length === 0) {
			throw new Error(`XADD to ${stream} requires at least one field`);
		}
		const fields = entries.flatMap(([k, v]) => {
			if (v == null) return [k, ''];
			if (typeof v === 'string') return [k, v];
			if (typeof v === 'bigint') return [k, v.toString()];
			return [k, JSON.stringify(v)];
		});

		let lastError: unknown;
		for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
			try {
				const id = await this.redis.xadd(stream, 'MAXLEN', '~', '10000', '*', ...fields);
				if (!id) {
					throw new Error(`XADD to ${stream} returned null`);
				}
				if (attempt > 1) {
					this.logger.log(`XADD ${stream} succeeded on attempt ${attempt}/${this.maxAttempts}`);
				} else {
					this.logger.debug(`XADD ${stream} → ${id}`);
				}
				return id;
			} catch (err) {
				lastError = err;
				const message = err instanceof Error ? err.message : String(err);
				if (attempt < this.maxAttempts) {
					const delayMs = this.baseBackoffMs * BACKOFF_MULTIPLIER ** (attempt - 1);
					this.logger.warn(
						`XADD ${stream} attempt ${attempt}/${this.maxAttempts} failed (${message}), retrying in ${delayMs}ms`
					);
					await sleep(delayMs);
				} else {
					this.logger.error(`XADD ${stream} exhausted ${this.maxAttempts} attempts: ${message}`);
				}
			}
		}
		throw lastError instanceof Error ? lastError : new Error(String(lastError));
	}

	async onModuleDestroy() {
		try {
			await this.redis.quit();
		} catch {
			this.redis.disconnect();
		}
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { buildRedisOptions } from '../../config/redis.config';

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

	constructor(private readonly configService: ConfigService) {
		const options = buildRedisOptions(this.configService);
		options.db = this.configService.get<number>('REDIS_STREAM_DB', 0);
		this.redis = new Redis(options);

		this.redis.on('error', (err) => {
			this.logger.error('Redis stream producer connection error', err.stack);
		});
	}

	/**
	 * Publish a message to a Redis Stream.
	 * Uses MAXLEN ~ 10000 to cap the stream at approximately 10k entries.
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
		const id = await this.redis.xadd(stream, 'MAXLEN', '~', '10000', '*', ...fields);
		if (!id) {
			throw new Error(`XADD to ${stream} returned null`);
		}
		this.logger.debug(`XADD ${stream} → ${id}`);
		return id;
	}

	async onModuleDestroy() {
		try {
			await this.redis.quit();
		} catch {
			this.redis.disconnect();
		}
	}
}

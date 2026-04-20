import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { buildRedisOptions } from '../../config/redis.config';

/**
 * Publishes events to a Redis Stream (XADD) instead of Pub/Sub.
 *
 * Streams guarantee message persistence: if the consumer is temporarily
 * unavailable, messages remain in the stream until acknowledged.
 */
@Injectable()
export class RedisStreamProducer implements OnModuleDestroy {
	private readonly redis: Redis;
	private readonly logger = new Logger(RedisStreamProducer.name);

	constructor(private readonly configService: ConfigService) {
		const options = buildRedisOptions(this.configService);
		// Use database 0 for streams (global inter-service communication)
		options.db = 0;
		this.redis = new Redis(options);

		this.redis.on('error', (err) => {
			this.logger.error('Redis stream producer connection error', err.message);
		});
	}

	/**
	 * Publish a message to a Redis Stream.
	 * Uses MAXLEN ~ 10000 to cap the stream at approximately 10k entries.
	 */
	async emit(stream: string, data: Record<string, unknown>): Promise<string> {
		const fields = Object.entries(data).flatMap(([k, v]) => [k, String(v)]);
		const id = await this.redis.xadd(stream, 'MAXLEN', '~', '10000', '*', ...fields);
		if (!id) {
			throw new Error(`XADD to ${stream} returned null`);
		}
		this.logger.debug(`XADD ${stream} → ${id}`);
		return id;
	}

	async onModuleDestroy() {
		await this.redis.quit();
	}
}

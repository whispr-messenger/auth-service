import { Injectable, Logger } from '@nestjs/common';
import { RedisConfig } from '../config/redis.config';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
	private readonly logger = new Logger(CacheService.name);
	private readonly redis: Redis;

	constructor(private redisConfig: RedisConfig) {
		this.redis = this.redisConfig.getClient();
	}

	/**
	 * Set a value in cache with optional TTL (in seconds)
	 */
	async set(key: string, value: any, ttl?: number): Promise<void> {
		try {
			const serializedValue = JSON.stringify(value);
			if (ttl) {
				await this.redis.setex(key, ttl, serializedValue);
			} else {
				await this.redis.set(key, serializedValue);
			}
		} catch (error) {
			this.logger.error(`Failed to set cache key ${key}:`, error);
			throw error;
		}
	}

	/**
	 * Get a value from cache
	 */
	async get<T>(key: string): Promise<T | null> {
		try {
			const value = await this.redis.get(key);
			return value ? JSON.parse(value) : null;
		} catch (error) {
			this.logger.error(`Failed to get cache key ${key}:`, error);
			return null;
		}
	}

	/**
	 * Delete a key from cache
	 */
	async del(key: string): Promise<void> {
		try {
			await this.redis.del(key);
		} catch (error) {
			this.logger.error(`Failed to delete cache key ${key}:`, error);
			throw error;
		}
	}

	/**
	 * Delete multiple keys from cache
	 */
	async delMany(keys: string[]): Promise<void> {
		if (keys.length === 0) return;

		try {
			await this.redis.del(...keys);
		} catch (error) {
			this.logger.error(`Failed to delete cache keys:`, error);
			throw error;
		}
	}

	/**
	 * Check if a key exists in cache
	 */
	async exists(key: string): Promise<boolean> {
		try {
			const result = await this.redis.exists(key);
			return result === 1;
		} catch (error) {
			this.logger.error(`Failed to check existence of cache key ${key}:`, error);
			return false;
		}
	}

	/**
	 * Set TTL for a key (in seconds)
	 */
	async expire(key: string, ttl: number): Promise<void> {
		try {
			await this.redis.expire(key, ttl);
		} catch (error) {
			this.logger.error(`Failed to set TTL for cache key ${key}:`, error);
			throw error;
		}
	}

	/**
	 * Get keys matching a pattern
	 */
	async keys(pattern: string): Promise<string[]> {
		try {
			return await this.redis.keys(pattern);
		} catch (error) {
			this.logger.error(`Failed to get keys with pattern ${pattern}:`, error);
			return [];
		}
	}

	/**
	 * Increment a counter
	 */
	async incr(key: string): Promise<number> {
		try {
			return await this.redis.incr(key);
		} catch (error) {
			this.logger.error(`Failed to increment counter ${key}:`, error);
			throw error;
		}
	}

	/**
	 * Decrement a counter
	 */
	async decr(key: string): Promise<number> {
		try {
			return await this.redis.decr(key);
		} catch (error) {
			this.logger.error(`Failed to decrement counter ${key}:`, error);
			throw error;
		}
	}

	/**
	 * Execute multiple commands in a pipeline
	 */
	async pipeline(commands: Array<[string, ...any[]]>): Promise<any[]> {
		try {
			const pipeline = this.redis.pipeline();
			commands.forEach(([command, ...args]) => {
				(pipeline as any)[command](...args);
			});
			const results = await pipeline.exec();
			return (
				results?.map(([err, result]) => {
					if (err) throw err;
					return result;
				}) || []
			);
		} catch (error) {
			this.logger.error('Failed to execute pipeline:', error);
			throw error;
		}
	}
}

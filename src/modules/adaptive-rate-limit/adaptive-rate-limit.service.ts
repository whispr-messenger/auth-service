import { Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisConfig } from '../../config/redis.config';

// WHISPR-1054: sliding window d'échecs par IP+route. Le TTL fait double emploi
// avec la fenêtre d'observation — pas besoin de stocker les timestamps.
const FAILURE_WINDOW_SECONDS = 900; // 15 min
// Au-delà, on bloque préventivement (HTTP 429) même si le throttler global
// laisserait passer. Revient à une règle "5 échecs → cooldown 15 min".
const ADAPTIVE_BLOCK_THRESHOLD = 5;

@Injectable()
export class AdaptiveRateLimitService {
	private readonly logger = new Logger(AdaptiveRateLimitService.name);
	private readonly client: Redis | null;

	constructor(redisConfig: RedisConfig) {
		// WHISPR-1054: on garde un client dédié plutôt que de réutiliser
		// CacheService. Les tests e2e stubent CacheService avec des
		// `mockResolvedValueOnce` ; passer par CacheService ferait consommer
		// ces réponses par l'intercepteur et casserait les services sous-jacents.
		let client: Redis | null = null;
		try {
			client = redisConfig.getClient() ?? null;
		} catch (err) {
			this.logger.warn(`Redis client unavailable, adaptive rate limiting disabled: ${err}`);
		}
		this.client = client;
	}

	private key(ip: string, route: string): string {
		return `adaptive-rate:${route}:${ip}`;
	}

	async getFailureCount(ip: string, route: string): Promise<number> {
		if (!this.client) return 0;
		try {
			const value = await this.client.get(this.key(ip, route));
			const parsed = value ? parseInt(value, 10) : 0;
			return Number.isFinite(parsed) ? parsed : 0;
		} catch (err) {
			this.logger.warn(`getFailureCount(${ip}, ${route}) failed: ${err}`);
			return 0;
		}
	}

	async recordFailure(ip: string, route: string): Promise<number> {
		if (!this.client) return 0;
		const key = this.key(ip, route);
		try {
			const value = await this.client.incr(key);
			if (value === 1) {
				await this.client.expire(key, FAILURE_WINDOW_SECONDS);
			}
			return value;
		} catch (err) {
			// Redis hiccup should not make authentication fail — fall back to
			// letting the request proceed (global throttler still applies).
			this.logger.warn(`recordFailure(${ip}, ${route}) failed: ${err}`);
			return 0;
		}
	}

	async recordSuccess(ip: string, route: string): Promise<void> {
		if (!this.client) return;
		try {
			await this.client.del(this.key(ip, route));
		} catch (err) {
			this.logger.warn(`recordSuccess(${ip}, ${route}) failed: ${err}`);
		}
	}

	shouldBlock(failureCount: number): boolean {
		return failureCount >= ADAPTIVE_BLOCK_THRESHOLD;
	}

	get threshold(): number {
		return ADAPTIVE_BLOCK_THRESHOLD;
	}

	get windowSeconds(): number {
		return FAILURE_WINDOW_SECONDS;
	}
}

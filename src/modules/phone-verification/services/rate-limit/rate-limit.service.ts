import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';

/**
 * Service responsible for rate limiting operations.
 * Provides generic rate limiting functionality that can be reused across the application.
 */
@Injectable()
export class RateLimitService {
	constructor(private readonly cacheManager: CacheService) {}

	/**
	 * Checks if a key has exceeded its rate limit.
	 * @param key - The unique key to check (e.g., "rate_limit:+33612345678")
	 * @param maxRequests - Maximum number of requests allowed
	 * @param ttl - Time window in seconds
	 * @param errorMessage - Custom error message (optional)
	 * @throws HttpException with TOO_MANY_REQUESTS status if limit is exceeded
	 */
	public async checkLimit(
		key: string,
		maxRequests: number,
		ttl: number,
		errorMessage: string = 'Too many requests'
	): Promise<void> {
		const count = await this.cacheManager.get<string>(key);

		if (count && Number.parseInt(count, 10) >= maxRequests) {
			throw new HttpException(errorMessage, HttpStatus.TOO_MANY_REQUESTS);
		}
	}

	/**
	 * Increments the request counter for a given key.
	 *
	 * Uses Redis INCR for atomicity — a plain get+set sequence has a TOCTOU gap
	 * under concurrent traffic (two parallel requests both read 4 and both write
	 * 5, so a 5 / hour cap becomes a 6 / hour cap). INCR is O(1) and guaranteed
	 * single-threaded by Redis, so parallel callers always see monotonic values.
	 *
	 * We set the TTL only the first time the counter is created (value === 1)
	 * to preserve the sliding-window semantic — repeated increments must NOT
	 * refresh the window, otherwise the window never actually closes when the
	 * attacker keeps hammering.
	 *
	 * @param key - The unique key to increment
	 * @param ttl - Time to live in seconds, applied only when the key is created
	 */
	public async increment(key: string, ttl: number): Promise<void> {
		const value = await this.cacheManager.incr(key);
		if (value === 1) {
			await this.cacheManager.expire(key, ttl);
		}
	}

	/**
	 * Gets the number of remaining attempts for a given key.
	 * @param key - The unique key to check
	 * @param maxRequests - Maximum number of requests allowed
	 * @returns Number of remaining attempts
	 */
	public async getRemainingAttempts(key: string, maxRequests: number): Promise<number> {
		const count = await this.cacheManager.get<number>(key);
		const current = count || 0;
		return Math.max(0, maxRequests - current);
	}

	/**
	 * Resets the rate limit counter for a given key.
	 * @param key - The unique key to reset
	 */
	public async reset(key: string): Promise<void> {
		await this.cacheManager.del(key);
	}
}

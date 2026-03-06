import { Injectable } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { VerificationRepository } from './verification.repository';
import { VerificationCode } from '../types/verification-code.interface';

/**
 * Cache-based implementation of the VerificationRepository.
 * Uses CacheService (Redis) to store verification data.
 */
@Injectable()
export class CacheVerificationRepository implements VerificationRepository {
	private readonly KEY_PREFIX = 'verification:';

	constructor(private readonly cacheManager: CacheService) {}

	/**
	 * Saves a verification record to the cache.
	 * @param id - Unique identifier for the verification
	 * @param data - Verification data to store
	 * @param ttl - Time to live in milliseconds
	 */
	public async save(id: string, data: VerificationCode, ttl: number): Promise<void> {
		const key = this.getKey(id);
		const ttlInSeconds = Math.ceil(ttl / 1000);
		await this.cacheManager.set(key, data, ttlInSeconds);
	}

	/**
	 * Finds a verification record by ID.
	 * @param id - Unique identifier for the verification
	 * @returns The verification data if found, null otherwise
	 */
	public async findById(id: string): Promise<VerificationCode | null> {
		const key = this.getKey(id);
		const data = await this.cacheManager.get<VerificationCode>(key);

		return data;
	}

	/**
	 * Updates an existing verification record.
	 * @param id - Unique identifier for the verification
	 * @param data - Updated verification data
	 * @param ttl - Time to live in milliseconds
	 */
	public async update(id: string, data: VerificationCode, ttl: number): Promise<void> {
		await this.save(id, data, ttl);
	}

	/**
	 * Deletes a verification record from the cache.
	 * @param id - Unique identifier for the verification
	 */
	public async delete(id: string): Promise<void> {
		const key = this.getKey(id);
		await this.cacheManager.del(key);
	}

	/**
	 * Generates the cache key for a verification ID.
	 * @param id - Verification ID
	 * @returns The cache key
	 */
	private getKey(id: string): string {
		return `${this.KEY_PREFIX}${id}`;
	}
}

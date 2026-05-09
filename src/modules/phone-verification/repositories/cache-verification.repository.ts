import { Injectable } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { VerificationRepository } from './verification.repository';
import { VerificationCode } from '../types/verification-code.interface';
import { VerificationPurpose } from '../types/verification-purpose.type';

/**
 * Cache-based implementation of the VerificationRepository.
 * Uses CacheService (Redis) to store verification data.
 */
@Injectable()
export class CacheVerificationRepository implements VerificationRepository {
	private readonly KEY_PREFIX = 'verification:';
	// WHISPR-1393: index inverse (phone, purpose) -> verificationId pour invalider
	// l'ancien OTP au resend (anti-replay).
	private readonly REVERSE_KEY_PREFIX = 'verification:phone-purpose:';

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
		// maintenir l'index inverse pour permettre l'invalidation au resend
		const reverseKey = this.getReverseKey(data.phoneNumber, data.purpose);
		await this.cacheManager.set(reverseKey, id, ttlInSeconds);
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
	 * WHISPR-1393: lookup d'un verificationId existant pour (phone, purpose).
	 * Utilisé au resend pour invalider l'ancien OTP avant d'en créer un nouveau.
	 */
	public async findByPhoneAndPurpose(
		phoneNumber: string,
		purpose: VerificationPurpose
	): Promise<{ verificationId: string } | null> {
		const reverseKey = this.getReverseKey(phoneNumber, purpose);
		const verificationId = await this.cacheManager.get<string>(reverseKey);
		if (!verificationId) {
			return null;
		}
		return { verificationId };
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
		// récupère le record avant suppression pour nettoyer l'index inverse
		const data = await this.cacheManager.get<VerificationCode>(key);
		await this.cacheManager.del(key);
		if (data) {
			const reverseKey = this.getReverseKey(data.phoneNumber, data.purpose);
			await this.cacheManager.del(reverseKey);
		}
	}

	/**
	 * Generates the cache key for a verification ID.
	 * @param id - Verification ID
	 * @returns The cache key
	 */
	private getKey(id: string): string {
		return `${this.KEY_PREFIX}${id}`;
	}

	private getReverseKey(phoneNumber: string, purpose: VerificationPurpose): string {
		return `${this.REVERSE_KEY_PREFIX}${phoneNumber}:${purpose}`;
	}
}

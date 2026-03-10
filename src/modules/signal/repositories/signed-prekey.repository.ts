import { Repository, EntityManager, EntityTarget, QueryRunner, LessThan, MoreThan } from 'typeorm';
import { SignedPreKey } from '../entities/signed-prekey.entity';

export class SignedPreKeyRepository extends Repository<SignedPreKey> {
	constructor(target: EntityTarget<SignedPreKey>, manager: EntityManager, queryRunner?: QueryRunner) {
		super(target, manager, queryRunner);
	}

	/**
	 * Find all signed prekeys for a user and device
	 */
	async findByUserIdAndDeviceId(userId: string, deviceId: string): Promise<SignedPreKey[]> {
		return this.find({
			where: { userId, deviceId },
			order: { createdAt: 'DESC' },
		});
	}

	/**
	 * Find the most recent active (non-expired) signed prekey for a user and device
	 */
	async findActiveByUserIdAndDeviceId(userId: string, deviceId: string): Promise<SignedPreKey | null> {
		return this.findOne({
			where: {
				userId,
				deviceId,
				expiresAt: MoreThan(new Date()),
			},
			order: { createdAt: 'DESC' },
		});
	}

	/**
	 * Find a specific signed prekey by user, device and key ID
	 */
	async findByUserIdDeviceIdAndKeyId(
		userId: string,
		deviceId: string,
		keyId: number
	): Promise<SignedPreKey | null> {
		return this.findOne({
			where: { userId, deviceId, keyId },
		});
	}

	/**
	 * Create a new signed prekey
	 */
	async createSignedPreKey(
		userId: string,
		deviceId: string,
		keyId: number,
		publicKey: string,
		signature: string,
		expiresAt: Date
	): Promise<SignedPreKey> {
		const signedPreKey = this.create({
			userId,
			deviceId,
			keyId,
			publicKey,
			signature,
			expiresAt,
		});

		return this.save(signedPreKey);
	}

	/**
	 * Create or update a signed prekey identified by (userId, deviceId, keyId)
	 */
	async upsertSignedPreKey(
		userId: string,
		deviceId: string,
		keyId: number,
		publicKey: string,
		signature: string,
		expiresAt: Date
	): Promise<SignedPreKey> {
		const existing = await this.findByUserIdDeviceIdAndKeyId(userId, deviceId, keyId);

		if (existing) {
			existing.publicKey = publicKey;
			existing.signature = signature;
			existing.expiresAt = expiresAt;
			return this.save(existing);
		}

		return this.createSignedPreKey(userId, deviceId, keyId, publicKey, signature, expiresAt);
	}

	/**
	 * Find all expired signed prekeys
	 */
	async findExpired(): Promise<SignedPreKey[]> {
		return this.find({
			where: {
				expiresAt: LessThan(new Date()),
			},
		});
	}

	/**
	 * Delete expired signed prekeys for a specific user and device
	 */
	async deleteExpiredByUserIdAndDeviceId(userId: string, deviceId: string): Promise<void> {
		await this.delete({
			userId,
			deviceId,
			expiresAt: LessThan(new Date()),
		});
	}

	/**
	 * Delete all signed prekeys for a user and device
	 */
	async deleteByUserIdAndDeviceId(userId: string, deviceId: string): Promise<void> {
		await this.delete({ userId, deviceId });
	}

	/**
	 * Delete all signed prekeys for a user (all devices)
	 */
	async deleteByUserId(userId: string): Promise<void> {
		await this.delete({ userId });
	}
}

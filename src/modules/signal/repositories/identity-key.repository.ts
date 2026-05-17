import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Repository, EntityManager, EntityTarget, QueryRunner } from 'typeorm';
import { IdentityKey } from '../entities/identity-key.entity';

export class IdentityKeyRepository extends Repository<IdentityKey> {
	private readonly logger = new Logger(IdentityKeyRepository.name);

	constructor(target: EntityTarget<IdentityKey>, manager: EntityManager, queryRunner?: QueryRunner) {
		super(target, manager, queryRunner);
	}

	/**
	 * Find the identity key for a specific user and device
	 */
	async findByUserIdAndDeviceId(userId: string, deviceId: string): Promise<IdentityKey | null> {
		return this.findOne({
			where: { userId, deviceId },
		});
	}

	/**
	 * List device IDs for which a user has an identity key registered.
	 */
	async listDeviceIdsForUser(userId: string): Promise<string[]> {
		const rows = await this.createQueryBuilder('ik')
			.select('ik.deviceId', 'deviceId')
			.where('ik.userId = :userId', { userId })
			.groupBy('ik.deviceId')
			.getRawMany<{ deviceId: string }>();

		return rows.map((r) => r.deviceId).filter((d) => typeof d === 'string' && d.length > 0);
	}

	/**
	 * Create or update an identity key for a user and device.
	 *
	 * Une rotation (publicKey existante remplacee par une nouvelle) emet un log
	 * audit warn pour permettre la detection MITM cote mobile (TOFU safety
	 * number). Un re-set idempotent avec la meme cle reste un no-op silencieux.
	 */
	async upsertIdentityKey(userId: string, deviceId: string, publicKey: string): Promise<IdentityKey> {
		const existingKey = await this.findByUserIdAndDeviceId(userId, deviceId);

		if (existingKey) {
			if (existingKey.publicKey === publicKey) {
				return existingKey;
			}

			// rotation detectee : on log les fingerprints pour permettre aux peers
			// de detecter un changement d'identity key (futur subscriber mobile)
			this.logger.warn(
				`Identity key rotated for user=${userId} device=${deviceId} ` +
					`oldFingerprint=${this.fingerprint(existingKey.publicKey)} ` +
					`newFingerprint=${this.fingerprint(publicKey)} ` +
					`previousUpdatedAt=${existingKey.updatedAt?.toISOString() ?? 'unknown'}`
			);

			existingKey.publicKey = publicKey;
			existingKey.updatedAt = new Date();
			return this.save(existingKey);
		}

		const newKey = this.create({
			userId,
			deviceId,
			publicKey,
		});

		return this.save(newKey);
	}

	/**
	 * Fingerprint court (16 hex chars de SHA256) d'une cle publique base64.
	 * Utilise pour les logs audit, evite de log la cle complete.
	 */
	private fingerprint(publicKey: string): string {
		return createHash('sha256').update(publicKey).digest('hex').slice(0, 16);
	}

	/**
	 * Delete identity key for a user and device
	 */
	async deleteByUserIdAndDeviceId(userId: string, deviceId: string): Promise<void> {
		await this.delete({ userId, deviceId });
	}

	/**
	 * Delete all identity keys for a user (all devices)
	 */
	async deleteByUserId(userId: string): Promise<void> {
		await this.delete({ userId });
	}
}

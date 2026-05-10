import { Repository, EntityManager, EntityTarget, QueryRunner, MoreThan } from 'typeorm';
import { Device } from '../entities/device.entity';

export class DeviceRepository extends Repository<Device> {
	constructor(target: EntityTarget<Device>, manager: EntityManager, queryRunner?: QueryRunner) {
		super(target, manager, queryRunner);
	}

	async findByUserAndFingerprint(
		userId: string,
		deviceName: string,
		deviceType: string,
		deviceFingerprint?: string
	): Promise<Device | null> {
		if (deviceFingerprint) {
			return this.findOne({ where: { userId, deviceFingerprint } });
		}
		return this.findOne({ where: { userId, deviceName, deviceType } });
	}

	async findVerifiedByUserId(userId: string): Promise<Device[]> {
		return this.find({
			where: { userId, isVerified: true },
			order: { lastActive: 'DESC' },
		});
	}

	async findActiveDevices(userId: string, daysThreshold: number): Promise<Device[]> {
		const thresholdDate = new Date();
		thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

		return this.find({
			where: {
				userId,
				isVerified: true,
				lastActive: MoreThan(thresholdDate),
			},
			order: { lastActive: 'DESC' },
		});
	}

	async countVerifiedDevices(userId: string): Promise<number> {
		return this.count({
			where: { userId, isVerified: true },
		});
	}

	async countActiveDevices(userId: string, daysThreshold: number): Promise<number> {
		const thresholdDate = new Date();
		thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

		return this.count({
			where: {
				userId,
				isVerified: true,
				lastActive: MoreThan(thresholdDate),
			},
		});
	}

	async findByUserIdAndDeviceId(userId: string, deviceId: string): Promise<Device | null> {
		return this.findOne({
			where: { id: deviceId, userId },
		});
	}

	async findOldestVerifiedByUserId(userId: string): Promise<Device | null> {
		return this.findOne({
			where: { userId, isVerified: true },
			order: { createdAt: 'ASC' },
		});
	}
}

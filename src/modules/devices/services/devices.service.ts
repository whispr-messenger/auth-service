import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Device } from '../entities/device.entity';
import { DeviceRepository } from '../repositories/device.repository';
import { DeviceRegistrationData } from '../types/device-registration-data.interface';
import { DeviceRegistrationService } from './device-registration/device-registration.service';
import { DeviceActivityService } from './device-activity/device-activity.service';

/**
 * Main device management service.
 * Contains only basic CRUD operations and additional business logic.
 *
 * For specialized operations, inject directly:
 * - DeviceRegistrationService for registration and verification
 * - DeviceActivityService for activity management and FCM tokens
 * - DeviceStatsService for statistics
 */
@Injectable()
export class DevicesService {
	private readonly logger = new Logger(DevicesService.name);

	constructor(
		private readonly deviceRepository: DeviceRepository,
		private readonly deviceRegistrationService: DeviceRegistrationService,
		private readonly deviceActivityService: DeviceActivityService
	) { }

	async getUserDevices(userId: string): Promise<Device[]> {
		return this.deviceRepository.find({
			where: { userId },
			order: { lastActive: 'DESC' },
		});
	}

	async getVerifiedDevices(userId: string): Promise<Device[]> {
		return this.deviceRepository.findVerifiedByUserId(userId);
	}

	async getDevice(deviceId: string): Promise<Device> {
		const device = await this.deviceRepository.findOne({
			where: { id: deviceId },
		});

		if (!device) {
			throw new NotFoundException('Device not found');
		}

		return device;
	}

	async revokeDevice(userId: string, deviceId: string): Promise<void> {
		const device = await this.deviceRepository.findByUserIdAndDeviceId(userId, deviceId);

		if (!device) {
			throw new NotFoundException('Device not found');
		}

		await this.deviceRepository.remove(device);
		this.logger.log(`Device revoked: ${deviceId} for user: ${userId}`);
	}

	/**
	 * Delegation method for backwards compatibility.
	 * @deprecated Use DeviceRegistrationService.registerDevice directly
	 */
	async registerDevice(data: DeviceRegistrationData): Promise<Device> {
		return this.deviceRegistrationService.registerDevice(data);
	}

	/**
	 * Delegation method for backwards compatibility.
	 * @deprecated Use DeviceActivityService.updateLastActive directly
	 */
	async updateLastActive(deviceId: string): Promise<void> {
		return this.deviceActivityService.updateLastActive(deviceId);
	}
}

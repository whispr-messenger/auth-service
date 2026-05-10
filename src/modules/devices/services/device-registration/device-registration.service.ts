import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Device } from '../../entities/device.entity';
import { DeviceRepository } from '../../repositories/device.repository';
import { DeviceRegistrationData } from '../../types/device-registration-data.interface';
import { TokensService } from '../../../tokens/services/tokens.service';
import { buildWebDeviceName } from '../../utils/ua-device-name.util';

const MAX_DEVICES_PER_USER = 10;

@Injectable()
export class DeviceRegistrationService {
	private readonly logger = new Logger(DeviceRegistrationService.name);

	constructor(
		private readonly deviceRepository: DeviceRepository,
		private readonly tokensService: TokensService,
		@InjectDataSource() private readonly dataSource: DataSource
	) {}

	async registerDevice(data: DeviceRegistrationData): Promise<Device> {
		return this.dataSource.transaction(async (manager) => {
			const transactionRepository = manager.withRepository(this.deviceRepository);

			const existingDevice = await transactionRepository.findByUserAndFingerprint(
				data.userId,
				data.deviceName,
				data.deviceType,
				data.deviceFingerprint
			);

			if (existingDevice) {
				this.logger.log(`Updating existing device: ${existingDevice.id}`);
				return this.updateExistingDevice(existingDevice, data, transactionRepository);
			}

			const deviceCount = await transactionRepository.countVerifiedDevices(data.userId);
			if (deviceCount >= MAX_DEVICES_PER_USER) {
				await this.pruneOldestDevice(data.userId, transactionRepository);
			}

			const resolvedName = this.resolveDeviceName(data.deviceName, data.userAgent);
			this.logger.log(`Registering new device for user: ${data.userId}`);
			return this.createNewDevice({ ...data, deviceName: resolvedName }, transactionRepository);
		});
	}

	/**
	 * Supprime le device le plus ancien de l'utilisateur pour libérer une place.
	 * Invalide également ses tokens (force logout sur ce device).
	 */
	private async pruneOldestDevice(userId: string, repository: DeviceRepository): Promise<void> {
		const oldest = await repository.findOldestVerifiedByUserId(userId);
		if (!oldest) return;

		this.logger.warn(
			`device pruned : userId=${userId}, oldDeviceId=${oldest.id}, oldDeviceName=${oldest.deviceName}`
		);

		// Invalider les tokens avant suppression pour forcer le logout
		await this.tokensService.revokeAllTokensForDevice(oldest.id);
		await repository.remove(oldest);
	}

	/**
	 * Construit le nom du device.
	 * Si le client n'en fournit pas (web PWA), on extrait Browser/OS depuis le User-Agent.
	 */
	private resolveDeviceName(providedName: string, userAgent?: string): string {
		if (providedName && providedName.trim().length > 0) return providedName;
		return buildWebDeviceName(userAgent);
	}

	private async updateExistingDevice(
		existingDevice: Device,
		data: DeviceRegistrationData,
		repository: DeviceRepository
	): Promise<Device> {
		existingDevice.publicKey = data.publicKey;
		existingDevice.ipAddress = data.ipAddress || '';
		existingDevice.model = data.model || existingDevice.model;
		existingDevice.osVersion = data.osVersion || existingDevice.osVersion;
		existingDevice.appVersion = data.appVersion || existingDevice.appVersion;
		existingDevice.fcmToken = data.fcmToken || existingDevice.fcmToken;
		existingDevice.apnsToken = data.apnsToken || existingDevice.apnsToken;
		existingDevice.lastActive = new Date();
		existingDevice.isVerified = true;

		return repository.save(existingDevice);
	}

	private async createNewDevice(
		data: DeviceRegistrationData,
		repository: DeviceRepository
	): Promise<Device> {
		const device = repository.create({
			userId: data.userId,
			deviceName: data.deviceName,
			deviceType: data.deviceType,
			publicKey: data.publicKey,
			ipAddress: data.ipAddress,
			model: data.model,
			osVersion: data.osVersion,
			appVersion: data.appVersion,
			fcmToken: data.fcmToken,
			apnsToken: data.apnsToken,
			deviceFingerprint: data.deviceFingerprint,
			isVerified: true,
			lastActive: new Date(),
		});

		return repository.save(device);
	}

	async verifyDevice(deviceId: string): Promise<void> {
		const result = await this.deviceRepository.update({ id: deviceId }, { isVerified: true });

		if (result.affected === 0) {
			this.logger.warn(`No device found for verification: ${deviceId}`);
		} else {
			this.logger.log(`Device verified: ${deviceId}`);
		}
	}
}

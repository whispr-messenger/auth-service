import { Controller, Get, Param, NotFoundException, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SignalPreKeyBundleService } from '../services';
import { KeyBundleResponseDto, PreKeyStatusDto } from '../dto';
import {
	ApiGetKeyBundleForDeviceEndpoint,
	ApiGetPreKeyStatusEndpoint,
} from './signal-keys.controller.swagger';

/**
 * Public controller for retrieving Signal Protocol key bundles
 *
 * These endpoints allow users to fetch the public keys of other users
 * to initiate encrypted conversations using the X3DH protocol.
 */
@ApiTags('Signal Protocol - Key Bundles')
@Controller('signal/keys')
export class SignalKeysController {
	private readonly logger = new Logger(SignalKeysController.name);

	constructor(private readonly prKeyBundleService: SignalPreKeyBundleService) {}

	@Get(':userId/devices/:deviceId')
	@HttpCode(HttpStatus.OK)
	@ApiGetKeyBundleForDeviceEndpoint()
	async getKeyBundleForDevice(
		@Param('userId') userId: string,
		@Param('deviceId') deviceId: string
	): Promise<KeyBundleResponseDto> {
		this.logger.log(`Request for device key bundle: userId=${userId}, deviceId=${deviceId}`);

		try {
			return await this.prKeyBundleService.getBundleForUser(userId, deviceId);
		} catch (error) {
			if (error instanceof NotFoundException) {
				this.logger.warn(`Key bundle not found for user ${userId}, device ${deviceId}`);
				throw error;
			}
			this.logger.error(`Failed to get key bundle for user ${userId}, device ${deviceId}`, error.stack);
			throw error;
		}
	}

	@Get(':userId/devices/:deviceId/status')
	@HttpCode(HttpStatus.OK)
	@ApiGetPreKeyStatusEndpoint()
	async getPreKeyStatus(
		@Param('userId') userId: string,
		@Param('deviceId') deviceId: string
	): Promise<PreKeyStatusDto> {
		this.logger.log(`Request for prekey status: userId=${userId}, deviceId=${deviceId}`);

		return await this.prKeyBundleService.getPreKeyStatus(userId, deviceId);
	}
}

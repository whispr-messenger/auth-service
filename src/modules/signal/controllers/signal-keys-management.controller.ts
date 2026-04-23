import {
	Controller,
	Post,
	Get,
	Delete,
	Body,
	Param,
	Req,
	UseGuards,
	HttpCode,
	HttpStatus,
	Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../tokens/guards';
import { AuthenticatedRequest } from '../../tokens/types/authenticated-request.interface';
import { SignalKeyRotationService, SignalKeyValidationService, SignalKeyStorageService } from '../services';
import { DevicesService } from '../../devices/services';
import {
	SignedPreKeyDto,
	UploadPreKeysDto,
	RotationRecommendationsDto,
	SignedPreKeyUploadResponseDto,
	PreKeysUploadResponseDto,
} from '../dto';
import {
	ApiDeleteAllKeysEndpoint,
	ApiDeleteDeviceKeysEndpoint,
	ApiGetRotationRecommendationsEndpoint,
	ApiUploadPreKeysEndpoint,
	ApiUploadSignedPreKeyEndpoint,
} from './signal-keys-management.controller.swagger';

/**
 * Controller for managing Signal Protocol keys
 *
 * Provides endpoints for uploading, rotating, and deleting keys.
 * These endpoints require authentication.
 */
@ApiTags('Signal Protocol - Key Management')
@Controller('signal/keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class SignalKeysManagementController {
	private readonly logger = new Logger(SignalKeysManagementController.name);

	constructor(
		private readonly rotationService: SignalKeyRotationService,
		private readonly validationService: SignalKeyValidationService,
		private readonly storageService: SignalKeyStorageService,
		private readonly devicesService: DevicesService
	) {}

	@Post('signed-prekey')
	@HttpCode(HttpStatus.CREATED)
	@ApiUploadSignedPreKeyEndpoint()
	async uploadSignedPreKey(
		@Body() signedPreKey: SignedPreKeyDto,
		@Req() req: AuthenticatedRequest
	): Promise<SignedPreKeyUploadResponseDto> {
		const userId = req.user.sub;
		const deviceId = req.user.deviceId;

		this.logger.log(`Upload signed prekey request from user ${userId}, device ${deviceId}`);

		// Validate the signed prekey
		this.validationService.validateSignedPreKey(signedPreKey);

		// Check uniqueness
		await this.validationService.validateSignedPreKeyIdUniqueness(userId, deviceId, signedPreKey.keyId);

		// Rotate the key
		await this.rotationService.rotateSignedPreKey(userId, deviceId, signedPreKey);

		return {
			message: 'Signed prekey uploaded successfully',
		};
	}

	@Post('prekeys')
	@HttpCode(HttpStatus.CREATED)
	@ApiUploadPreKeysEndpoint()
	async uploadPreKeys(
		@Body() uploadDto: UploadPreKeysDto,
		@Req() req: AuthenticatedRequest
	): Promise<PreKeysUploadResponseDto> {
		const userId = req.user.sub;
		const deviceId = req.user.deviceId;

		this.logger.log(
			`Upload ${uploadDto.preKeys.length} prekeys request from user ${userId}, device ${deviceId}`
		);

		// Validate all prekeys
		this.validationService.validatePreKeys(uploadDto.preKeys);

		// Replenish the keys
		await this.rotationService.replenishPreKeys(userId, deviceId, uploadDto.preKeys);

		return {
			message: 'PreKeys uploaded successfully',
			uploaded: uploadDto.preKeys.length,
		};
	}

	@Get('recommendations')
	@HttpCode(HttpStatus.OK)
	@ApiGetRotationRecommendationsEndpoint()
	async getRotationRecommendations(@Req() req: AuthenticatedRequest): Promise<RotationRecommendationsDto> {
		const userId = req.user.sub;
		const deviceId = req.user.deviceId;

		this.logger.log(`Get rotation recommendations for user ${userId}, device ${deviceId}`);

		return await this.rotationService.getRotationRecommendations(userId, deviceId);
	}

	@Delete('device/:deviceId')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiDeleteDeviceKeysEndpoint()
	async deleteDeviceKeys(
		@Param('deviceId') deviceId: string,
		@Req() req: AuthenticatedRequest
	): Promise<void> {
		const userId = req.user.sub;

		this.logger.log(`Delete keys for device ${deviceId} by user ${userId}`);

		// Verify the device belongs to the user
		await this.devicesService.revokeDevice(userId, deviceId);

		// Delete only the keys for this specific device
		await this.storageService.deleteAllKeysForDevice(userId, deviceId);

		this.logger.log(`Successfully deleted keys for device ${deviceId}`);
	}

	@Delete()
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiDeleteAllKeysEndpoint()
	async deleteAllKeys(@Req() req: AuthenticatedRequest): Promise<void> {
		const userId = req.user.sub;

		this.logger.log(`Delete all keys for user ${userId}`);

		await this.storageService.deleteAllKeysForUser(userId);

		this.logger.log(`Successfully deleted all keys for user ${userId}`);
	}
}

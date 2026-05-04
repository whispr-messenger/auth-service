import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
	SignedPreKeyDto,
	UploadPreKeysDto,
	RotationRecommendationsDto,
	SignedPreKeyUploadResponseDto,
	PreKeysUploadResponseDto,
} from '../dto';
import {
	SIGNED_PREKEY_UPLOAD_RESPONSE_SCHEMA,
	SIGNED_PREKEY_UPLOAD_EXAMPLES,
	SIGNED_PREKEY_UPLOAD_RESPONSE_EXAMPLES,
	PREKEYS_UPLOAD_RESPONSE_SCHEMA,
	PREKEYS_UPLOAD_EXAMPLES,
	PREKEYS_UPLOAD_RESPONSE_EXAMPLES,
} from '../swagger/signal-keys-management.schemas';

export const ApiUploadSignedPreKeyEndpoint = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Upload a new signed prekey',
			description:
				'Uploads a new signed prekey for key rotation. This should be done every 7 days to maintain forward secrecy.',
		}),
		ApiBody({
			type: SignedPreKeyDto,
			description: 'The new signed prekey to upload',
			examples: SIGNED_PREKEY_UPLOAD_EXAMPLES,
		}),
		ApiResponse({
			status: 201,
			description: 'Signed prekey uploaded successfully',
			type: SignedPreKeyUploadResponseDto,
			schema: SIGNED_PREKEY_UPLOAD_RESPONSE_SCHEMA,
			examples: SIGNED_PREKEY_UPLOAD_RESPONSE_EXAMPLES,
		}),
		ApiResponse({ status: 400, description: 'Invalid key format or validation failed' }),
		ApiResponse({ status: 401, description: 'Unauthorized' })
	);

export const ApiUploadPreKeysEndpoint = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Upload new prekeys',
			description:
				'Uploads a batch of new one-time prekeys. Should be called when prekey count falls below 20.',
		}),
		ApiBody({
			type: UploadPreKeysDto,
			description: 'Array of prekeys to upload',
			examples: PREKEYS_UPLOAD_EXAMPLES,
		}),
		ApiResponse({
			status: 201,
			description: 'PreKeys uploaded successfully',
			type: PreKeysUploadResponseDto,
			schema: PREKEYS_UPLOAD_RESPONSE_SCHEMA,
			examples: PREKEYS_UPLOAD_RESPONSE_EXAMPLES,
		}),
		ApiResponse({ status: 400, description: 'Invalid key format or too many keys' }),
		ApiResponse({ status: 401, description: 'Unauthorized' })
	);

export const ApiGetRotationRecommendationsEndpoint = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Get key rotation recommendations',
			description: 'Returns recommendations about which keys need to be rotated or replenished.',
		}),
		ApiResponse({
			status: 200,
			description: 'Rotation recommendations retrieved',
			type: RotationRecommendationsDto,
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' })
	);

export const ApiDeleteDeviceKeysEndpoint = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Delete keys for a device',
			description:
				'Deletes all Signal Protocol keys associated with a specific device. Used when removing a device.',
		}),
		ApiParam({
			name: 'deviceId',
			description: 'The UUID of the device',
			example: '987fcdeb-51a2-43f7-9c8d-123456789abc',
		}),
		ApiResponse({ status: 204, description: 'Device keys deleted successfully' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({ status: 403, description: 'Forbidden - not your device' })
	);

export const ApiDeleteAllKeysEndpoint = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Delete all keys',
			description: 'Deletes all Signal Protocol keys for the authenticated user. Use with caution.',
		}),
		ApiResponse({ status: 204, description: 'All keys deleted successfully' }),
		ApiResponse({ status: 401, description: 'Unauthorized' })
	);

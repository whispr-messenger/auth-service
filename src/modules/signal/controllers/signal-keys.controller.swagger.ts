import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { KeyBundleResponseDto, PreKeyStatusDto } from '../dto';

export const ApiGetKeyBundleForDeviceEndpoint = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Get key bundle for a specific device',
			description:
				'Retrieves the Signal Protocol key bundle for a specific device of a user. Used in multi-device scenarios.',
		}),
		ApiParam({
			name: 'userId',
			description: 'The UUID of the user',
			example: '123e4567-e89b-12d3-a456-426614174000',
		}),
		ApiParam({
			name: 'deviceId',
			description: 'The UUID of the device',
			example: '987fcdeb-51a2-43f7-9c8d-123456789abc',
		}),
		ApiResponse({
			status: 200,
			description: 'Device key bundle successfully retrieved',
			type: KeyBundleResponseDto,
		}),
		ApiResponse({ status: 404, description: 'User or device not found' })
	);

export const ApiGetPreKeyStatusEndpoint = () =>
	applyDecorators(
		ApiBearerAuth(),
		ApiOperation({
			summary: 'Get prekey status for a device',
			description:
				'Returns information about the number of available prekeys and whether the device needs to upload more. Used for monitoring and alerting.',
		}),
		ApiParam({
			name: 'userId',
			description: 'The UUID of the user',
			example: '123e4567-e89b-12d3-a456-426614174000',
		}),
		ApiParam({
			name: 'deviceId',
			description: 'The UUID of the device',
			example: '987fcdeb-51a2-43f7-9c8d-123456789abc',
		}),
		ApiResponse({
			status: 200,
			description: 'PreKey status retrieved successfully',
			type: PreKeyStatusDto,
		})
	);

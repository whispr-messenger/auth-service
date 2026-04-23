import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { DeviceResponseDto } from '../dto';

export const ApiGetDevicesEndpoint = () =>
	applyDecorators(
		ApiBearerAuth(),
		ApiOperation({ summary: 'Get all devices associated with user account' }),
		ApiResponse({ status: 200, description: 'List of user devices', type: [DeviceResponseDto] }),
		ApiResponse({ status: 401, description: 'Unauthorized' })
	);

export const ApiRevokeDeviceEndpoint = () =>
	applyDecorators(
		ApiBearerAuth(),
		ApiOperation({ summary: 'Revoke/delete a specific device' }),
		ApiParam({ name: 'deviceId', description: 'UUID of the device to revoke', type: String }),
		ApiResponse({ status: 204, description: 'Device successfully revoked' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({ status: 404, description: 'Device not found' })
	);

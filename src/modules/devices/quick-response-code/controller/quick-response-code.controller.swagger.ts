import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ScanLoginDto } from '../dto/scan-login.dto';
import { ScanLoginResponseDto } from '../dto/scan-login-response.dto';

export const ApiGenerateQRChallengeEndpoint = () =>
	applyDecorators(
		ApiBearerAuth(),
		ApiOperation({
			summary: 'Generate QR code challenge for device authentication',
			description:
				'Generates a short-lived signed JWT (ES256) that the authenticated device must display as a QR code for another device to scan and log in.',
		}),
		ApiParam({
			name: 'deviceId',
			description:
				'UUID of the device to generate a QR challenge for. Must belong to the authenticated user.',
			type: String,
		}),
		ApiResponse({
			status: 201,
			description: 'QR challenge generated successfully — returns the signed JWT challenge as a JSON string',
			schema: {
				type: 'string',
				example: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...',
			},
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({ status: 403, description: 'Device does not belong to the authenticated user' }),
		ApiResponse({ status: 404, description: 'Device not found' })
	);

export const ApiScanLoginEndpoint = () =>
	applyDecorators(
		ApiOperation({
			summary: 'Login by scanning QR code',
			description:
				'Validates the JWT challenge scanned from another device and issues access/refresh tokens for the scanning device.',
		}),
		ApiBody({ type: ScanLoginDto }),
		ApiResponse({
			status: 200,
			description: 'QR code login successful — returns a new token pair',
			type: ScanLoginResponseDto,
		}),
		ApiResponse({ status: 400, description: 'Invalid QR code data' }),
		ApiResponse({ status: 401, description: 'Invalid or expired challenge' })
	);

import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RefreshTokenResponseDto } from '../dto/refresh-token-response.dto';

export const ApiRefreshTokenEndpoint = () =>
	applyDecorators(
		ApiOperation({ summary: 'Refresh access token using refresh token' }),
		ApiBody({ type: RefreshTokenDto }),
		ApiHeader({
			name: 'x-device-type',
			required: false,
			description: 'Device type used when deriving the fingerprint (must match the original login)',
			example: 'ios',
		}),
		ApiResponse({
			status: 200,
			description: 'Token refreshed successfully. The previous refresh token is revoked.',
			type: RefreshTokenResponseDto,
		}),
		ApiResponse({
			status: 401,
			description: 'Invalid or expired refresh token, or device fingerprint mismatch',
		})
	);

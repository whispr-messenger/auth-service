import { applyDecorators } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiBody,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiResponse,
} from '@nestjs/swagger';
import {
	TwoFactorBackupCodesResponseDto,
	TwoFactorDisableResponseDto,
	TwoFactorSetupDto,
	TwoFactorSetupResponseDto,
	TwoFactorStatusResponseDto,
	TwoFactorVerifyDto,
	TwoFactorVerifyResponseDto,
} from '../dto';

export const ApiSetupTwoFactorEndpoint = () =>
	applyDecorators(
		ApiBearerAuth(),
		ApiOperation({ summary: 'Setup two-factor authentication (2FA)' }),
		ApiCreatedResponse({
			description: 'Returns QR code URL, secret, and otpauthUri for 2FA setup',
			type: TwoFactorSetupResponseDto,
		}),
		ApiResponse({ status: 401, description: 'Unauthorized' })
	);

export const ApiEnableTwoFactorEndpoint = () =>
	applyDecorators(
		ApiBearerAuth(),
		ApiOperation({ summary: 'Enable two-factor authentication' }),
		ApiBody({ type: TwoFactorSetupDto }),
		ApiOkResponse({
			type: TwoFactorBackupCodesResponseDto,
			description: '2FA enabled successfully; returns backup codes',
		}),
		ApiResponse({ status: 400, description: 'Invalid token or 2FA setup not initiated' }),
		ApiResponse({ status: 401, description: 'Unauthorized' })
	);

export const ApiVerifyTwoFactorEndpoint = () =>
	applyDecorators(
		ApiBearerAuth(),
		ApiOperation({ summary: 'Verify two-factor authentication token' }),
		ApiBody({ type: TwoFactorVerifyDto }),
		ApiOkResponse({ type: TwoFactorVerifyResponseDto, description: 'Token verification result' }),
		ApiResponse({ status: 401, description: 'Unauthorized' })
	);

export const ApiDisableTwoFactorEndpoint = () =>
	applyDecorators(
		ApiBearerAuth(),
		ApiOperation({ summary: 'Disable two-factor authentication' }),
		ApiBody({ type: TwoFactorVerifyDto }),
		ApiOkResponse({ type: TwoFactorDisableResponseDto, description: '2FA disabled successfully' }),
		ApiResponse({ status: 400, description: 'Invalid token' }),
		ApiResponse({ status: 401, description: 'Unauthorized' })
	);

export const ApiGenerateBackupCodesEndpoint = () =>
	applyDecorators(
		ApiBearerAuth(),
		ApiOperation({ summary: 'Generate new 2FA backup codes' }),
		ApiBody({ type: TwoFactorVerifyDto }),
		ApiOkResponse({ type: TwoFactorBackupCodesResponseDto, description: 'New backup codes generated' }),
		ApiResponse({ status: 400, description: 'Invalid token' }),
		ApiResponse({ status: 401, description: 'Unauthorized' })
	);

export const ApiRegenerateBackupCodesEndpoint = () =>
	applyDecorators(
		ApiBearerAuth(),
		ApiOperation({ summary: 'Rotate 2FA backup codes (replaces all existing codes)' }),
		ApiBody({ type: TwoFactorVerifyDto }),
		ApiOkResponse({ type: TwoFactorBackupCodesResponseDto, description: 'Backup codes rotated' }),
		ApiResponse({ status: 400, description: 'Invalid token or 2FA not enabled' }),
		ApiResponse({ status: 401, description: 'Unauthorized' })
	);

export const ApiGetRemainingBackupCodesEndpoint = () =>
	applyDecorators(
		ApiBearerAuth(),
		ApiOperation({ summary: 'Get remaining (unused) 2FA backup codes count' }),
		ApiOkResponse({ description: 'Returns the number of unused backup codes' }),
		ApiResponse({ status: 401, description: 'Unauthorized' })
	);

export const ApiGetTwoFactorStatusEndpoint = () =>
	applyDecorators(
		ApiBearerAuth(),
		ApiOperation({ summary: 'Get two-factor authentication status' }),
		ApiOkResponse({ type: TwoFactorStatusResponseDto, description: 'Returns 2FA enabled status' }),
		ApiResponse({ status: 401, description: 'Unauthorized' })
	);

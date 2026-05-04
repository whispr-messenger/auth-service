import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LoginDto, LoginResponseDto, LogoutDto, RegisterDto, RegisterResponseDto } from '../dto';

export const ApiRegisterEndpoint = () =>
	applyDecorators(
		ApiOperation({ summary: 'Register a new user account' }),
		ApiBody({ type: RegisterDto }),
		ApiResponse({ status: 201, description: 'User successfully registered', type: RegisterResponseDto }),
		ApiResponse({ status: 400, description: 'Invalid registration data' }),
		ApiResponse({ status: 409, description: 'User already exists' })
	);

export const ApiLoginEndpoint = () =>
	applyDecorators(
		ApiOperation({ summary: 'Login to user account' }),
		ApiBody({ type: LoginDto }),
		ApiResponse({
			status: 200,
			description: 'Login successful, returns access and refresh tokens',
			type: LoginResponseDto,
		}),
		ApiResponse({ status: 401, description: 'Invalid credentials' })
	);

export const ApiLogoutEndpoint = () =>
	applyDecorators(
		ApiBearerAuth(),
		ApiOperation({ summary: 'Logout and invalidate current session' }),
		ApiBody({ type: LogoutDto }),
		ApiResponse({ status: 204, description: 'Successfully logged out' }),
		ApiResponse({ status: 401, description: 'Unauthorized' }),
		ApiResponse({ status: 403, description: 'deviceId does not belong to the authenticated user' })
	);

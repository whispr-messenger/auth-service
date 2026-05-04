import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	VerificationConfirmDto,
	VerificationConfirmResponseDto,
	VerificationLoginResponseDto,
	VerificationRequestDto,
	VerificationRequestResponseDto,
} from '../dto';
import {
	VERIFICATION_CONFIRM_EXAMPLES,
	VERIFICATION_REQUEST_EXAMPLES,
} from '../swagger/phone-verification.examples';

export const ApiRequestRegistrationVerificationEndpoint = () =>
	applyDecorators(
		ApiOperation({ summary: 'Request registration verification code' }),
		ApiBody({ type: VerificationRequestDto, examples: VERIFICATION_REQUEST_EXAMPLES }),
		ApiResponse({
			status: 200,
			description: 'Verification code sent successfully',
			type: VerificationRequestResponseDto,
		}),
		ApiResponse({ status: 400, description: 'Bad request' }),
		ApiResponse({ status: 429, description: 'Too many requests' })
	);

export const ApiConfirmRegistrationVerificationEndpoint = () =>
	applyDecorators(
		ApiOperation({ summary: 'Confirm registration verification code' }),
		ApiBody({ type: VerificationConfirmDto, examples: VERIFICATION_CONFIRM_EXAMPLES }),
		ApiResponse({
			status: 200,
			description: 'Verification code confirmed',
			type: VerificationConfirmResponseDto,
		}),
		ApiResponse({
			status: 400,
			description: 'Incorrect verification code — or invalid/expired verification session',
		}),
		ApiResponse({
			status: 429,
			description: 'Too many verification attempts — session deleted, subsequent requests return 400',
		})
	);

export const ApiRequestLoginVerificationEndpoint = () =>
	applyDecorators(
		ApiOperation({ summary: 'Request login verification code' }),
		ApiBody({ type: VerificationRequestDto, examples: VERIFICATION_REQUEST_EXAMPLES }),
		ApiResponse({
			status: 200,
			description: 'Verification code sent successfully',
			type: VerificationRequestResponseDto,
		}),
		ApiResponse({ status: 400, description: 'Bad request' }),
		ApiResponse({ status: 429, description: 'Too many requests' })
	);

export const ApiConfirmLoginVerificationEndpoint = () =>
	applyDecorators(
		ApiOperation({ summary: 'Confirm login verification code' }),
		ApiBody({ type: VerificationConfirmDto, examples: VERIFICATION_CONFIRM_EXAMPLES }),
		ApiResponse({
			status: 200,
			description: 'Verification code confirmed',
			type: VerificationLoginResponseDto,
		}),
		ApiResponse({
			status: 400,
			description:
				'Incorrect verification code, invalid/expired verification session, or user not found',
		}),
		ApiResponse({
			status: 429,
			description: 'Too many verification attempts — session deleted, subsequent requests return 400',
		})
	);

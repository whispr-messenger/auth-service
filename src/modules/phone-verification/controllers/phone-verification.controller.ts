import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	VerificationConfirmDto,
	VerificationConfirmResponseDto,
	VerificationLoginResponseDto,
	VerificationRequestDto,
	VerificationRequestResponseDto,
} from '../dto';
import { PhoneVerificationService } from '../services';
import {
	VERIFICATION_CONFIRM_EXAMPLES,
	VERIFICATION_REQUEST_EXAMPLES,
} from '../swagger/phone-verification.examples';

@ApiTags('Auth - Phone Number Verification')
@Controller('verify')
export class PhoneVerificationController {
	constructor(private readonly phoneVerificationService: PhoneVerificationService) {}

	@Post('register/request')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Request registration verification code' })
	@ApiBody({ type: VerificationRequestDto, examples: VERIFICATION_REQUEST_EXAMPLES })
	@ApiResponse({ status: 200, description: 'Verification code sent successfully' })
	@ApiResponse({ status: 400, description: 'Bad request' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	async requestRegistrationVerification(
		@Body() dto: VerificationRequestDto,
		@Req() req: Request
	): Promise<VerificationRequestResponseDto> {
		return this.phoneVerificationService.requestRegistrationVerification(dto, req.ip);
	}

	@Post('register/confirm')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Confirm registration verification code' })
	@ApiBody({ type: VerificationConfirmDto, examples: VERIFICATION_CONFIRM_EXAMPLES })
	@ApiResponse({
		status: 200,
		description: 'Verification code confirmed',
		type: VerificationConfirmResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Incorrect verification code — or invalid/expired verification session',
	})
	@ApiResponse({
		status: 429,
		description: 'Too many verification attempts — session deleted, subsequent requests return 400',
	})
	async confirmRegistrationVerification(
		@Body() dto: VerificationConfirmDto
	): Promise<VerificationConfirmResponseDto> {
		return this.phoneVerificationService.confirmRegistrationVerification(dto);
	}

	@Post('login/request')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Request login verification code' })
	@ApiBody({ type: VerificationRequestDto, examples: VERIFICATION_REQUEST_EXAMPLES })
	@ApiResponse({ status: 200, description: 'Verification code sent successfully' })
	@ApiResponse({ status: 400, description: 'Bad request' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	async requestLoginVerification(
		@Body() dto: VerificationRequestDto,
		@Req() req: Request
	): Promise<VerificationRequestResponseDto> {
		return this.phoneVerificationService.requestLoginVerification(dto, req.ip);
	}

	@Post('login/confirm')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Confirm login verification code' })
	@ApiBody({ type: VerificationConfirmDto, examples: VERIFICATION_CONFIRM_EXAMPLES })
	@ApiResponse({
		status: 200,
		description: 'Verification code confirmed',
		type: VerificationLoginResponseDto,
	})
	@ApiResponse({
		status: 400,
		description: 'Incorrect verification code, invalid/expired verification session, or user not found',
	})
	@ApiResponse({
		status: 429,
		description: 'Too many verification attempts — session deleted, subsequent requests return 400',
	})
	async confirmLoginVerification(
		@Body() dto: VerificationConfirmDto
	): Promise<VerificationLoginResponseDto> {
		return this.phoneVerificationService.confirmLoginVerification(dto);
	}
}

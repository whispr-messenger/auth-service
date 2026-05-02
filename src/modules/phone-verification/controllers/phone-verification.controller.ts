import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
	VerificationConfirmDto,
	VerificationConfirmResponseDto,
	VerificationLoginResponseDto,
	VerificationRequestDto,
	VerificationRequestResponseDto,
} from '../dto';
import { PhoneVerificationService } from '../services';
import { AdaptiveRateLimitInterceptor } from '../../adaptive-rate-limit/adaptive-rate-limit.interceptor';
import {
	ApiConfirmLoginVerificationEndpoint,
	ApiConfirmRegistrationVerificationEndpoint,
	ApiRequestLoginVerificationEndpoint,
	ApiRequestRegistrationVerificationEndpoint,
} from './phone-verification.controller.swagger';

@ApiTags('Auth - Phone Number Verification')
@Controller('verify')
// WHISPR-1054: confirm endpoints are the real brute-force target — an OTP
// is only 6 digits, so we add an adaptive cooldown on top of the global
// throttler. request endpoints rotate via the same interceptor to punish
// fingerprint replay as well.
@UseInterceptors(AdaptiveRateLimitInterceptor)
export class PhoneVerificationController {
	constructor(private readonly phoneVerificationService: PhoneVerificationService) {}

	@Post('register/request')
	@HttpCode(HttpStatus.OK)
	@ApiRequestRegistrationVerificationEndpoint()
	async requestRegistrationVerification(
		@Body() dto: VerificationRequestDto,
		@Req() req: Request
	): Promise<VerificationRequestResponseDto> {
		return this.phoneVerificationService.requestRegistrationVerification(dto, req.ip);
	}

	@Post('register/confirm')
	@HttpCode(HttpStatus.OK)
	@ApiConfirmRegistrationVerificationEndpoint()
	async confirmRegistrationVerification(
		@Body() dto: VerificationConfirmDto
	): Promise<VerificationConfirmResponseDto> {
		return this.phoneVerificationService.confirmRegistrationVerification(dto);
	}

	@Post('login/request')
	@HttpCode(HttpStatus.OK)
	@ApiRequestLoginVerificationEndpoint()
	async requestLoginVerification(
		@Body() dto: VerificationRequestDto,
		@Req() req: Request
	): Promise<VerificationRequestResponseDto> {
		return this.phoneVerificationService.requestLoginVerification(dto, req.ip);
	}

	@Post('login/confirm')
	@HttpCode(HttpStatus.OK)
	@ApiConfirmLoginVerificationEndpoint()
	async confirmLoginVerification(
		@Body() dto: VerificationConfirmDto
	): Promise<VerificationLoginResponseDto> {
		return this.phoneVerificationService.confirmLoginVerification(dto);
	}
}

import { Body, Controller, Headers, HttpCode, HttpStatus, Request, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { DeviceFingerprint } from '../../devices/types/device-fingerprint.interface';
import { TokensService } from '../services/tokens.service';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RefreshTokenResponseDto } from '../dto/refresh-token-response.dto';
import { ApiRefreshTokenEndpoint } from './tokens.controller.swagger';

@ApiTags('Tokens')
@Controller('tokens')
export class TokensController {
	constructor(private readonly tokensService: TokensService) {}

	@Post('refresh')
	@HttpCode(HttpStatus.OK)
	@ApiRefreshTokenEndpoint()
	async refreshToken(
		@Body() dto: RefreshTokenDto,
		@Request() req: ExpressRequest,
		@Headers('x-device-type') deviceType?: string
	): Promise<RefreshTokenResponseDto> {
		const fingerprint: DeviceFingerprint = {
			userAgent: req.headers['user-agent'],
			ipAddress: req.ip,
			deviceType: deviceType?.trim() || 'unknown',
			timestamp: Date.now(),
		};

		return this.tokensService.refreshAccessToken(dto.refreshToken, fingerprint);
	}
}

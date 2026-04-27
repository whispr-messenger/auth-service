import { Body, Controller, Headers, HttpCode, HttpStatus, Request, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { DeviceFingerprint } from '../../devices/types/device-fingerprint.interface';
import { TokensService } from '../services/tokens.service';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RefreshTokenResponseDto } from '../dto/refresh-token-response.dto';
import { WsTokenResponseDto } from '../dto/ws-token-response.dto';
import { ApiRefreshTokenEndpoint } from './tokens.controller.swagger';
import { JwtAuthGuard } from '../guards';

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

	@Post('ws-token')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiBearerAuth()
	@ApiOperation({
		summary: 'Issue a short-lived JWT for the Phoenix WebSocket handshake',
		description:
			'Returns a 60-second JWT with audience "ws" so the long-lived access token never travels in the WS query string. WHISPR-1214.',
	})
	@ApiResponse({ status: 200, description: 'WebSocket token issued', type: WsTokenResponseDto })
	@ApiResponse({ status: 401, description: 'Missing, invalid, expired or revoked access token' })
	issueWsToken(
		@Request() req: ExpressRequest & { user: { sub: string; deviceId: string } }
	): WsTokenResponseDto {
		const { sub: userId, deviceId } = req.user;
		return this.tokensService.generateWsToken(userId, deviceId);
	}
}

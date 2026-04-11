import { Body, Controller, Headers, HttpCode, HttpStatus, Request, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeviceFingerprint } from '../../devices/types/device-fingerprint.interface';
import { TokensService } from '../services/tokens.service';
import { RefreshTokenDto } from '../dto/refresh-token.dto';

@ApiTags('Tokens')
@Controller('tokens')
export class TokensController {
	constructor(private readonly tokensService: TokensService) {}

	@Post('refresh')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Refresh access token using refresh token' })
	@ApiBody({ type: RefreshTokenDto })
	@ApiResponse({ status: 200, description: 'Token refreshed successfully' })
	@ApiResponse({
		status: 401,
		description: 'Invalid or expired refresh token',
	})
	async refreshToken(
		@Body() dto: RefreshTokenDto,
		@Request() req: any,
		@Headers('x-device-type') deviceType?: string
	) {
		const fingerprint: DeviceFingerprint = {
			userAgent: req.headers['user-agent'],
			ipAddress: req.ip,
			deviceType: deviceType?.trim() || 'unknown',
			timestamp: Date.now(),
		};

		return this.tokensService.refreshAccessToken(dto.refreshToken, fingerprint);
	}
}

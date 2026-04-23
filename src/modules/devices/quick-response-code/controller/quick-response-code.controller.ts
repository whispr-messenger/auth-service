import { Body, Controller, HttpCode, HttpStatus, Request, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../../../tokens/guards';
import { AuthenticatedRequest } from '../../../tokens/types/authenticated-request.interface';
import { DeviceFingerprintService } from '../../services/device-fingerprint/device-fingerprint.service';
import { QuickResponseCodeService } from '../services/quick-response-code.service';
import { ScanLoginDto } from '../dto/scan-login.dto';
import { ScanLoginResponseDto } from '../dto/scan-login-response.dto';
import {
	ApiGenerateQRChallengeEndpoint,
	ApiScanLoginEndpoint,
} from './quick-response-code.controller.swagger';

@ApiTags('Auth - QR Codes')
@Controller('qr-code')
export class QuickResponseCodeController {
	constructor(
		private readonly quickResponseCodeService: QuickResponseCodeService,
		private readonly fingerprintService: DeviceFingerprintService
	) {}

	@Post('/challenge/:deviceId')
	@UseGuards(JwtAuthGuard)
	@ApiGenerateQRChallengeEndpoint()
	async generateQRChallenge(@Param('deviceId') deviceId: string, @Request() req: AuthenticatedRequest) {
		return this.quickResponseCodeService.generateQRChallenge(deviceId, req.user.sub);
	}

	@Post('scan')
	@HttpCode(HttpStatus.OK)
	@ApiScanLoginEndpoint()
	async scanLogin(
		@Body() dto: ScanLoginDto,
		@Request() req: ExpressRequest
	): Promise<ScanLoginResponseDto> {
		const fingerprint = this.fingerprintService.extractFingerprint(req, dto.deviceType);
		return this.quickResponseCodeService.scanLogin(dto, fingerprint);
	}
}

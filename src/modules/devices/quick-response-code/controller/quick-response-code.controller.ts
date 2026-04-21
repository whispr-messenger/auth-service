import { Body, Controller, HttpCode, HttpStatus, Request, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../../../tokens/guards';
import { DeviceFingerprintService } from '../../services/device-fingerprint/device-fingerprint.service';
import { QuickResponseCodeService } from '../services/quick-response-code.service';
import { ScanLoginDto } from '../dto/scan-login.dto';

@ApiTags('Auth - QR Codes')
@Controller('qr-code')
export class QuickResponseCodeController {
	constructor(
		private readonly quickResponseCodeService: QuickResponseCodeService,
		private readonly fingerprintService: DeviceFingerprintService
	) {}

	@Post('/challenge/:deviceId')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Generate QR code challenge for device authentication' })
	@ApiParam({
		name: 'deviceId',
		description: 'UUID of the device to generate a QR challenge for',
		type: String,
	})
	@ApiResponse({ status: 200, description: 'QR challenge generated successfully' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 404, description: 'Device not found' })
	async generateQRChallenge(@Param('deviceId') deviceId: string) {
		return this.quickResponseCodeService.generateQRChallenge(deviceId);
	}

	@Post('scan')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Login by scanning QR code' })
	@ApiBody({ type: ScanLoginDto })
	@ApiResponse({ status: 200, description: 'QR code login successful' })
	@ApiResponse({ status: 400, description: 'Invalid QR code data' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async scanLogin(@Body() dto: ScanLoginDto, @Request() req: ExpressRequest) {
		const fingerprint = this.fingerprintService.extractFingerprint(req, dto.deviceType);
		return this.quickResponseCodeService.scanLogin(dto, fingerprint);
	}
}

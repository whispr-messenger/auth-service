import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Request,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/modules/authentication/guards'
import { DeviceFingerprint } from '../device-fingerprint.interface'
import { ScanLoginDto } from '../scan-login.dto'
import { QuickResponseCodeService } from './quick-response-code.service'

@Controller('quick-response-code')
export class QuickResponseCodeController {
    constructor(
        private readonly quickResponseCodeService: QuickResponseCodeService
    ) {}

    @Post('/challeng/:deviceId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Generate QR code challenge for device authentication',
    })
    @ApiResponse({
        status: 200,
        description: 'QR challenge generated successfully',
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Device not found' })
    async generateQRChallenge(@Param('deviceId') deviceId: string) {
        return this.quickResponseCodeService.generateQRChallenge(deviceId)
    }

    @Post('scan-login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login by scanning QR code' })
    @ApiResponse({ status: 200, description: 'QR code login successful' })
    @ApiResponse({ status: 400, description: 'Invalid QR code data' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async scanLogin(@Body() dto: ScanLoginDto, @Request() req: any) {
        const fingerprint: DeviceFingerprint = {
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip,
            deviceType: dto.deviceType,
            timestamp: Date.now(),
        }
        return this.quickResponseCodeService.scanLogin(dto, fingerprint)
    }
}

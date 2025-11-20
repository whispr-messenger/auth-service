import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TwoFactorService } from './services/two-factor/two-factor.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import {
  VerificationRequestDto,
  VerificationConfirmDto,
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ScanLoginDto,
  TwoFactorSetupDto,
  TwoFactorVerifyDto,
} from '../../dto/auth';
import { DeviceFingerprint } from '../../interfaces/verification.interface';
import { AuthService } from './services/auth/auth.service';
import { DeviceService } from './services/device/device.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
    private readonly deviceService: DeviceService
  ) {}

  @Post('register/verify/request')
  @HttpCode(HttpStatus.OK)
  async requestRegistrationVerification(@Body() dto: VerificationRequestDto) {
    return this.authService.requestRegistrationVerification(dto);
  }

  @Post('register/verify/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmRegistrationVerification(@Body() dto: VerificationConfirmDto) {
    return this.authService.confirmRegistrationVerification(dto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Request() req: any) {
    const fingerprint: DeviceFingerprint = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      deviceType: dto.deviceType,
      timestamp: Date.now(),
    };
    return this.authService.register(dto, fingerprint);
  }

  @Post('login/verify/request')
  @HttpCode(HttpStatus.OK)
  async requestLoginVerification(@Body() dto: VerificationRequestDto) {
    return this.authService.requestLoginVerification(dto);
  }

  @Post('login/verify/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmLoginVerification(@Body() dto: VerificationConfirmDto) {
    return this.authService.confirmLoginVerification(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Request() req: any) {
    const fingerprint: DeviceFingerprint = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      deviceType: dto.deviceType,
      timestamp: Date.now(),
    };
    return this.authService.login(dto, fingerprint);
  }

  @Post('scan-login')
  @HttpCode(HttpStatus.OK)
  async scanLogin(@Body() dto: ScanLoginDto, @Request() req: any) {
    const fingerprint: DeviceFingerprint = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      deviceType: dto.deviceType,
      timestamp: Date.now(),
    };
    return this.authService.scanLogin(dto, fingerprint);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() dto: RefreshTokenDto, @Request() req: any) {
    const fingerprint: DeviceFingerprint = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      deviceType: 'unknown',
      timestamp: Date.now(),
    };
    return this.authService.refreshToken(dto, fingerprint);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Request() req: any) {
    return this.authService.logout(req.user.sub, req.user.deviceId);
  }

  @Get('devices')
  @UseGuards(JwtAuthGuard)
  async getDevices(@Request() req: any) {
    return this.authService.getUserDevices(req.user.sub);
  }

  @Delete('devices/:deviceId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeDevice(@Request() req: any, @Param('deviceId') deviceId: string) {
    return this.authService.revokeDevice(req.user.sub, deviceId);
  }

  @Post('devices/:deviceId/qr-challenge')
  @UseGuards(JwtAuthGuard)
  async generateQRChallenge(@Param('deviceId') deviceId: string) {
    return this.deviceService.generateQRChallenge(deviceId);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  async setupTwoFactor(@Request() req: any): Promise<any> {
    return this.twoFactorService.setupTwoFactor(req.user.sub);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async enableTwoFactor(@Request() req: any, @Body() dto: TwoFactorSetupDto) {
    return this.twoFactorService.enableTwoFactor(
      req.user.sub,
      dto.secret,
      dto.token,
    );
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyTwoFactor(@Request() req: any, @Body() dto: TwoFactorVerifyDto) {
    const isValid = await this.twoFactorService.verifyTwoFactor(
      req.user.sub,
      dto.token,
    );
    return { valid: isValid };
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disableTwoFactor(@Request() req: any, @Body() dto: TwoFactorVerifyDto) {
    await this.twoFactorService.disableTwoFactor(req.user.sub, dto.token);
    return { disabled: true };
  }

  @Post('2fa/backup-codes')
  @UseGuards(JwtAuthGuard)
  async generateBackupCodes(
    @Request() req: any,
    @Body() dto: TwoFactorVerifyDto,
  ) {
    const codes = await this.twoFactorService.generateNewBackupCodes(
      req.user.sub,
      dto.token,
    );
    return { backupCodes: codes };
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  async getTwoFactorStatus(@Request() req: any) {
    const enabled = await this.twoFactorService.isTwoFactorEnabled(
      req.user.sub,
    );
    return { enabled };
  }
}

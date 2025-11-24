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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { TwoFactorService } from '../services/two-factor.service';
import { DeviceService } from '../services/device.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  VerificationRequestDto,
  VerificationConfirmDto,
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ScanLoginDto,
  TwoFactorSetupDto,
  TwoFactorVerifyDto,
} from '../dto/auth';
import { DeviceFingerprint } from '../interfaces/verification.interface';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
    private readonly deviceService: DeviceService
  ) {}

  @Post('register/verify/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request registration verification code' })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async requestRegistrationVerification(@Body() dto: VerificationRequestDto) {
    return this.authService.requestRegistrationVerification(dto);
  }

  @Post('register/verify/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm registration verification code' })
  @ApiResponse({ status: 200, description: 'Verification code confirmed' })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired verification code',
  })
  async confirmRegistrationVerification(@Body() dto: VerificationConfirmDto) {
    return this.authService.confirmRegistrationVerification(dto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  @ApiResponse({ status: 409, description: 'User already exists' })
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
  @ApiOperation({ summary: 'Request login verification code' })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async requestLoginVerification(@Body() dto: VerificationRequestDto) {
    return this.authService.requestLoginVerification(dto);
  }

  @Post('login/verify/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm login verification code' })
  @ApiResponse({ status: 200, description: 'Verification code confirmed' })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired verification code',
  })
  async confirmLoginVerification(@Body() dto: VerificationConfirmDto) {
    return this.authService.confirmLoginVerification(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login to user account' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns access and refresh tokens',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: '2FA verification required' })
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
    };
    return this.authService.scanLogin(dto, fingerprint);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate current session' })
  @ApiResponse({ status: 204, description: 'Successfully logged out' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Request() req: any) {
    return this.authService.logout(req.user.sub, req.user.deviceId);
  }

  @Get('devices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all devices associated with user account' })
  @ApiResponse({ status: 200, description: 'List of user devices' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDevices(@Request() req: any) {
    return this.authService.getUserDevices(req.user.sub);
  }

  @Delete('devices/:deviceId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke/delete a specific device' })
  @ApiResponse({ status: 204, description: 'Device successfully revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async revokeDevice(@Request() req: any, @Param('deviceId') deviceId: string) {
    return this.authService.revokeDevice(req.user.sub, deviceId);
  }

  @Post('devices/:deviceId/qr-challenge')
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
    return this.deviceService.generateQRChallenge(deviceId);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Setup two-factor authentication (2FA)' })
  @ApiResponse({
    status: 200,
    description: 'Returns QR code and secret for 2FA setup',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async setupTwoFactor(@Request() req: any): Promise<any> {
    return this.twoFactorService.setupTwoFactor(req.user.sub);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable two-factor authentication' })
  @ApiResponse({
    status: 200,
    description: '2FA enabled successfully with backup codes',
  })
  @ApiResponse({ status: 400, description: 'Invalid token or secret' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async enableTwoFactor(@Request() req: any, @Body() dto: TwoFactorSetupDto) {
    return this.twoFactorService.enableTwoFactor(
      req.user.sub,
      dto.secret,
      dto.token
    );
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify two-factor authentication token' })
  @ApiResponse({ status: 200, description: 'Token verification result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async verifyTwoFactor(@Request() req: any, @Body() dto: TwoFactorVerifyDto) {
    const isValid = await this.twoFactorService.verifyTwoFactor(
      req.user.sub,
      dto.token
    );
    return { valid: isValid };
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable two-factor authentication' })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid token' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async disableTwoFactor(@Request() req: any, @Body() dto: TwoFactorVerifyDto) {
    await this.twoFactorService.disableTwoFactor(req.user.sub, dto.token);
    return { disabled: true };
  }

  @Post('2fa/backup-codes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate new 2FA backup codes' })
  @ApiResponse({ status: 200, description: 'New backup codes generated' })
  @ApiResponse({ status: 400, description: 'Invalid token' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generateBackupCodes(
    @Request() req: any,
    @Body() dto: TwoFactorVerifyDto
  ) {
    const codes = await this.twoFactorService.generateNewBackupCodes(
      req.user.sub,
      dto.token
    );
    return { backupCodes: codes };
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get two-factor authentication status' })
  @ApiResponse({ status: 200, description: 'Returns 2FA enabled status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTwoFactorStatus(@Request() req: any) {
    const enabled = await this.twoFactorService.isTwoFactorEnabled(
      req.user.sub
    );
    return { enabled };
  }
}

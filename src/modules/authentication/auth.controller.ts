import { Controller, Post, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './services/auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { DeviceFingerprint } from '../devices/device-fingerprint.interface';
import { RegisterDto, LoginDto } from './dto/auth';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

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
}

import { Controller, Post, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PhoneAuthenticationService } from '../services/phone-authentication.service';
import { JwtAuthGuard } from '../../tokens/guards';
import { AuthenticatedRequest } from '../../tokens/types/authenticated-request.interface';
import { DeviceFingerprintService } from '../../devices/services/device-fingerprint/device-fingerprint.service';
import { RegisterDto, LoginDto, LogoutDto, RegisterResponseDto, LoginResponseDto } from '../dto';

@ApiTags('Auth - Authentication by SMS')
// Rate-limiting stratégie (WHISPR-996/997) :
// - Throttler global (SHORT 3/s, MEDIUM 20/10s, LONG 100/min) défini dans
//   AppModule, partagé entre tous les microservices via Redis.
// - @Throttle() ci-dessous durcit le seuil sur les routes SMS (register/
//   login/logout) : max 10 requêtes / 60 s / IP pour limiter l'abus des
//   envois de SMS (coût externe) et le brute force de code.
// - @Throttle() surcharge le throttler global `default` ; les trois tiers
//   SHORT/MEDIUM/LONG continuent de s'appliquer en parallèle. Pas de
//   second ThrottlerModule — une seule connexion Redis côté auth.
@Throttle({ default: { ttl: 60000, limit: 10 } })
@Controller('')
export class PhoneAuthenticationController {
	constructor(
		private readonly authService: PhoneAuthenticationService,
		private readonly fingerprintService: DeviceFingerprintService
	) {}

	@Post('register')
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({ summary: 'Register a new user account' })
	@ApiResponse({ status: 201, description: 'User successfully registered', type: RegisterResponseDto })
	@ApiResponse({ status: 400, description: 'Invalid registration data' })
	@ApiResponse({ status: 409, description: 'User already exists' })
	@ApiBody({ type: RegisterDto })
	async register(@Body() dto: RegisterDto, @Request() req: ExpressRequest): Promise<RegisterResponseDto> {
		const fingerprint = this.fingerprintService.extractFingerprint(req, dto.deviceType);
		return this.authService.register(dto, fingerprint);
	}

	@Post('login')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Login to user account' })
	@ApiResponse({
		status: 200,
		description: 'Login successful, returns access and refresh tokens',
		type: LoginResponseDto,
	})
	@ApiResponse({ status: 401, description: 'Invalid credentials' })
	@ApiBody({ type: LoginDto })
	async login(@Body() dto: LoginDto, @Request() req: ExpressRequest): Promise<LoginResponseDto> {
		const fingerprint = this.fingerprintService.extractFingerprint(req, dto.deviceType);
		return this.authService.login(dto, fingerprint);
	}

	@Post('logout')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Logout and invalidate current session' })
	@ApiResponse({ status: 204, description: 'Successfully logged out' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 403, description: 'deviceId does not belong to the authenticated user' })
	@ApiBody({ type: LogoutDto })
	async logout(@Body() dto: LogoutDto, @Request() req: AuthenticatedRequest) {
		return this.authService.logout(req.user.sub, req.user.deviceId, dto.deviceId);
	}
}

import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	Request,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PhoneAuthenticationService } from '../services/phone-authentication.service';
import { JwtAuthGuard } from '../../tokens/guards';
import { AuthenticatedRequest } from '../../tokens/types/authenticated-request.interface';
import { DeviceFingerprintService } from '../../devices/services/device-fingerprint/device-fingerprint.service';
import { AdaptiveRateLimitInterceptor } from '../../adaptive-rate-limit/adaptive-rate-limit.interceptor';
import { RegisterDto, LoginDto, LogoutDto, RegisterResponseDto, LoginResponseDto } from '../dto';
import {
	ApiLoginEndpoint,
	ApiLogoutEndpoint,
	ApiRegisterEndpoint,
} from './phone-authentication.controller.swagger';

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
	@UseInterceptors(AdaptiveRateLimitInterceptor)
	@HttpCode(HttpStatus.CREATED)
	@ApiRegisterEndpoint()
	async register(@Body() dto: RegisterDto, @Request() req: ExpressRequest): Promise<RegisterResponseDto> {
		const fingerprint = this.fingerprintService.extractFingerprint(req, dto.deviceType);
		return this.authService.register(dto, fingerprint);
	}

	@Post('login')
	@UseInterceptors(AdaptiveRateLimitInterceptor)
	@HttpCode(HttpStatus.OK)
	@ApiLoginEndpoint()
	async login(@Body() dto: LoginDto, @Request() req: ExpressRequest): Promise<LoginResponseDto> {
		const fingerprint = this.fingerprintService.extractFingerprint(req, dto.deviceType);
		return this.authService.login(dto, fingerprint);
	}

	@Post('logout')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiLogoutEndpoint()
	async logout(@Body() dto: LogoutDto, @Request() req: AuthenticatedRequest) {
		return this.authService.logout(req.user.sub, req.user.deviceId, dto.deviceId);
	}
}

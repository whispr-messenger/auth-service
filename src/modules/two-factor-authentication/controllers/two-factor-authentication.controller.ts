import { Body, Controller, Get, HttpCode, HttpStatus, Request, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
	TwoFactorBackupCodesResponseDto,
	TwoFactorDisableResponseDto,
	TwoFactorSetupDto,
	TwoFactorSetupResponseDto,
	TwoFactorStatusResponseDto,
	TwoFactorVerifyDto,
	TwoFactorVerifyResponseDto,
} from '../dto';
import { TwoFactorAuthenticationService } from '../services/two-factor-authentication.service';
import { JwtAuthGuard } from '../../tokens/guards';
import { AuthenticatedRequest } from '../../tokens/types/authenticated-request.interface';
import {
	ApiDisableTwoFactorEndpoint,
	ApiEnableTwoFactorEndpoint,
	ApiGenerateBackupCodesEndpoint,
	ApiGetRemainingBackupCodesEndpoint,
	ApiGetTwoFactorStatusEndpoint,
	ApiRegenerateBackupCodesEndpoint,
	ApiSetupTwoFactorEndpoint,
	ApiUseRecoveryCodeEndpoint,
	ApiVerifyTwoFactorEndpoint,
} from './two-factor-authentication.controller.swagger';

@ApiTags('Auth - Two Factor Authentication (2FA)')
// rate limit strict pour eviter brute-force TOTP 6 chiffres (10^6 codes)
// throttler global LONG (100/min) ne suffit pas - un JWT vole permettrait
// 6000 tentatives/h dans la fenetre TOTP de 30s
// override par methode possible (verify est plus strict, cf ci-dessous)
@Throttle({ default: { ttl: 60_000, limit: 5 } })
@Controller('2fa')
export class TwoFactorAuthenticationController {
	constructor(private readonly twoFactorService: TwoFactorAuthenticationService) {}

	@Post('setup')
	@UseGuards(JwtAuthGuard)
	@ApiSetupTwoFactorEndpoint()
	async setupTwoFactor(@Request() req: AuthenticatedRequest): Promise<TwoFactorSetupResponseDto> {
		return this.twoFactorService.setupTwoFactor(req.user.sub);
	}

	@Post('enable')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiEnableTwoFactorEndpoint()
	async enableTwoFactor(
		@Request() req: AuthenticatedRequest,
		@Body() dto: TwoFactorSetupDto
	): Promise<TwoFactorBackupCodesResponseDto> {
		const backupCodes = await this.twoFactorService.enableTwoFactor(req.user.sub, dto.token);
		return { backupCodes };
	}

	@Post('verify')
	// palier plus strict sur verify : c'est l'endpoint cible pour brute-force TOTP
	@Throttle({ default: { ttl: 60_000, limit: 3 } })
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiVerifyTwoFactorEndpoint()
	async verifyTwoFactor(
		@Request() req: AuthenticatedRequest,
		@Body() dto: TwoFactorVerifyDto
	): Promise<TwoFactorVerifyResponseDto> {
		const isValid = await this.twoFactorService.verifyTwoFactor(req.user.sub, dto.token);
		return { valid: isValid };
	}

	@Post('disable')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiDisableTwoFactorEndpoint()
	async disableTwoFactor(
		@Request() req: AuthenticatedRequest,
		@Body() dto: TwoFactorVerifyDto
	): Promise<TwoFactorDisableResponseDto> {
		await this.twoFactorService.disableTwoFactor(req.user.sub, dto.token);
		return { disabled: true };
	}

	@Post('backup-codes')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiGenerateBackupCodesEndpoint()
	async generateBackupCodes(
		@Request() req: AuthenticatedRequest,
		@Body() dto: TwoFactorVerifyDto
	): Promise<TwoFactorBackupCodesResponseDto> {
		const codes = await this.twoFactorService.generateNewBackupCodes(req.user.sub, dto.token);
		return { backupCodes: codes };
	}

	// WHISPR-1052: URL dédiée au flow de rotation — remplace tous les codes
	// inutilisés après vérification TOTP/backup-code. Alias explicite du
	// POST /backup-codes pour coller au vocabulaire côté mobile.
	@Post('backup-codes/regenerate')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiRegenerateBackupCodesEndpoint()
	async regenerateBackupCodes(@Request() req: AuthenticatedRequest, @Body() dto: TwoFactorVerifyDto) {
		const codes = await this.twoFactorService.generateNewBackupCodes(req.user.sub, dto.token);
		return { backupCodes: codes };
	}

	// WHISPR-1052: permet à l'UI Settings d'afficher le nombre de codes
	// de secours restants sans les régénérer.
	@Get('backup-codes/remaining')
	@UseGuards(JwtAuthGuard)
	@ApiGetRemainingBackupCodesEndpoint()
	async getRemainingBackupCodes(@Request() req: AuthenticatedRequest) {
		const remaining = await this.twoFactorService.getRemainingBackupCodesCount(req.user.sub);
		return { remaining };
	}

	// WHISPR-1431: permet de bypasser la 2FA en utilisant un code de récupération
	// single-use — flux distinct du POST /verify qui accepte aussi les backup codes
	// via le fallback, pour pouvoir appliquer un rate limit plus strict (limit: 3).
	@Post('backup-codes/use')
	@Throttle({ default: { ttl: 60_000, limit: 3 } })
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiUseRecoveryCodeEndpoint()
	async useRecoveryCode(
		@Request() req: AuthenticatedRequest,
		@Body() dto: TwoFactorVerifyDto
	): Promise<TwoFactorVerifyResponseDto> {
		const valid = await this.twoFactorService.useRecoveryCode(req.user.sub, dto.token);
		return { valid };
	}

	@Get('status')
	@UseGuards(JwtAuthGuard)
	@ApiGetTwoFactorStatusEndpoint()
	async getTwoFactorStatus(@Request() req: AuthenticatedRequest): Promise<TwoFactorStatusResponseDto> {
		const enabled = await this.twoFactorService.isTwoFactorEnabled(req.user.sub);
		return { enabled };
	}
}

import { Body, Controller, Get, HttpCode, HttpStatus, Request, Post, UseGuards } from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiBody,
	ApiCreatedResponse,
	ApiOkResponse,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import {
	TwoFactorBackupCodesResponseDto,
	TwoFactorSetupDto,
	TwoFactorSetupResponseDto,
	TwoFactorVerifyDto,
} from '../dto';
import { TwoFactorAuthenticationService } from '../services/two-factor-authentication.service';
import { JwtAuthGuard } from '../../tokens/guards';
import { AuthenticatedRequest } from '../../tokens/types/authenticated-request.interface';

@ApiTags('Auth - Two Factor Authentication (2FA)')
@Controller('2fa')
export class TwoFactorAuthenticationController {
	constructor(private readonly twoFactorService: TwoFactorAuthenticationService) {}

	@Post('setup')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Setup two-factor authentication (2FA)' })
	@ApiCreatedResponse({
		description: 'Returns QR code URL, secret, and otpauthUri for 2FA setup',
		type: TwoFactorSetupResponseDto,
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async setupTwoFactor(@Request() req: AuthenticatedRequest): Promise<TwoFactorSetupResponseDto> {
		return this.twoFactorService.setupTwoFactor(req.user.sub);
	}

	@Post('enable')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Enable two-factor authentication' })
	@ApiBody({ type: TwoFactorSetupDto })
	@ApiOkResponse({
		type: TwoFactorBackupCodesResponseDto,
		description: '2FA enabled successfully; returns backup codes',
	})
	@ApiResponse({ status: 400, description: 'Invalid token or 2FA setup not initiated' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async enableTwoFactor(@Request() req: AuthenticatedRequest, @Body() dto: TwoFactorSetupDto) {
		const backupCodes = await this.twoFactorService.enableTwoFactor(req.user.sub, dto.token);
		return { backupCodes };
	}

	@Post('verify')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Verify two-factor authentication token' })
	@ApiBody({ type: TwoFactorVerifyDto })
	@ApiResponse({ status: 200, description: 'Token verification result' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async verifyTwoFactor(@Request() req: AuthenticatedRequest, @Body() dto: TwoFactorVerifyDto) {
		const isValid = await this.twoFactorService.verifyTwoFactor(req.user.sub, dto.token);
		return { valid: isValid };
	}

	@Post('disable')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Disable two-factor authentication' })
	@ApiBody({ type: TwoFactorVerifyDto })
	@ApiResponse({ status: 200, description: '2FA disabled successfully' })
	@ApiResponse({ status: 400, description: 'Invalid token' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async disableTwoFactor(@Request() req: AuthenticatedRequest, @Body() dto: TwoFactorVerifyDto) {
		await this.twoFactorService.disableTwoFactor(req.user.sub, dto.token);
		return { disabled: true };
	}

	@Post('backup-codes')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Generate new 2FA backup codes' })
	@ApiBody({ type: TwoFactorVerifyDto })
	@ApiOkResponse({ type: TwoFactorBackupCodesResponseDto, description: 'New backup codes generated' })
	@ApiResponse({ status: 400, description: 'Invalid token' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async generateBackupCodes(@Request() req: AuthenticatedRequest, @Body() dto: TwoFactorVerifyDto) {
		const codes = await this.twoFactorService.generateNewBackupCodes(req.user.sub, dto.token);
		return { backupCodes: codes };
	}

	// WHISPR-1052: URL dédiée au flow de rotation — remplace tous les codes
	// inutilisés après vérification TOTP/backup-code. Alias explicite du
	// POST /backup-codes pour coller au vocabulaire côté mobile.
	@Post('backup-codes/regenerate')
	@UseGuards(JwtAuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Rotate 2FA backup codes (replaces all existing codes)' })
	@ApiBody({ type: TwoFactorVerifyDto })
	@ApiOkResponse({ type: TwoFactorBackupCodesResponseDto, description: 'Backup codes rotated' })
	@ApiResponse({ status: 400, description: 'Invalid token or 2FA not enabled' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async regenerateBackupCodes(@Request() req: AuthenticatedRequest, @Body() dto: TwoFactorVerifyDto) {
		const codes = await this.twoFactorService.generateNewBackupCodes(req.user.sub, dto.token);
		return { backupCodes: codes };
	}

	// WHISPR-1052: permet à l'UI Settings d'afficher le nombre de codes
	// de secours restants sans les régénérer.
	@Get('backup-codes/remaining')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Get remaining (unused) 2FA backup codes count' })
	@ApiOkResponse({ description: 'Returns the number of unused backup codes' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async getRemainingBackupCodes(@Request() req: AuthenticatedRequest) {
		const remaining = await this.twoFactorService.getRemainingBackupCodesCount(req.user.sub);
		return { remaining };
	}

	@Get('status')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Get two-factor authentication status' })
	@ApiResponse({ status: 200, description: 'Returns 2FA enabled status' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async getTwoFactorStatus(@Request() req: AuthenticatedRequest) {
		const enabled = await this.twoFactorService.isTwoFactorEnabled(req.user.sub);
		return { enabled };
	}
}

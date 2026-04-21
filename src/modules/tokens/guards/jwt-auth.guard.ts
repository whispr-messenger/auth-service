import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { TokensService } from '../services/tokens.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
	constructor(private readonly tokenService: TokensService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const token = this.extractTokenFromHeader(request);

		if (!token) {
			throw new UnauthorizedException('ERROR_ACCESS_TOKEN_REQUIRED');
		}

		try {
			const payload = this.tokenService.validateToken(token);

			const [isDeviceRevoked, isTokenRevoked] = await Promise.all([
				this.tokenService.isDeviceRevoked(payload.deviceId),
				this.tokenService.isTokenRevoked(payload.jti),
			]);

			if (isDeviceRevoked || isTokenRevoked) {
				throw new UnauthorizedException('ERROR_TOKEN_REVOKED');
			}

			request.user = payload;
			return true;
		} catch (err) {
			// Préserver la raison exacte (ERROR_TOKEN_REVOKED, ERROR_INVALID_TOKEN, etc.)
			// pour que le client et les logs voient le vrai motif (WHISPR-919).
			if (err instanceof UnauthorizedException) {
				throw err;
			}
			throw new UnauthorizedException('ERROR_INVALID_TOKEN');
		}
	}

	private extractTokenFromHeader(request: Request): string | undefined {
		const [type, token] = request.headers.authorization?.split(' ') ?? [];
		return type === 'Bearer' ? token : undefined;
	}
}

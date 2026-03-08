import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { TokensService } from '../services/tokens.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
	constructor(private readonly tokenService: TokensService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const token = this.extractTokenFromHeader(request);

		if (!token) {
			throw new UnauthorizedException("Token d'accès requis");
		}

		try {
			const payload = this.tokenService.validateToken(token);

			const [isDeviceRevoked, isTokenRevoked] = await Promise.all([
				this.tokenService.isDeviceRevoked(payload.deviceId),
				this.tokenService.isTokenRevoked(payload.jti),
			]);

			if (isDeviceRevoked || isTokenRevoked) {
				throw new UnauthorizedException('Token révoqué');
			}

			request.user = payload;
			return true;
		} catch {
			throw new UnauthorizedException('Token invalide');
		}
	}

	private extractTokenFromHeader(request: any): string | undefined {
		const [type, token] = request.headers.authorization?.split(' ') ?? [];
		return type === 'Bearer' ? token : undefined;
	}
}

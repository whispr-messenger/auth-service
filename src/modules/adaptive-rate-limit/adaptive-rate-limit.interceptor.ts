import {
	BadRequestException,
	CallHandler,
	ExecutionContext,
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	NestInterceptor,
	UnauthorizedException,
	NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AdaptiveRateLimitService } from './adaptive-rate-limit.service';

// WHISPR-1054: intercepteur à poser sur les routes sensibles (login,
// register, verify). Il compte les échecs côté IP+route et bloque
// préventivement au-dessus d'un seuil — rôle complémentaire du ThrottlerGuard
// global qui, lui, ne regarde que le volume de requêtes et pas leur issue.
@Injectable()
export class AdaptiveRateLimitInterceptor implements NestInterceptor {
	private readonly logger = new Logger(AdaptiveRateLimitInterceptor.name);

	constructor(private readonly tracker: AdaptiveRateLimitService) {}

	async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
		const req = ctx.switchToHttp().getRequest<Request>();
		const ip = this.resolveIp(req);
		const route = this.resolveRoute(req);

		const failures = await this.tracker.getFailureCount(ip, route);
		if (this.tracker.shouldBlock(failures)) {
			this.logger.warn(
				`Adaptive block: ip=${ip} route=${route} failures=${failures} (threshold=${this.tracker.threshold})`
			);
			throw new HttpException(
				{
					statusCode: HttpStatus.TOO_MANY_REQUESTS,
					message: 'Too many failed authentication attempts. Please try again later.',
					retryAfterSeconds: this.tracker.windowSeconds,
				},
				HttpStatus.TOO_MANY_REQUESTS
			);
		}

		return next.handle().pipe(
			tap({
				next: () => {
					void this.tracker.recordSuccess(ip, route);
				},
				error: (err: unknown) => {
					if (this.isAuthenticationFailure(err)) {
						void this.tracker.recordFailure(ip, route);
					}
				},
			})
		);
	}

	private resolveIp(req: Request): string {
		return req.ip || req.socket?.remoteAddress || 'unknown';
	}

	private resolveRoute(req: Request): string {
		return req.route?.path ?? req.originalUrl?.split('?')[0] ?? 'unknown';
	}

	// Only count user-facing auth failures (bad OTP, wrong credentials, etc.).
	// NotFound on a missing user is also a probing signal, hence included.
	// 5xx / internal errors are excluded — a Redis hiccup must not brick a user.
	private isAuthenticationFailure(err: unknown): boolean {
		return (
			err instanceof BadRequestException ||
			err instanceof UnauthorizedException ||
			err instanceof NotFoundException
		);
	}
}

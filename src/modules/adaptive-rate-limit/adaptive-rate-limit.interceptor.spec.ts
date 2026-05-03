import {
	BadRequestException,
	ExecutionContext,
	HttpException,
	HttpStatus,
	UnauthorizedException,
	NotFoundException,
	InternalServerErrorException,
	CallHandler,
} from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AdaptiveRateLimitInterceptor } from './adaptive-rate-limit.interceptor';
import { AdaptiveRateLimitService } from './adaptive-rate-limit.service';

function makeCtx(ip = '1.2.3.4', route = '/login'): ExecutionContext {
	const req = {
		ip,
		socket: { remoteAddress: ip },
		route: { path: route },
		originalUrl: route,
	};
	return {
		switchToHttp: () => ({ getRequest: () => req }),
	} as unknown as ExecutionContext;
}

describe('AdaptiveRateLimitInterceptor', () => {
	let interceptor: AdaptiveRateLimitInterceptor;
	const tracker = {
		getFailureCount: jest.fn(),
		recordFailure: jest.fn().mockResolvedValue(undefined),
		recordSuccess: jest.fn().mockResolvedValue(undefined),
		shouldBlock: jest.fn(),
		threshold: 5,
		windowSeconds: 900,
	} as unknown as jest.Mocked<AdaptiveRateLimitService>;

	beforeEach(() => {
		jest.clearAllMocks();
		interceptor = new AdaptiveRateLimitInterceptor(tracker);
	});

	it('throws 429 when the failure count crosses the threshold', async () => {
		(tracker.getFailureCount as jest.Mock).mockResolvedValue(5);
		(tracker.shouldBlock as jest.Mock).mockReturnValue(true);

		const next: CallHandler = { handle: jest.fn().mockReturnValue(of('ok')) };

		let caught: unknown;
		try {
			await interceptor.intercept(makeCtx(), next);
		} catch (err) {
			caught = err;
		}

		expect(caught).toBeInstanceOf(HttpException);
		expect((caught as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
		expect(next.handle).not.toHaveBeenCalled();
	});

	it('lets the request through and records success on 2xx', async () => {
		(tracker.getFailureCount as jest.Mock).mockResolvedValue(0);
		(tracker.shouldBlock as jest.Mock).mockReturnValue(false);

		const next: CallHandler = { handle: jest.fn().mockReturnValue(of('login-ok')) };

		const result = await firstValueFrom(await interceptor.intercept(makeCtx(), next));

		expect(result).toBe('login-ok');
		expect(tracker.recordSuccess).toHaveBeenCalledWith('1.2.3.4', '/login');
		expect(tracker.recordFailure).not.toHaveBeenCalled();
	});

	it('records a failure on BadRequestException (bad OTP)', async () => {
		(tracker.getFailureCount as jest.Mock).mockResolvedValue(0);
		(tracker.shouldBlock as jest.Mock).mockReturnValue(false);

		const next: CallHandler = {
			handle: jest.fn().mockReturnValue(throwError(() => new BadRequestException('Invalid OTP'))),
		};

		await expect(firstValueFrom(await interceptor.intercept(makeCtx(), next))).rejects.toBeInstanceOf(
			BadRequestException
		);

		expect(tracker.recordFailure).toHaveBeenCalledWith('1.2.3.4', '/login');
		expect(tracker.recordSuccess).not.toHaveBeenCalled();
	});

	it('records a failure on UnauthorizedException', async () => {
		(tracker.getFailureCount as jest.Mock).mockResolvedValue(0);
		(tracker.shouldBlock as jest.Mock).mockReturnValue(false);

		const next: CallHandler = {
			handle: jest.fn().mockReturnValue(throwError(() => new UnauthorizedException())),
		};

		await expect(firstValueFrom(await interceptor.intercept(makeCtx(), next))).rejects.toBeInstanceOf(
			UnauthorizedException
		);

		expect(tracker.recordFailure).toHaveBeenCalled();
	});

	it('records a failure on NotFoundException (unknown phone probe)', async () => {
		(tracker.getFailureCount as jest.Mock).mockResolvedValue(0);
		(tracker.shouldBlock as jest.Mock).mockReturnValue(false);

		const next: CallHandler = {
			handle: jest.fn().mockReturnValue(throwError(() => new NotFoundException())),
		};

		await expect(firstValueFrom(await interceptor.intercept(makeCtx(), next))).rejects.toBeInstanceOf(
			NotFoundException
		);

		expect(tracker.recordFailure).toHaveBeenCalled();
	});

	it('does NOT record a failure on 5xx / internal errors', async () => {
		(tracker.getFailureCount as jest.Mock).mockResolvedValue(0);
		(tracker.shouldBlock as jest.Mock).mockReturnValue(false);

		const next: CallHandler = {
			handle: jest.fn().mockReturnValue(throwError(() => new InternalServerErrorException('Boom'))),
		};

		await expect(firstValueFrom(await interceptor.intercept(makeCtx(), next))).rejects.toBeInstanceOf(
			InternalServerErrorException
		);

		expect(tracker.recordFailure).not.toHaveBeenCalled();
	});

	it('uses socket.remoteAddress as fallback when req.ip is missing', async () => {
		(tracker.getFailureCount as jest.Mock).mockResolvedValue(0);
		(tracker.shouldBlock as jest.Mock).mockReturnValue(false);

		const req = {
			ip: undefined,
			socket: { remoteAddress: '9.9.9.9' },
			route: { path: '/login' },
			originalUrl: '/login',
		};
		const ctx = {
			switchToHttp: () => ({ getRequest: () => req }),
		} as unknown as ExecutionContext;

		const next: CallHandler = { handle: jest.fn().mockReturnValue(of('ok')) };

		await firstValueFrom(await interceptor.intercept(ctx, next));

		expect(tracker.getFailureCount).toHaveBeenCalledWith('9.9.9.9', '/login');
	});
});

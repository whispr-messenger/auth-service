import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokensService } from '../services/tokens.service';
import { JwtPayload } from '../types/jwt-payload.interface';

const makeContext = (authorization?: string): ExecutionContext =>
	({
		switchToHttp: () => ({
			getRequest: () => ({
				headers: { authorization },
				user: undefined,
			}),
		}),
	}) as unknown as ExecutionContext;

const validPayload: JwtPayload = {
	sub: 'user-id',
	jti: 'token-uuid',
	iat: Math.floor(Date.now() / 1000),
	exp: Math.floor(Date.now() / 1000) + 3600,
	deviceId: 'device-id',
	scope: 'user',
	fingerprint: 'abc123',
};

describe('JwtAuthGuard', () => {
	let guard: JwtAuthGuard;
	let tokensService: jest.Mocked<
		Pick<TokensService, 'validateToken' | 'isDeviceRevoked' | 'isTokenRevoked'>
	>;

	beforeEach(() => {
		tokensService = {
			validateToken: jest.fn().mockReturnValue(validPayload),
			isDeviceRevoked: jest.fn().mockResolvedValue(false),
			isTokenRevoked: jest.fn().mockResolvedValue(false),
		};
		guard = new JwtAuthGuard(tokensService as unknown as TokensService);
	});

	describe('when no token is provided', () => {
		it('denies access when Authorization header is missing', async () => {
			await expect(guard.canActivate(makeContext())).rejects.toThrow(UnauthorizedException);
		});

		it('denies access when scheme is not Bearer', async () => {
			await expect(guard.canActivate(makeContext('Basic sometoken'))).rejects.toThrow(
				UnauthorizedException
			);
		});
	});

	describe('when token is present', () => {
		const ctx = () => makeContext('Bearer valid.jwt.token');

		it('allows access when token is valid and not revoked', async () => {
			const result = await guard.canActivate(ctx());
			expect(result).toBe(true);
		});

		it('attaches payload to request.user', async () => {
			const request: any = { headers: { authorization: 'Bearer valid.jwt.token' } };
			const context = {
				switchToHttp: () => ({ getRequest: () => request }),
			} as unknown as ExecutionContext;

			await guard.canActivate(context);

			expect(request.user).toEqual(validPayload);
		});

		it('checks revocation using jti, not sub', async () => {
			await guard.canActivate(ctx());

			expect(tokensService.isTokenRevoked).toHaveBeenCalledWith(validPayload.jti);
			expect(tokensService.isTokenRevoked).not.toHaveBeenCalledWith(validPayload.sub);
		});

		it('checks device revocation using deviceId', async () => {
			await guard.canActivate(ctx());

			expect(tokensService.isDeviceRevoked).toHaveBeenCalledWith(validPayload.deviceId);
		});

		it('runs device and token revocation checks in parallel', async () => {
			const callOrder: string[] = [];
			tokensService.isDeviceRevoked.mockImplementation(async () => {
				callOrder.push('device');
				return false;
			});
			tokensService.isTokenRevoked.mockImplementation(async () => {
				callOrder.push('token');
				return false;
			});

			await guard.canActivate(ctx());

			expect(callOrder).toHaveLength(2);
			expect(callOrder).toContain('device');
			expect(callOrder).toContain('token');
		});

		it('denies access when the individual token is revoked', async () => {
			tokensService.isTokenRevoked.mockResolvedValue(true);

			await expect(guard.canActivate(ctx())).rejects.toThrow(UnauthorizedException);
		});

		it('denies access when the device is revoked', async () => {
			tokensService.isDeviceRevoked.mockResolvedValue(true);

			await expect(guard.canActivate(ctx())).rejects.toThrow(UnauthorizedException);
		});

		it('denies access when both token and device are revoked', async () => {
			tokensService.isTokenRevoked.mockResolvedValue(true);
			tokensService.isDeviceRevoked.mockResolvedValue(true);

			await expect(guard.canActivate(ctx())).rejects.toThrow(UnauthorizedException);
		});

		it('denies access when token validation fails', async () => {
			tokensService.validateToken.mockImplementation(() => {
				throw new UnauthorizedException('ERROR_INVALID_TOKEN');
			});

			await expect(guard.canActivate(ctx())).rejects.toThrow(UnauthorizedException);
		});

		// WHISPR-919 : vérifie que le catch ne masque pas la raison exacte.
		// Avant ce ticket, un device revoked renvoyait ERROR_INVALID_TOKEN
		// (trompeur pour le client et les logs) parce que le catch attrapait
		// l'UnauthorizedException levée intérieurement et la réécrivait.
		it('preserves ERROR_TOKEN_REVOKED when device is revoked (WHISPR-919)', async () => {
			tokensService.isDeviceRevoked.mockResolvedValue(true);

			await expect(guard.canActivate(ctx())).rejects.toMatchObject({
				message: 'ERROR_TOKEN_REVOKED',
			});
		});

		it('preserves ERROR_TOKEN_REVOKED when token is revoked (WHISPR-919)', async () => {
			tokensService.isTokenRevoked.mockResolvedValue(true);

			await expect(guard.canActivate(ctx())).rejects.toMatchObject({
				message: 'ERROR_TOKEN_REVOKED',
			});
		});

		it('still returns ERROR_INVALID_TOKEN for non-Unauthorized errors (WHISPR-919)', async () => {
			tokensService.isDeviceRevoked.mockRejectedValue(new Error('redis timeout'));

			await expect(guard.canActivate(ctx())).rejects.toMatchObject({
				message: 'ERROR_INVALID_TOKEN',
			});
		});
	});
});

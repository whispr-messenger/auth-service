import { Test, TestingModule } from '@nestjs/testing';
import { Request as ExpressRequest } from 'express';
import { TokensController } from './tokens.controller';
import { TokensService } from '../services/tokens.service';
import { JwtAuthGuard } from '../guards';

describe('TokensController', () => {
	let controller: TokensController;

	const mockTokensService = {
		refreshAccessToken: jest.fn(),
		generateWsToken: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [TokensController],
			providers: [
				{
					provide: TokensService,
					useValue: mockTokensService,
				},
			],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue({ canActivate: () => true })
			.compile();

		controller = module.get<TokensController>(TokensController);
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('refreshToken', () => {
		it('should delegate to tokensService with the dto and a fingerprint built from the request', async () => {
			const dto = { refreshToken: 'rt-value' };
			const req = {
				headers: { 'user-agent': 'Mozilla/5.0' },
				ip: '127.0.0.1',
			} as unknown as ExpressRequest;
			const tokenPair = { accessToken: 'at', refreshToken: 'rt2', userId: 'u', deviceId: 'd' };
			mockTokensService.refreshAccessToken.mockResolvedValue(tokenPair);

			const result = await controller.refreshToken(dto, req);

			expect(mockTokensService.refreshAccessToken).toHaveBeenCalledWith('rt-value', {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
				deviceType: 'unknown',
				timestamp: expect.any(Number),
			});
			expect(result).toEqual(tokenPair);
		});
	});

	describe('issueWsToken', () => {
		it('returns the service result for the user/device extracted from the JWT-decorated request', () => {
			const wsToken = { wsToken: 'short-ws-jwt', expiresIn: 60 };
			mockTokensService.generateWsToken.mockReturnValue(wsToken);
			const req = {
				user: { sub: 'user-id', deviceId: 'device-id' },
			} as unknown as ExpressRequest & { user: { sub: string; deviceId: string } };

			const result = controller.issueWsToken(req);

			expect(mockTokensService.generateWsToken).toHaveBeenCalledWith('user-id', 'device-id');
			expect(result).toEqual(wsToken);
		});
	});
});

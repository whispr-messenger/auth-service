import { Test, TestingModule } from '@nestjs/testing';
import { JwksController } from './jwks.controller';
import { JwksService } from './jwks.service';

const mockJwk = {
	kty: 'EC' as const,
	crv: 'P-256' as const,
	kid: 'test-kid-abc123',
	use: 'sig' as const,
	alg: 'ES256' as const,
	x: 'base64url-x-value',
	y: 'base64url-y-value',
};

describe('JwksController', () => {
	let controller: JwksController;
	let jwksService: jest.Mocked<Pick<JwksService, 'getJwks'>>;

	beforeEach(async () => {
		jwksService = {
			getJwks: jest.fn().mockReturnValue({ keys: [mockJwk] }),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [JwksController],
			providers: [{ provide: JwksService, useValue: jwksService }],
		}).compile();

		controller = module.get<JwksController>(JwksController);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('getJwks()', () => {
		it('returns the JWKS document from JwksService', () => {
			const result = controller.getJwks();
			expect(result).toEqual({ keys: [mockJwk] });
		});

		it('delegates to JwksService.getJwks()', () => {
			controller.getJwks();
			expect(jwksService.getJwks).toHaveBeenCalledTimes(1);
		});

		it('never includes private key parameter d', () => {
			const result = controller.getJwks();
			expect(JSON.stringify(result)).not.toContain('"d"');
		});
	});
});

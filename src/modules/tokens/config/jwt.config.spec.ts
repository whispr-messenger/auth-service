import { ConfigService } from '@nestjs/config';
import { jwtModuleOptionsFactory } from './jwt.config';

describe('jwtModuleOptionsFactory', () => {
	let configService: ConfigService;

	beforeEach(() => {
		configService = {
			get: jest.fn(),
		} as unknown as ConfigService;
	});

	it('should return options with issuer and audience when both are set', async () => {
		(configService.get as jest.Mock).mockImplementation((key: string) => {
			const values: Record<string, string> = {
				JWT_ISSUER: 'https://auth.whispr.app',
				JWT_AUDIENCE: 'whispr-api',
				jwtPrivateKey: 'private-key',
				jwtPublicKey: 'public-key',
			};
			return values[key];
		});

		const result = await jwtModuleOptionsFactory(configService);

		expect(result).toEqual({
			privateKey: 'private-key',
			publicKey: 'public-key',
			signOptions: {
				algorithm: 'ES256',
				issuer: 'https://auth.whispr.app',
				audience: 'whispr-api',
			},
			verifyOptions: {
				algorithms: ['ES256'],
				issuer: 'https://auth.whispr.app',
				audience: 'whispr-api',
			},
		});
	});

	it('should return options without issuer and audience when not set', async () => {
		(configService.get as jest.Mock).mockImplementation((key: string) => {
			const values: Record<string, string> = {
				jwtPrivateKey: 'private-key',
				jwtPublicKey: 'public-key',
			};
			return values[key];
		});

		const result = await jwtModuleOptionsFactory(configService);

		expect(result).toEqual({
			privateKey: 'private-key',
			publicKey: 'public-key',
			signOptions: {
				algorithm: 'ES256',
			},
			verifyOptions: {
				algorithms: ['ES256'],
			},
		});
	});

	it('should include issuer only when audience is not set', async () => {
		(configService.get as jest.Mock).mockImplementation((key: string) => {
			const values: Record<string, string> = {
				JWT_ISSUER: 'https://auth.whispr.app',
				jwtPrivateKey: 'private-key',
				jwtPublicKey: 'public-key',
			};
			return values[key];
		});

		const result = await jwtModuleOptionsFactory(configService);

		expect(result.signOptions).toEqual({
			algorithm: 'ES256',
			issuer: 'https://auth.whispr.app',
		});
		expect(result.verifyOptions).toEqual({
			algorithms: ['ES256'],
			issuer: 'https://auth.whispr.app',
		});
	});

	it('should include audience only when issuer is not set', async () => {
		(configService.get as jest.Mock).mockImplementation((key: string) => {
			const values: Record<string, string> = {
				JWT_AUDIENCE: 'whispr-api',
				jwtPrivateKey: 'private-key',
				jwtPublicKey: 'public-key',
			};
			return values[key];
		});

		const result = await jwtModuleOptionsFactory(configService);

		expect(result.signOptions).toEqual({
			algorithm: 'ES256',
			audience: 'whispr-api',
		});
		expect(result.verifyOptions).toEqual({
			algorithms: ['ES256'],
			audience: 'whispr-api',
		});
	});

	it('should throw if JWT_ISSUER is missing in production', async () => {
		(configService.get as jest.Mock).mockImplementation((key: string) => {
			const values: Record<string, string> = {
				NODE_ENV: 'production',
				JWT_AUDIENCE: 'whispr-api',
				jwtPrivateKey: 'private-key',
				jwtPublicKey: 'public-key',
			};
			return values[key];
		});

		await expect(jwtModuleOptionsFactory(configService)).rejects.toThrow(
			'JWT_ISSUER is required in production'
		);
	});

	it('should throw if JWT_AUDIENCE is missing in production', async () => {
		(configService.get as jest.Mock).mockImplementation((key: string) => {
			const values: Record<string, string> = {
				NODE_ENV: 'production',
				JWT_ISSUER: 'https://auth.whispr.app',
				jwtPrivateKey: 'private-key',
				jwtPublicKey: 'public-key',
			};
			return values[key];
		});

		await expect(jwtModuleOptionsFactory(configService)).rejects.toThrow(
			'JWT_AUDIENCE is required in production'
		);
	});

	it('should not throw in production when both issuer and audience are set', async () => {
		(configService.get as jest.Mock).mockImplementation((key: string) => {
			const values: Record<string, string> = {
				NODE_ENV: 'production',
				JWT_ISSUER: 'https://auth.whispr.app',
				JWT_AUDIENCE: 'whispr-api',
				jwtPrivateKey: 'private-key',
				jwtPublicKey: 'public-key',
			};
			return values[key];
		});

		const result = await jwtModuleOptionsFactory(configService);
		expect(result.signOptions).toEqual({
			algorithm: 'ES256',
			issuer: 'https://auth.whispr.app',
			audience: 'whispr-api',
		});
	});
});

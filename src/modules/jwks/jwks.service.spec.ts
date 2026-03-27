import * as crypto from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { JwksService } from './jwks.service';

// Generate a real P-256 key pair for testing
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'pem' }) as string;

function makeService(pem: string, publicKeyFile = '/fake/path/public.pem'): JwksService {
	return new JwksService({
		get: jest.fn().mockImplementation((key: string) => {
			if (key === 'jwtPublicKey') return pem;
			if (key === 'JWT_PUBLIC_KEY_FILE') return publicKeyFile;
			return undefined;
		}),
	} as any);
}

describe('JwksService', () => {
	let service: JwksService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				JwksService,
				{
					provide: ConfigService,
					useValue: {
						get: jest.fn().mockImplementation((key: string) => {
							if (key === 'jwtPublicKey') return PUBLIC_KEY_PEM;
							if (key === 'JWT_PUBLIC_KEY_FILE') return '/fake/path/public.pem';
							return undefined;
						}),
					},
				},
			],
		}).compile();

		service = module.get<JwksService>(JwksService);
		service.onModuleInit();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getJwks()', () => {
		it('returns a JWKS document with one key', () => {
			const jwks = service.getJwks();
			expect(jwks.keys).toHaveLength(1);
		});

		it('returns a key with correct EC P-256 fields', () => {
			const { keys } = service.getJwks();
			const [key] = keys;
			expect(key.kty).toBe('EC');
			expect(key.crv).toBe('P-256');
			expect(key.alg).toBe('ES256');
			expect(key.use).toBe('sig');
		});

		it('returns a key with non-empty kid, x, and y', () => {
			const { keys } = service.getJwks();
			const [key] = keys;
			expect(key.kid).toBeTruthy();
			expect(key.x).toBeTruthy();
			expect(key.y).toBeTruthy();
		});

		it('never includes the private key parameter d', () => {
			const jwks = service.getJwks();
			const raw = JSON.stringify(jwks);
			expect(raw).not.toContain('"d"');
		});

		it('x and y are valid base64url strings', () => {
			const { keys } = service.getJwks();
			const [key] = keys;
			const base64urlRegex = /^[A-Za-z0-9_-]+$/;
			expect(key.x).toMatch(base64urlRegex);
			expect(key.y).toMatch(base64urlRegex);
		});
	});

	describe('getKid()', () => {
		it('returns the same kid as in the JWKS document', () => {
			const kid = service.getKid();
			const { keys } = service.getJwks();
			expect(kid).toBe(keys[0].kid);
		});

		it('returns a stable kid across multiple calls', () => {
			expect(service.getKid()).toBe(service.getKid());
		});
	});

	describe('kid derivation', () => {
		it('produces different kids for different key pairs', () => {
			const { publicKey: otherPublicKey } = crypto.generateKeyPairSync('ec', {
				namedCurve: 'prime256v1',
			});
			const otherPem = otherPublicKey.export({ type: 'spki', format: 'pem' }) as string;

			const otherService = makeService(otherPem, '/other/public.pem');
			otherService.onModuleInit();

			expect(otherService.getKid()).not.toBe(service.getKid());
		});
	});

	describe('JWT validation using JWKS', () => {
		it('a JWT signed with the private key can be verified using the public key from JWKS', () => {
			const { keys } = service.getJwks();
			const [jwk] = keys;

			// Reconstruct the public key from the JWK coordinates
			const reconstructed = crypto.createPublicKey({
				key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
				format: 'jwk',
			});

			// Sign a payload with the private key
			const sign = crypto.createSign('SHA256');
			sign.update('test-payload');
			const signature = sign.sign(privateKey);

			// Verify with the reconstructed public key from JWKS
			const verify = crypto.createVerify('SHA256');
			verify.update('test-payload');
			expect(verify.verify(reconstructed, signature)).toBe(true);
		});
	});

	describe('onModuleInit() error handling', () => {
		it('throws and logs when jwtPublicKey is undefined (missing config)', () => {
			const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

			const brokenService = new JwksService({
				get: jest.fn().mockImplementation((key: string) => {
					if (key === 'JWT_PUBLIC_KEY_FILE') return '/missing/public.pem';
					return undefined;
				}),
			} as any);

			expect(() => brokenService.onModuleInit()).toThrow();
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('/missing/public.pem'),
				expect.anything()
			);
			loggerErrorSpy.mockRestore();
		});

		it('logs a structured error with stack trace before rethrowing on init failure', () => {
			const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

			const brokenService = new JwksService({
				get: jest.fn().mockImplementation((key: string) => {
					if (key === 'JWT_PUBLIC_KEY_FILE') return '/bad/public.pem';
					if (key === 'jwtPublicKey') return 'not-valid-pem';
					return undefined;
				}),
			} as any);

			expect(() => brokenService.onModuleInit()).toThrow();
			expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
			// Second argument should be the stack trace
			const [, stackArg] = loggerErrorSpy.mock.calls[0];
			expect(typeof stackArg).toBe('string');
			loggerErrorSpy.mockRestore();
		});
	});

	describe('buildJwk() key validation', () => {
		it('throws a clear error when given a corrupted PEM', () => {
			const brokenService = makeService(
				'-----BEGIN PUBLIC KEY-----\nNOTVALIDBASE64!!!!\n-----END PUBLIC KEY-----',
				'/fake/corrupted.pem'
			);

			expect(() => brokenService.onModuleInit()).toThrow(
				expect.objectContaining({ message: expect.stringContaining('/fake/corrupted.pem') })
			);
		});

		it('throws a clear error when given an RSA public key', () => {
			const { publicKey: rsaPublicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
			const rsaPem = rsaPublicKey.export({ type: 'spki', format: 'pem' }) as string;

			const brokenService = makeService(rsaPem, '/fake/rsa-key.pem');

			expect(() => brokenService.onModuleInit()).toThrow(
				expect.objectContaining({ message: expect.stringMatching(/RSA.*EC is required for ES256/i) })
			);
		});

		it('throws a clear error when the EC key uses the wrong curve', () => {
			const { publicKey: p384PublicKey } = crypto.generateKeyPairSync('ec', {
				namedCurve: 'secp384r1',
			});
			const p384Pem = p384PublicKey.export({ type: 'spki', format: 'pem' }) as string;

			const brokenService = makeService(p384Pem, '/fake/p384-key.pem');

			expect(() => brokenService.onModuleInit()).toThrow(
				expect.objectContaining({ message: expect.stringMatching(/secp384r1.*prime256v1/i) })
			);
		});
	});
});

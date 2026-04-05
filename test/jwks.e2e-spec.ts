/**
 * E2E tests for the JWKS endpoint.
 *
 * Verifies the observable HTTP behaviour of GET /auth/.well-known/jwks.json:
 * - Returns 200 with a valid JWKS document
 * - Contains EC public key fields (kty, crv, alg, use, kid, x, y)
 * - Never leaks the private key parameter d
 * - Endpoint is public (no JWT required)
 *
 * Also verifies that JWTs signed by TokensService include a kid header
 * matching the kid returned by the JWKS endpoint.
 */
import { INestApplication } from '@nestjs/common';
import { TokensService } from '../src/modules/tokens/services/tokens.service';
import { JwksService } from '../src/modules/jwks/jwks.service';
import { createTestModule } from './helpers/create-test-module';
import { createTestApp } from './helpers/create-test-app';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('JWKS endpoint (e2e)', () => {
	let app: INestApplication;

	beforeEach(async () => {
		const moduleFixture = await createTestModule();
		app = await createTestApp(moduleFixture);
	});

	afterEach(async () => {
		if (app) await app.close();
		jest.clearAllMocks();
	});

	describe('GET /auth/.well-known/jwks.json', () => {
		it('returns 200 without any Authorization header (public endpoint)', async () => {
			await request(app.getHttpServer()).get('/auth/.well-known/jwks.json').expect(200);
		});

		it('returns a JWKS document with a keys array', async () => {
			const response = await request(app.getHttpServer())
				.get('/auth/.well-known/jwks.json')
				.expect(200);

			expect(response.body).toHaveProperty('keys');
			expect(Array.isArray(response.body.keys)).toBe(true);
			expect(response.body.keys.length).toBeGreaterThan(0);
		});

		it('contains a key with correct EC P-256 fields', async () => {
			const response = await request(app.getHttpServer())
				.get('/auth/.well-known/jwks.json')
				.expect(200);

			const [key] = response.body.keys;
			expect(key.kty).toBe('EC');
			expect(key.crv).toBe('P-256');
			expect(key.alg).toBe('ES256');
			expect(key.use).toBe('sig');
		});

		it('contains a key with non-empty kid, x, and y', async () => {
			const response = await request(app.getHttpServer())
				.get('/auth/.well-known/jwks.json')
				.expect(200);

			const [key] = response.body.keys;
			expect(key.kid).toBeTruthy();
			expect(key.x).toBeTruthy();
			expect(key.y).toBeTruthy();
		});

		it('never includes the private key parameter d', async () => {
			const response = await request(app.getHttpServer())
				.get('/auth/.well-known/jwks.json')
				.expect(200);

			expect(JSON.stringify(response.body)).not.toContain('"d"');
		});
	});

	describe('kid consistency between JWKS and signed JWTs', () => {
		it('JWTs signed by TokensService include a kid header matching the JWKS kid', async () => {
			const jwksResponse = await request(app.getHttpServer())
				.get('/auth/.well-known/jwks.json')
				.expect(200);

			const jwksKid: string = jwksResponse.body.keys[0].kid;

			const tokensService = app.get(TokensService);
			const jwksService = app.get(JwksService);

			// The kid returned by JwksService must match the JWKS endpoint
			expect(jwksService.getKid()).toBe(jwksKid);

			// Generate a token pair and decode the header to check the kid
			const { accessToken } = await tokensService.generateTokenPair('user-id', 'device-id', {
				userAgent: 'test-agent',
				ipAddress: '127.0.0.1',
				deviceType: 'unknown',
				timestamp: Date.now(),
			});

			// Decode JWT header (no verification needed here — we're testing the kid claim)
			const [headerB64] = accessToken.split('.');
			const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));

			expect(header.kid).toBe(jwksKid);
		});
	});
});

/**
 * E2E tests for POST /auth/v1/tokens/ws-token (WHISPR-1236).
 *
 * Exercises the real TokensService + JwtService stack with JWT_AUDIENCE /
 * JWT_ISSUER set in the environment (see test/setup-e2e.ts). A previous
 * version put aud and iss inside the payload, which collided with the
 * audience/issuer options injected globally by jwtModuleOptionsFactory and
 * made jsonwebtoken throw `Bad "options.audience" option`. This e2e blocks
 * any future regression by hitting the real signing path.
 */
import { INestApplication } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from '../src/modules/tokens/guards/jwt-auth.guard';
import { createTestApp } from './helpers/create-test-app';
import { createTestModule } from './helpers/create-test-module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

const TEST_USER_ID = 'user-uuid';
const TEST_DEVICE_ID = 'device-uuid';

describe('POST /auth/v1/tokens/ws-token (e2e)', () => {
	let app: INestApplication;

	const buildApp = async () => {
		const moduleFixture = await createTestModule({
			guards: [
				{
					guard: JwtAuthGuard,
					useValue: {
						canActivate: (ctx: any) => {
							const req = ctx.switchToHttp().getRequest();
							req.user = { sub: TEST_USER_ID, deviceId: TEST_DEVICE_ID };
							return true;
						},
					},
				},
			],
		});
		return createTestApp(moduleFixture);
	};

	beforeEach(async () => {
		app = await buildApp();
	});

	afterEach(async () => {
		if (app) await app.close();
		jest.clearAllMocks();
	});

	it('returns 200 with a signed ws-token even when JWT_AUDIENCE is set globally', async () => {
		const res = await request(app.getHttpServer())
			.post('/auth/v1/tokens/ws-token')
			.set('Authorization', 'Bearer ignored-by-mocked-guard')
			.expect(200);

		expect(res.body).toEqual({
			wsToken: expect.any(String),
			expiresIn: 60,
		});
	});

	it('signs a ws-token whose aud and iss are the WS-specific values, not the global JWT_AUDIENCE / JWT_ISSUER', async () => {
		const res = await request(app.getHttpServer())
			.post('/auth/v1/tokens/ws-token')
			.set('Authorization', 'Bearer ignored-by-mocked-guard')
			.expect(200);

		const decoded = jwt.decode(res.body.wsToken) as jwt.JwtPayload;
		expect(decoded).toMatchObject({
			sub: TEST_USER_ID,
			deviceId: TEST_DEVICE_ID,
			aud: 'ws',
			iss: 'whispr-auth',
		});
		// Sanity check: the global JWT_AUDIENCE from setup-e2e.ts must NOT
		// leak into a ws-token (messaging-service rejects anything other
		// than nil | "whispr" | "ws").
		expect(decoded.aud).not.toBe('whispr-test-audience');
	});
});

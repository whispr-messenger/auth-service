import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import helmet from 'helmet';

/**
 * Creates a NestJS application for e2e testing with the same global
 * configuration as the production bootstrap in src/main.ts.
 *
 * This ensures that production-like URL routing (global prefix, versioning,
 * validation) is exercised during e2e tests.
 */
export async function createTestApp(moduleFixture: TestingModule): Promise<INestApplication> {
	const app = moduleFixture.createNestApplication();

	app.setGlobalPrefix('auth');

	// Aligne les tests sur le bootstrap prod : helmet doit être actif sinon
	// le test des security headers (security-headers.e2e-spec.ts) serait faux.
	app.use(
		helmet({
			contentSecurityPolicy: {
				directives: {
					defaultSrc: ["'self'"],
					scriptSrc: ["'self'", "'unsafe-inline'"],
					styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
					imgSrc: ["'self'", 'data:'],
				},
			},
			crossOriginEmbedderPolicy: false,
		})
	);

	app.enableVersioning({
		type: VersioningType.URI,
		defaultVersion: '1',
		prefix: 'v',
	});

	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

	await app.init();

	return app;
}

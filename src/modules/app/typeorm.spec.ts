import { ConfigService } from '@nestjs/config';
import { typeOrmModuleOptionsFactory } from './typeorm';

function makeConfig(values: Record<string, unknown>): ConfigService {
	return {
		get: (key: string, defaultValue?: unknown) =>
			Object.prototype.hasOwnProperty.call(values, key) ? values[key] : defaultValue,
	} as unknown as ConfigService;
}

describe('typeOrmModuleOptionsFactory', () => {
	it('parses DB_URL when no discrete env vars are set', async () => {
		const config = makeConfig({
			DB_URL: 'postgres://alice:secret@db.local:7777/whisp_auth',
		});

		const opts = (await typeOrmModuleOptionsFactory(config)) as Record<string, unknown>;

		expect(opts).toMatchObject({
			host: 'db.local',
			port: 7777,
			username: 'alice',
			password: 'secret',
			database: 'whisp_auth',
		});
	});

	// Les Secrets Kubernetes exposent DB_HOST/DB_PORT/etc séparément, et un
	// DB_URL hérité des configs locales (.env / docker-compose) ne doit pas
	// écraser cette source plus précise.
	it('prefers the 5 discrete DB_* env vars over DB_URL when all are set', async () => {
		const config = makeConfig({
			DB_URL: 'postgres://nope:nope@nope.example:1234/nope',
			DB_HOST: 'auth-postgres.svc',
			DB_PORT: '5432',
			DB_USERNAME: 'auth',
			DB_PASSWORD: 'shh',
			DB_NAME: 'auth_service',
		});

		const opts = (await typeOrmModuleOptionsFactory(config)) as Record<string, unknown>;

		expect(opts).toMatchObject({
			host: 'auth-postgres.svc',
			port: 5432,
			username: 'auth',
			password: 'shh',
			database: 'auth_service',
		});
	});

	// process.env est String→String : DB_PORT='5432' arrive comme string et
	// TypeORM/pg attendent un number. Sans coercition, certains drivers
	// négocient mal SSL ou pool size.
	it('coerces a string DB_PORT into a number', async () => {
		const config = makeConfig({
			DB_HOST: 'localhost',
			DB_PORT: '5432',
			DB_USERNAME: 'auth',
			DB_PASSWORD: 'shh',
			DB_NAME: 'auth_service',
		});

		const opts = (await typeOrmModuleOptionsFactory(config)) as Record<string, unknown>;

		expect(opts.port).toBe(5432);
		expect(typeof opts.port).toBe('number');
	});

	it('falls back to the default port when DB_PORT is missing or non-numeric', async () => {
		const optsMissing = (await typeOrmModuleOptionsFactory(
			makeConfig({ DB_HOST: 'localhost' })
		)) as Record<string, unknown>;

		const optsGarbage = (await typeOrmModuleOptionsFactory(
			makeConfig({ DB_HOST: 'localhost', DB_PORT: 'not-a-port' })
		)) as Record<string, unknown>;

		expect(optsMissing.port).toBe(5432);
		expect(optsGarbage.port).toBe(5432);
	});

	it('uses DB_URL when only some discrete vars are set (not all 5)', async () => {
		const config = makeConfig({
			DB_URL: 'postgres://u:p@db.local:6543/dbn',
			DB_HOST: 'auth-postgres.svc',
			DB_PORT: '5432',
			// DB_NAME / DB_USERNAME / DB_PASSWORD missing → fall back to DB_URL
		});

		const opts = (await typeOrmModuleOptionsFactory(config)) as Record<string, unknown>;

		expect(opts).toMatchObject({
			host: 'db.local',
			port: 6543,
			username: 'u',
			password: 'p',
			database: 'dbn',
		});
	});
});

import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load .env if present (for local development)
config();

const DEFAULT_POSTGRES_PORT = 5432;

function getDatabaseConfig() {
	const dbUrl = process.env.DB_URL;
	if (dbUrl) {
		const parsed = new URL(dbUrl);
		return {
			host: parsed.hostname,
			port: parseInt(parsed.port, 10) || DEFAULT_POSTGRES_PORT,
			username: parsed.username,
			password: parsed.password,
			database: parsed.pathname.slice(1),
		};
	}

	return {
		host: process.env.DB_HOST || 'localhost',
		port: parseInt(process.env.DB_PORT || '5432', 10),
		username: process.env.DB_USERNAME || 'postgres',
		password: process.env.DB_PASSWORD || 'password',
		database: process.env.DB_NAME || 'auth_service',
	};
}

const dbConfig = getDatabaseConfig();

export default new DataSource({
	type: 'postgres',
	...dbConfig,
	entities: [__dirname + '/../modules/**/entities/*{.ts,.js}'],
	migrations: [__dirname + '/../modules/app/migrations/*{.ts,.js}'],
	logging: process.env.DB_LOGGING === 'true',
});

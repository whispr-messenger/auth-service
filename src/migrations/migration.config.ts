import { DataSource } from 'typeorm';
import { UserAuth } from '../modules/common/entities/user-auth.entity';
import { Device } from '../modules/devices/entities/device.entity';
import { PreKey } from '../modules/signal/entities/prekey.entity';
import { SignedPreKey } from '../modules/signal/entities/signed-prekey.entity';
import { IdentityKey } from '../modules/signal/entities/identity-key.entity';
import { BackupCode } from '../modules/two-factor-authentication/entities/backup-code.entity';
import { LoginHistory } from '../modules/phone-auth/entities/login-history.entity';

// Load .env if present (for local development); skip gracefully in production
try {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	require('dotenv').config();
} catch (error) {
	const isModuleNotFound =
		error instanceof Error &&
		'code' in error &&
		(error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND';

	if (!isModuleNotFound) {
		throw error;
	}
}

// Same entity list as src/modules/app/typeorm.ts — keep in sync
const ENTITIES = [UserAuth, Device, PreKey, SignedPreKey, IdentityKey, BackupCode, LoginHistory];

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
	entities: ENTITIES,
	migrations: [__dirname + '/../modules/app/migrations/*{.ts,.js}'],
	logging: process.env.DB_LOGGING === 'true',
});

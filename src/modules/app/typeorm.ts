import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UserAuth } from '../common/entities/user-auth.entity';
import { Device } from '../devices/entities/device.entity';
import { PreKey } from '../signal/entities/prekey.entity';
import { SignedPreKey } from '../signal/entities/signed-prekey.entity';
import { IdentityKey } from '../signal/entities/identity-key.entity';
import { BackupCode } from '../two-factor-authentication/entities/backup-code.entity';
import { LoginHistory } from '../phone-auth/entities/login-history.entity';
import { DataSourceOptions } from 'typeorm';

// Register new TypeORM entities here
const ENTITIES = [UserAuth, Device, PreKey, SignedPreKey, IdentityKey, BackupCode, LoginHistory];

const DEFAULT_POSTGRES_PORT = 5432;

interface DatabaseConfig {
	host: string;
	port: number;
	username: string;
	password: string;
	database: string;
}

/**
 * Parses a database connection URL into config components
 */
function parseDatabaseUrl(url: string): DatabaseConfig {
	const parsed = new URL(url);
	return {
		host: parsed.hostname,
		port: Number.parseInt(parsed.port, 10) || DEFAULT_POSTGRES_PORT,
		username: parsed.username,
		password: parsed.password,
		database: parsed.pathname.slice(1),
	};
}

/**
 * Coerces an env-provided port (souvent une string vu que process.env est
 * String→String) en number. Fallback sur le port Postgres par défaut si la
 * valeur est manquante ou non-numérique.
 */
function coercePort(raw: unknown): number {
	if (typeof raw === 'number' && Number.isFinite(raw)) {
		return raw;
	}
	const parsed = Number.parseInt(String(raw ?? ''), 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POSTGRES_PORT;
}

/**
 * Retrieves database configuration from individual environment variables
 */
function getEnvDatabaseConfig(configService: ConfigService): DatabaseConfig {
	return {
		host: configService.get('DB_HOST', 'localhost'),
		port: coercePort(configService.get('DB_PORT', DEFAULT_POSTGRES_PORT)),
		username: configService.get('DB_USERNAME', 'postgres'),
		password: configService.get('DB_PASSWORD', 'password'),
		database: configService.get('DB_NAME', 'auth_service'),
	};
}

function getDataSourceOptions(configService: ConfigService): DataSourceOptions {
	// https://typeorm.io/docs/data-source/data-source-options/
	return {
		// RDBMS type. You must specify what database engine you use
		type: 'postgres',
		// Entities, or Entity Schemas, to be loaded and used for this data source.
		entities: ENTITIES,
		// Indicates if logging is enabled or not. If set to true then query and error logging will be enabled.
		logging: configService.get('DB_LOGGING', 'false') === 'true',
		// Migrations to be loaded and used for this data source
		migrations: [__dirname + '/migrations/*{.ts,.js}'],
		// Indicates if migrations should be auto-run on every application launch.
		migrationsRun: configService.get('DB_MIGRATIONS_RUN', 'false') === 'true',
		// Indicates if database schema should be auto created on every application launch.
		// Be careful with this option and don't use this in production - otherwise you can lose production data.
		synchronize: configService.get('DB_SYNCHRONIZE', 'false') === 'true',
		// Log queries qui prennent plus de 500ms via le logger NestJS pour detecter les slow queries en prod.
		maxQueryExecutionTime: 500,
	};
}

/**
 * Factory function to create TypeORM configuration based on environment
 *
 * Précédence : si les 5 variables discrètes (DB_HOST, DB_PORT, DB_NAME,
 * DB_USERNAME, DB_PASSWORD) sont toutes définies, elles l'emportent sur
 * DB_URL. C'est le cas en cluster Kubernetes où les Secrets exposent les
 * champs séparément ; la fallback DB_URL héritée des configs locales ne
 * doit pas écraser cette source plus précise.
 */
export async function typeOrmModuleOptionsFactory(
	configService: ConfigService
): Promise<TypeOrmModuleOptions> {
	const dbHost = configService.get('DB_HOST');
	const dbPort = configService.get('DB_PORT');
	const dbName = configService.get('DB_NAME');
	const dbUser = configService.get('DB_USERNAME');
	const dbPassword = configService.get('DB_PASSWORD');
	const hasDiscreteDbConfig = Boolean(dbHost && dbPort && dbName && dbUser && dbPassword);

	const databaseUrl = hasDiscreteDbConfig ? undefined : configService.get('DB_URL');
	const databaseConfig = databaseUrl ? parseDatabaseUrl(databaseUrl) : getEnvDatabaseConfig(configService);

	const dataSourceOptions: DataSourceOptions = getDataSourceOptions(configService);

	return {
		...databaseConfig,
		...dataSourceOptions,
	} as TypeOrmModuleOptions;
}

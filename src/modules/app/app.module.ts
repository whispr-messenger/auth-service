import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigModuleOptions, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard, ThrottlerOptions } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { HealthModule } from '../health/health.module';
import { AuthModule } from '../auth.module';
import { typeOrmModuleOptionsFactory } from './typeorm';
import { CacheModule } from '../cache/cache.module';
import { APP_GUARD } from '@nestjs/core';
import { validateJwtKeys } from '../../config/jwt-keys.config';
import { buildRedisOptions } from '../../config/redis.config';

// Environment variables
const configModuleOptions: ConfigModuleOptions = {
	isGlobal: true,
	envFilePath: '.env',
	validate: validateJwtKeys,
};

// Database (Postgres)
const typeOrmModuleAsyncOptions: TypeOrmModuleAsyncOptions = {
	imports: [ConfigModule],
	useFactory: typeOrmModuleOptionsFactory,
	inject: [ConfigService],
};

// Rate limiting
// https://docs.nestjs.com/security/rate-limiting#multiple-throttler-definitions

const SHORT_THROTTLER: ThrottlerOptions = {
	name: 'short',
	ttl: 1000,
	limit: 3,
};

const MEDIUM_THOTTLER: ThrottlerOptions = {
	name: 'medium',
	ttl: 10000,
	limit: 20,
};

const LONG_THROTTLER: ThrottlerOptions = {
	name: 'long',
	ttl: 60000,
	limit: 100,
};

const throttlerGuardProvider: Provider = {
	provide: APP_GUARD,
	useClass: ThrottlerGuard,
};

@Module({
	imports: [
		ConfigModule.forRoot(configModuleOptions),
		TypeOrmModule.forRootAsync(typeOrmModuleAsyncOptions),
		CacheModule,
		ThrottlerModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				throttlers: [SHORT_THROTTLER, MEDIUM_THOTTLER, LONG_THROTTLER],
				storage: new ThrottlerStorageRedisService(new Redis(buildRedisOptions(configService))),
			}),
		}),
		HealthModule,
		AuthModule,
	],
	providers: [throttlerGuardProvider],
})
export class AppModule {}

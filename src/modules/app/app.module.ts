import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigModuleOptions, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard, ThrottlerModuleOptions, ThrottlerOptions } from '@nestjs/throttler';
import { HealthModule } from '../health/health.module';
import { AuthModule } from '../authentication/auth.module';
import { DevicesModule } from '../devices/devices.module';
import { TokensModule } from '../tokens/tokens.module';
import { TwoFactorAuthenticationModule } from '../two-factor-authentication/two-factor-authentication.module';
import { PhoneVerificationModule } from '../phone-verification/phone-verification.module';
import { typeOrmModuleOptionsFactory } from './typeorm';
import { CacheModule } from '../cache/cache.module';
import { APP_GUARD } from '@nestjs/core';

// Environment variables
const configModuleOptions: ConfigModuleOptions = {
	isGlobal: true,
	envFilePath: '.env',
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

const throttlerModuleOptions: ThrottlerModuleOptions = [SHORT_THROTTLER, MEDIUM_THOTTLER, LONG_THROTTLER];

const throttlerGuardProvider: Provider = {
	provide: APP_GUARD,
	useClass: ThrottlerGuard,
};

@Module({
	imports: [
		ConfigModule.forRoot(configModuleOptions),
		TypeOrmModule.forRootAsync(typeOrmModuleAsyncOptions),
		CacheModule,
		ThrottlerModule.forRoot(throttlerModuleOptions),
		HealthModule,
		AuthModule,
		DevicesModule,
		TokensModule,
		TwoFactorAuthenticationModule,
		PhoneVerificationModule,
	],
	providers: [throttlerGuardProvider],
})
export class AppModule {}

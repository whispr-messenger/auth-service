import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtModuleAsyncOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { UserAuth } from '../two-factor-authentication/user-auth.entity';
import { Device } from '../devices/device.entity';
import { BackupCode } from './entities/backup-code.entity';
import { IdentityKey } from './entities/identity-key.entity';
import { LoginHistory } from './entities/login-history.entity';
import { PreKey } from './entities/prekey.entity';
import { SignedPreKey } from './entities/signed-prekey.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { BackupCodesService } from '../two-factor-authentication/backup-codes/backup-codes.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { jwtModuleOptionsFactory } from './factories/jwt';
import { TokensModule } from '../tokens/tokens.module';
import { DevicesModule } from '../devices/devices.module';
import { PhoneVerificationModule } from '../phone-verification/phone-verification.module';

const jwtModuleAsyncOptions: JwtModuleAsyncOptions = {
	imports: [ConfigModule],
	useFactory: jwtModuleOptionsFactory,
	inject: [ConfigService],
};

const cacheConfig: { ttl: number; max: number } = {
	ttl: 900,
	max: 1000,
};

const throttlerModuleOptions: ThrottlerModuleOptions = [
	{
		ttl: 60000,
		limit: 10,
	},
];

@Module({
	// The providers that will be instantiated bu the Nest injector and that may be shared at least across this module.
	providers: [AuthService, BackupCodesService, JwtAuthGuard],
	// The set of controllers defined in this module which have to be instantiated.
	controllers: [AuthController],
	// The list of imported modules that export the providers which are required in this module.
	imports: [
		TypeOrmModule.forFeature([
			UserAuth,
			Device,
			BackupCode,
			IdentityKey,
			LoginHistory,
			PreKey,
			SignedPreKey,
		]),
		JwtModule.registerAsync(jwtModuleAsyncOptions),
		CacheModule.register(cacheConfig),
		ThrottlerModule.forRoot(throttlerModuleOptions),
		TokensModule,
		DevicesModule,
		PhoneVerificationModule,
	],
	// The subset of providers that are provided by this module and should be available in other modules
	// which import this module.
	exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}

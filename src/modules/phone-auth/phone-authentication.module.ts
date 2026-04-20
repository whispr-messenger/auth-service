import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { buildRedisOptions } from '../../config/redis.config';
import { PhoneAuthenticationController } from './controllers/phone-authentication.controller';
import { PhoneAuthenticationService } from './services';
import { TokensModule } from '../tokens/tokens.module';
import { DevicesModule } from '../devices/devices.module';
import { PhoneVerificationModule } from '../phone-verification/phone-verification.module';
import { CommonModule } from '../common/common.module';
import { TwoFactorAuthenticationModule } from '../two-factor-authentication/two-factor-authentication.module';
import { SignalModule } from '../signal/signal.module';
import { RedisStreamProducer } from '../../../shared/redis';

@Module({
	providers: [PhoneAuthenticationService, RedisStreamProducer],
	controllers: [PhoneAuthenticationController],
	imports: [
		ThrottlerModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				throttlers: [{ ttl: 60000, limit: 10 }],
				storage: new ThrottlerStorageRedisService(new Redis(buildRedisOptions(configService))),
			}),
		}),
		ConfigModule,
		CommonModule,
		DevicesModule,
		PhoneVerificationModule,
		TokensModule,
		TwoFactorAuthenticationModule,
		SignalModule,
	],
	exports: [PhoneAuthenticationService],
})
export class PhoneAuthenticationModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PhoneAuthenticationController } from './controllers/phone-authentication.controller';
import { PhoneAuthenticationService } from './services';
import { TokensModule } from '../tokens/tokens.module';
import { DevicesModule } from '../devices/devices.module';
import { PhoneVerificationModule } from '../phone-verification/phone-verification.module';
import { CommonModule } from '../common/common.module';
import { TwoFactorAuthenticationModule } from '../two-factor-authentication/two-factor-authentication.module';
import { SignalModule } from '../signal/signal.module';
import { AdaptiveRateLimitModule } from '../adaptive-rate-limit/adaptive-rate-limit.module';
import { RedisStreamProducer } from '../../shared/redis';

@Module({
	providers: [PhoneAuthenticationService, RedisStreamProducer],
	controllers: [PhoneAuthenticationController],
	imports: [
		ConfigModule,
		CommonModule,
		DevicesModule,
		PhoneVerificationModule,
		TokensModule,
		TwoFactorAuthenticationModule,
		SignalModule,
		AdaptiveRateLimitModule,
	],
	exports: [PhoneAuthenticationService],
})
export class PhoneAuthenticationModule {}

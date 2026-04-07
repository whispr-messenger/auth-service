import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PhoneAuthenticationController } from './controllers/phone-authentication.controller';
import { PhoneAuthenticationService } from './services';
import { TokensModule } from '../tokens/tokens.module';
import { DevicesModule } from '../devices/devices.module';
import { PhoneVerificationModule } from '../phone-verification/phone-verification.module';
import { CommonModule } from '../common/common.module';
import { TwoFactorAuthenticationModule } from '../two-factor-authentication/two-factor-authentication.module';
import { SignalModule } from '../signal/signal.module';

const throttlerModuleOptions: ThrottlerModuleOptions = [
	{
		ttl: 60000,
		limit: 10,
	},
];

@Module({
	providers: [PhoneAuthenticationService],
	controllers: [PhoneAuthenticationController],
	imports: [
		ThrottlerModule.forRoot(throttlerModuleOptions),
		ClientsModule.registerAsync([
			{
				name: 'REDIS_CLIENT',
				imports: [ConfigModule],
				useFactory: (configService: ConfigService) => ({
					transport: Transport.REDIS,
					options: {
						host: configService.get<string>('REDIS_HOST', 'localhost'),
						port: configService.get<number>('REDIS_PORT', 6379),
						username: configService.get<string>('REDIS_USERNAME'),
						password: configService.get<string>('REDIS_PASSWORD'),
						db: configService.get<number>('REDIS_DB', 0),
					},
				}),
				inject: [ConfigService],
			},
		]),
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

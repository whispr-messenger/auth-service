import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TwilioHealthIndicator } from './twilio-health.indicator';

@Module({
	imports: [TypeOrmModule.forFeature([])],
	controllers: [HealthController],
	providers: [TwilioHealthIndicator],
})
export class HealthModule {}

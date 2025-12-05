import { Module } from '@nestjs/common'
import { PhoneVerificationController } from './phone-verification.controller'
import { PhoneVerificationService } from './phone-verification.service'
import { SmsService } from './sms/sms.service'

@Module({
    controllers: [PhoneVerificationController],
    providers: [PhoneVerificationService, SmsService],
})
export class PhoneVerificationModule {}

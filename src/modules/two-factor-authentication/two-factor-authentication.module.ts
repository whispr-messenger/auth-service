import { Module } from '@nestjs/common'
import { TwoFactorAuthenticationController } from './two-factor-authentication.controller'
import { TwoFactorAuthenticationService } from './two-factor-authentication.service'
import { BackupCodesService } from './backup-codes/backup-codes.service'

@Module({
    controllers: [TwoFactorAuthenticationController],
    providers: [TwoFactorAuthenticationService, BackupCodesService],
})
export class TwoFactorAuthenticationModule {}

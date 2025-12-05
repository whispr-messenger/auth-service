import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TwoFactorAuthenticationController } from './two-factor-authentication.controller';
import { TwoFactorAuthenticationService } from './two-factor-authentication.service';
import { BackupCodesService } from './backup-codes/backup-codes.service';
import { UserAuth } from './user-auth.entity';
import { BackupCode } from '../authentication/entities/backup-code.entity';
import { TokensModule } from '../tokens/tokens.module';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';

@Module({
	providers: [TwoFactorAuthenticationService, BackupCodesService, JwtAuthGuard],
	controllers: [TwoFactorAuthenticationController],
	imports: [TypeOrmModule.forFeature([UserAuth, BackupCode]), TokensModule],
	exports: [BackupCodesService],
})
export class TwoFactorAuthenticationModule {}

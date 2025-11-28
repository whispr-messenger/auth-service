import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JwtModule, JwtModuleAsyncOptions } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { CacheModule } from '@nestjs/cache-manager'
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler'
import { UserAuth } from '../entities/user-auth.entity'
import { Device } from '../entities/device.entity'
import { BackupCode } from '../entities/backup-code.entity'
import { AuthController } from '../controllers/auth.controller'
import { AuthService } from '../services/auth.service'
import { VerificationService } from '../services/verification.service'
import { SmsService } from '../services/sms.service'
import { BackupCodesService } from '../services/backup-codes.service'
import { TokenService } from '../services/token.service'
import { TwoFactorService } from '../services/two-factor.service'
import { DeviceService } from '../services/device.service'
import { JwtAuthGuard } from '../guards/jwt-auth.guard'
import { jwtModuleOptionsFactory } from '../factories/jwt'

const jwtModuleAsyncOptions: JwtModuleAsyncOptions = {
    imports: [ConfigModule],
    useFactory: jwtModuleOptionsFactory,
    inject: [ConfigService],
}

const cacheConfig: { ttl: number; max: number } = {
    ttl: 900,
    max: 1000,
}

const throttlerModuleOptions: ThrottlerModuleOptions = [
    {
        ttl: 60000,
        limit: 10,
    },
]

@Module({
    imports: [
        TypeOrmModule.forFeature([UserAuth, Device, BackupCode]),
        JwtModule.registerAsync(jwtModuleAsyncOptions),
        CacheModule.register(cacheConfig),
        ThrottlerModule.forRoot(throttlerModuleOptions),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        VerificationService,
        SmsService,
        BackupCodesService,
        TokenService,
        TwoFactorService,
        DeviceService,
        JwtAuthGuard,
    ],
    exports: [AuthService, TokenService, JwtAuthGuard],
})
export class AuthModule {}

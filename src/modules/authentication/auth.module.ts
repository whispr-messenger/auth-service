import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JwtModule, JwtModuleAsyncOptions } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { CacheModule } from '@nestjs/cache-manager'
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler'
import { UserAuth } from '../two-factor-authentication/user-auth.entity'
import { Device } from '../devices/device.entity'
import { BackupCode } from './entities/backup-code.entity'
import { AuthController } from './auth.controller'
import { AuthService } from './services/auth.service'
import { BackupCodesService } from '../two-factor-authentication/backup-codes/backup-codes.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { jwtModuleOptionsFactory } from './factories/jwt'
import { TokensModule } from '../tokens/tokens.module'
import { DevicesModule } from '../devices/devices.module'

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
        TokensModule,
        DevicesModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, BackupCodesService, JwtAuthGuard],
    exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}

import { Module, Provider } from '@nestjs/common'
import {
    ConfigModule,
    ConfigModuleOptions,
    ConfigService,
} from '@nestjs/config'
import { TypeOrmModule, TypeOrmModuleAsyncOptions } from '@nestjs/typeorm'
import { CacheModule, CacheModuleAsyncOptions } from '@nestjs/cache-manager'
import {
    ThrottlerModule,
    ThrottlerGuard,
    ThrottlerModuleOptions,
    ThrottlerOptions,
} from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'

import { HealthModule } from './modules/health/health.module'
import { typeOrmModuleOptionsFactory } from './factories/typeorm'
import { cacheModuleOptionsFactory } from './factories/cache'
import { AuthModule } from './modules/auth/auth.module'

// Environment variables
const configModuleOptions: ConfigModuleOptions = {
    isGlobal: true,
    envFilePath: '.env',
}

// Database (Postgres)
const typeOrmModuleAsyncOptions: TypeOrmModuleAsyncOptions = {
    imports: [ConfigModule],
    useFactory: typeOrmModuleOptionsFactory,
    inject: [ConfigService],
}

// Caching (Redis)
const cacheModuleAsyncOptions: CacheModuleAsyncOptions = {
    imports: [ConfigModule],
    useFactory: cacheModuleOptionsFactory,
    inject: [ConfigService],
    isGlobal: true,
}

// Rate limiting
// https://docs.nestjs.com/security/rate-limiting#multiple-throttler-definitions

const SHORT_THROTTLER: ThrottlerOptions = {
    name: 'short',
    ttl: 1000,
    limit: 3,
}

const MEDIUM_THOTTLER: ThrottlerOptions = {
    name: 'medium',
    ttl: 10000,
    limit: 20,
}

const LONG_THROTTLER: ThrottlerOptions = {
    name: 'long',
    ttl: 60000,
    limit: 100,
}

const throttlerModuleOptions: ThrottlerModuleOptions = [
    SHORT_THROTTLER,
    MEDIUM_THOTTLER,
    LONG_THROTTLER,
]

const throttlerGuardProvider: Provider = {
    provide: APP_GUARD,
    useClass: ThrottlerGuard,
}

@Module({
    imports: [
        ConfigModule.forRoot(configModuleOptions),
        TypeOrmModule.forRootAsync(typeOrmModuleAsyncOptions),
        CacheModule.registerAsync(cacheModuleAsyncOptions),
        ThrottlerModule.forRoot(throttlerModuleOptions),
        HealthModule,
        AuthModule,
    ],
    providers: [throttlerGuardProvider],
})
export class AppModule {}

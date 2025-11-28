import { Module } from '@nestjs/common'
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
} from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'

import { HealthModule } from './health/health.module'
import { typeOrmModuleOptionsFactory } from './factories/typeorm'
import { cacheModuleOptionsFactory } from './factories/cache'

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
const throttlerModuleOptions: ThrottlerModuleOptions = [
    {
        name: 'short',
        ttl: 1000,
        limit: 3,
    },
    {
        name: 'medium',
        ttl: 10000,
        limit: 20,
    },
    {
        name: 'long',
        ttl: 60000,
        limit: 100,
    },
]

@Module({
    imports: [
        ConfigModule.forRoot(configModuleOptions),
        TypeOrmModule.forRootAsync(typeOrmModuleAsyncOptions),
        CacheModule.registerAsync(cacheModuleAsyncOptions),
        ThrottlerModule.forRoot(throttlerModuleOptions),
        HealthModule,
    ],
    controllers: [],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule {}

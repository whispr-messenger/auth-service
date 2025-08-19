import { webcrypto } from 'crypto';

// Polyfill for crypto.randomUUID in Node.js 18
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth.module';
import { HealthModule } from './health/health.module';
import { UserAuth } from './entities/user-auth.entity';
import { Device } from './entities/device.entity';
import { PreKey } from './entities/prekey.entity';
import { SignedPreKey } from './entities/signed-prekey.entity';
import { IdentityKey } from './entities/identity-key.entity';
import { BackupCode } from './entities/backup-code.entity';
import { LoginHistory } from './entities/login-history.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get('DATABASE_URL');
        const dbType = configService.get('DB_TYPE', 'postgres');

        const baseConfig = {
          entities: [
            UserAuth,
            Device,
            PreKey,
            SignedPreKey,
            IdentityKey,
            BackupCode,
            LoginHistory,
          ],
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          migrationsRun:
            configService.get('DB_MIGRATIONS_RUN', 'false') === 'true',
          synchronize: configService.get('DB_SYNCHRONIZE', 'false') === 'true',
          logging: configService.get('DB_LOGGING', 'false') === 'true',
        };

        if (dbType === 'better-sqlite3') {
          return {
            ...baseConfig,
            type: 'better-sqlite3',
            database: configService.get('DB_DATABASE', ':memory:'),
          };
        }

        if (databaseUrl) {
          // Parse DATABASE_URL manually to avoid connection issues
          const url = new URL(databaseUrl);
          return {
            ...baseConfig,
            type: 'postgres',
            host: url.hostname,
            port: parseInt(url.port) || 5432,
            username: url.username,
            password: url.password,
            database: url.pathname.slice(1), // Remove leading slash
          };
        }

        return {
          ...baseConfig,
          type: 'postgres',
          host: configService.get('DB_HOST', 'localhost'),
          port: configService.get('DB_PORT', 5432),
          username: configService.get('DB_USERNAME', 'postgres'),
          password: configService.get('DB_PASSWORD', 'password'),
          database: configService.get('DB_NAME', 'auth_service'),
        };
      },
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: 'redis',
        host: configService.get('REDIS_HOST', 'redis'),
        port: configService.get('REDIS_PORT', 6379),
        password: configService.get('REDIS_PASSWORD'),
        ttl: 900,
        max: 1000,
      }),
      inject: [ConfigService],
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
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
    ]),
    AuthModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

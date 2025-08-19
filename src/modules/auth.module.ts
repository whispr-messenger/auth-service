import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserAuth } from '../entities/user-auth.entity';
import { Device } from '../entities/device.entity';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { VerificationService } from '../services/verification.service';
import { TokenService } from '../services/token.service';
import { TwoFactorService } from '../services/two-factor.service';
import { DeviceService } from '../services/device.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserAuth, Device]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        privateKey: configService.get<string>('JWT_PRIVATE_KEY'),
        publicKey: configService.get<string>('JWT_PUBLIC_KEY'),
        signOptions: {
          algorithm: 'ES256',
          expiresIn: '1h',
        },
        verifyOptions: {
          algorithms: ['ES256'],
        },
      }),
      inject: [ConfigService],
    }),
    CacheModule.register({
      ttl: 900,
      max: 1000,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    VerificationService,
    TokenService,
    TwoFactorService,
    DeviceService,
    JwtAuthGuard,
  ],
  exports: [AuthService, TokenService, JwtAuthGuard],
})
export class AuthModule {}

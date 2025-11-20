import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import {
  JwtPayload,
  TokenPair,
  DeviceFingerprint,
} from '../interfaces/verification.interface';

@Injectable()
export class TokenService {
  private readonly ACCESS_TOKEN_TTL = 60 * 60;
  private readonly REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async generateTokenPair(
    userId: string,
    deviceId: string,
    fingerprint: DeviceFingerprint,
  ): Promise<TokenPair> {
    const deviceFingerprint = this.generateDeviceFingerprint(fingerprint);
    uuidv4();
    const refreshTokenId = uuidv4();

    const accessTokenPayload: JwtPayload = {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.ACCESS_TOKEN_TTL,
      deviceId,
      scope: 'user',
      fingerprint: deviceFingerprint,
    };

    const refreshTokenPayload = {
      sub: userId,
      deviceId,
      tokenId: refreshTokenId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.REFRESH_TOKEN_TTL,
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      algorithm: 'ES256',
      expiresIn: this.ACCESS_TOKEN_TTL,
    });

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      algorithm: 'ES256',
      expiresIn: this.REFRESH_TOKEN_TTL,
    });

    await this.cacheManager.set(
      `refresh_token:${refreshTokenId}`,
      JSON.stringify({ userId, deviceId, fingerprint: deviceFingerprint }),
      this.REFRESH_TOKEN_TTL * 1000,
    );

    return { accessToken, refreshToken };
  }

  async refreshAccessToken(
    refreshToken: string,
    fingerprint: DeviceFingerprint,
  ): Promise<TokenPair> {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        algorithms: ['ES256'],
      });

      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException('Token de rafraîchissement invalide');
      }

      const tokenData = await this.cacheManager.get<string>(
        `refresh_token:${decoded.jti}`,
      );
      if (!tokenData) {
        throw new UnauthorizedException(
          'Token de rafraîchissement expiré ou révoqué',
        );
      }

      const storedData = JSON.parse(tokenData);
      const currentFingerprint = this.generateDeviceFingerprint(fingerprint);

      if (storedData.fingerprint !== currentFingerprint) {
        await this.revokeRefreshToken(decoded.jti);
        throw new UnauthorizedException("Empreinte d'appareil invalide");
      }

      await this.revokeRefreshToken(decoded.jti);

      return this.generateTokenPair(
        storedData.userId,
        storedData.deviceId,
        fingerprint,
      );
    } catch (error) {
      throw new UnauthorizedException('Token de rafraîchissement invalide');
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      const decoded = this.jwtService.decode(token) as any;
      if (decoded && decoded.jti) {
        await this.cacheManager.set(
          `revoked:${decoded.jti}`,
          JSON.stringify({ revokedAt: Date.now() }),
          (decoded.exp - Math.floor(Date.now() / 1000)) * 1000,
        );
      }
    } catch (error) {
      // Token déjà invalide, pas besoin de le révoquer
    }
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.cacheManager.del(`refresh_token:${tokenId}`);
  }

  async revokeAllTokensForDevice(deviceId: string): Promise<void> {
    // Note: Cache manager doesn't support pattern matching like Redis
    // This would need to be implemented differently or use a different approach
    // For now, we'll mark the device as revoked
    await this.cacheManager.set(
      `revoked_device:${deviceId}`,
      'true',
      this.REFRESH_TOKEN_TTL * 1000,
    );
  }

  async isTokenRevoked(tokenId: string): Promise<boolean> {
    const revoked = await this.cacheManager.get(`revoked:${tokenId}`);
    return !!revoked;
  }

  validateToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify(token, { algorithms: ['ES256'] });
    } catch (error) {
      throw new UnauthorizedException('Token invalide');
    }
  }

  private generateDeviceFingerprint(fingerprint: DeviceFingerprint): string {
    const data = `${fingerprint.userAgent || ''}:${fingerprint.ipAddress || ''}:${fingerprint.deviceType || ''}:${fingerprint.timestamp}`;
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex')
      .substring(0, 12);
  }
}

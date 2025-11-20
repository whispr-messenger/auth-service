import { CacheOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';

export function cacheModuleOptionsFactory(
  configService: ConfigService
): CacheOptions {
  return {
    store: 'redis',
    host: configService.get('REDIS_HOST', 'redis'),
    port: configService.get('REDIS_PORT', 6379),
    password: configService.get('REDIS_PASSWORD'),
    ttl: 900,
    max: 1000,
  };
}

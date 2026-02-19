import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { RedisConfig } from '../config/redis.config';

@Global()
@Module({
	providers: [RedisConfig, CacheService],
	exports: [RedisConfig, CacheService],
})
export class CacheModule {}

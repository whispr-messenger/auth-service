import { CacheOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import KeyvRedis from '@keyv/redis';

export function cacheModuleOptionsFactory(configService: ConfigService): CacheOptions {
	const redis_host = configService.get('REDIS_HOST', 'redis');
	const redis_port = configService.get('REDIS_PORT', 6379);
	const redis_username = configService.get('REDIS_USERNAME');
	const redis_password = configService.get('REDIS_PASSWORD');
	const redis_db = configService.get('REDIS_DB', 0);

	let redis_url = 'redis://';
	if (redis_username && redis_password) {
		redis_url += `${redis_username}:${redis_password}@`;
	} else if (redis_password) {
		redis_url += `:${redis_password}@`;
	}
	redis_url += `${redis_host}:${redis_port}/${redis_db}`;

	return {
		stores: [new KeyvRedis(redis_url)],
		ttl: 900,
		max: 1000,
	};
}

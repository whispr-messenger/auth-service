import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { RedisConfig } from '../../config/redis.config';
import { TwilioHealthIndicator } from './twilio-health.indicator';
import {
	ApiHealthCheckEndpoint,
	ApiLivenessEndpoint,
	ApiReadinessEndpoint,
} from './health.controller.swagger';

// Les probes kubelet tapent /health/ready toutes les 10s. Avec des throttlers
// nommes (short/medium/long), @SkipThrottle() sans argument ne skip rien et
// renvoie 429 apres 3 hits, ce qui fait flapper le pod en NotReady.
@SkipThrottle({ short: true, medium: true, long: true })
@ApiTags('Health')
@Controller('health')
export class HealthController {
	constructor(
		private readonly dataSource: DataSource,
		private readonly cacheService: CacheService,
		private readonly redisConfig: RedisConfig,
		private readonly twilioHealth: TwilioHealthIndicator
	) {}

	private readonly logger = new Logger(HealthController.name);

	@Get()
	@ApiHealthCheckEndpoint()
	async check() {
		this.logger.debug('Health check started');

		const health = {
			status: 'ok',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			memory: process.memoryUsage(),
			version: process.env.npm_package_version || '1.0.0',
			services: {
				database: 'unknown',
				cache: 'unknown',
			},
		};

		// Check database connection
		try {
			this.logger.debug('Checking database connection');
			await this.dataSource.query('SELECT 1');
			health.services.database = 'healthy';
			this.logger.debug('Database check passed');
		} catch (error) {
			if (process.env.NODE_ENV !== 'test') {
				this.logger.error('Database check failed:', error.message);
			}
			health.services.database = 'unhealthy';
			health.status = 'error';
		}

		// Check cache connection
		try {
			await this.checkCacheHealth();
			health.services.cache = 'healthy';
		} catch (error) {
			if (process.env.NODE_ENV !== 'test') {
				this.logger.error('Cache check failed:', error.message);
			}
			health.services.cache = 'unhealthy';
			health.status = 'error';
		}

		if (health.status !== 'ok') {
			throw new ServiceUnavailableException(health);
		}

		this.logger.debug('Health check completed:', health);
		return health;
	}

	@Get('ready')
	@ApiReadinessEndpoint()
	async readiness() {
		try {
			await this.dataSource.query('SELECT 1');
			await this.checkCacheHealth();
		} catch (error) {
			this.logger.error('Readiness check failed:', error.message);
			throw new ServiceUnavailableException({
				status: 'not ready',
				error: error.message,
			});
		}

		const twilio = await this.twilioHealth.check();
		if (twilio.status === 'unhealthy') {
			throw new ServiceUnavailableException({
				status: 'not ready',
				error: twilio.message,
			});
		}

		return { status: 'ready', twilio: twilio.status };
	}

	private async checkCacheHealth() {
		this.logger.debug('Checking cache connection');

		// Check internal health tracker
		const health = this.redisConfig.health;
		if (!health.isHealthy) {
			throw health.lastError || new Error('Redis connection is unhealthy');
		}

		// Verify functional cache operations
		await this.cacheService.set('health-check', 'ok', 10);
		const result = await this.cacheService.get<string>('health-check');

		if (result !== 'ok') {
			throw new Error('Cache operation failed: unexpected result');
		}
	}

	@Get('live')
	@ApiLivenessEndpoint()
	alive() {
		return {
			status: 'alive',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			version: process.env.npm_package_version || '1.0.0',
		};
	}
}

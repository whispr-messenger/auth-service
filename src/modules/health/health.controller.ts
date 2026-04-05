import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { RedisConfig } from '../../config/redis.config';
import { TwilioHealthIndicator } from './twilio-health.indicator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
	constructor(
		private readonly dataSource: DataSource,
		private readonly cacheService: CacheService,
		private readonly redisConfig: RedisConfig,
		private readonly twilioHealth: TwilioHealthIndicator
	) {}

	private logger = new Logger(HealthController.name);

	@Get()
	@ApiOperation({
		summary: 'Check service health',
		description: 'Returns the health status of the service and its dependencies (database and cache)',
	})
	@ApiResponse({ status: 200, description: 'Health check completed successfully' })
	@ApiResponse({ status: 503, description: 'One or more services are unhealthy' })
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
	@ApiOperation({
		summary: 'Check service readiness',
		description: 'Returns whether the service is ready to accept traffic',
	})
	@ApiResponse({ status: 200, description: 'Service is ready' })
	@ApiResponse({ status: 503, description: 'Service is not ready' })
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
	@ApiOperation({
		summary: 'Check service liveness',
		description:
			'Returns whether the service is alive. Checks critical dependencies (database and cache) and returns 503 when any are unavailable.',
	})
	@ApiResponse({ status: 200, description: 'Service is alive' })
	@ApiResponse({ status: 503, description: 'One or more critical dependencies are down' })
	async alive() {
		const result = {
			status: 'alive' as 'alive' | 'dead',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			version: process.env.npm_package_version || '1.0.0',
			services: {
				database: 'unknown' as string,
				cache: 'unknown' as string,
			},
		};

		// Check database connection
		try {
			await this.dataSource.query('SELECT 1');
			result.services.database = 'healthy';
		} catch (error) {
			if (process.env.NODE_ENV !== 'test') {
				this.logger.error('Liveness: database check failed:', error.message);
			}
			result.services.database = 'unhealthy';
			result.status = 'dead';
		}

		// Check cache connection
		try {
			await this.checkCacheHealth();
			result.services.cache = 'healthy';
		} catch (error) {
			if (process.env.NODE_ENV !== 'test') {
				this.logger.error('Liveness: cache check failed:', error.message);
			}
			result.services.cache = 'unhealthy';
			result.status = 'dead';
		}

		if (result.status !== 'alive') {
			throw new ServiceUnavailableException(result);
		}

		return result;
	}
}

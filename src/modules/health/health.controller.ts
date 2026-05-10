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
	async check(): Promise<{ status: 'ok' }> {
		// Reponse publique minimale - pas d'uptime/memory/version (info disclosure).
		// Le controle effectif des dependances reste sur /health/ready (probe k8s).
		let healthy = true;

		try {
			await this.dataSource.query('SELECT 1');
		} catch (error) {
			if (process.env.NODE_ENV !== 'test') {
				this.logger.error('Database check failed:', error.message);
			}
			healthy = false;
		}

		try {
			await this.checkCacheHealth();
		} catch (error) {
			if (process.env.NODE_ENV !== 'test') {
				this.logger.error('Cache check failed:', error.message);
			}
			healthy = false;
		}

		if (!healthy) {
			throw new ServiceUnavailableException({ status: 'error' });
		}

		return { status: 'ok' };
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
	alive(): { status: 'alive' } {
		// Liveness probe k8s - reponse minimale pour eviter info disclosure (version/uptime).
		return { status: 'alive' };
	}
}

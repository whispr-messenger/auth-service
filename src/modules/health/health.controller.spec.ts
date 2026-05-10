import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';
import { CacheService } from '../cache/cache.service';
import { RedisConfig } from '../../config/redis.config';
import { TwilioHealthIndicator } from './twilio-health.indicator';

// Cle interne du package nestjs/throttler - non exportee par le barrel.
// Le decorateur stocke un flag par throttler nomme (ex: THROTTLER:SKIPshort).
const THROTTLER_SKIP = 'THROTTLER:SKIP';

describe('HealthController', () => {
	let controller: HealthController;

	const mockDataSource = {
		query: jest.fn(),
	};

	const mockCacheService = {
		set: jest.fn(),
		get: jest.fn(),
	};

	const mockRedisConfig = {
		health: { isHealthy: true, lastError: null as Error | null },
	};

	const mockTwilioHealth = {
		check: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		mockRedisConfig.health = { isHealthy: true, lastError: null };

		const module: TestingModule = await Test.createTestingModule({
			controllers: [HealthController],
			providers: [
				{ provide: DataSource, useValue: mockDataSource },
				{ provide: CacheService, useValue: mockCacheService },
				{ provide: RedisConfig, useValue: mockRedisConfig },
				{ provide: TwilioHealthIndicator, useValue: mockTwilioHealth },
			],
		}).compile();

		controller = module.get<HealthController>(HealthController);
	});

	describe('alive (liveness probe)', () => {
		it('should return 200 with status alive without checking dependencies', () => {
			const result = controller.alive();

			expect(result.status).toBe('alive');
		});

		it('should not check database or cache', () => {
			controller.alive();

			expect(mockDataSource.query).not.toHaveBeenCalled();
			expect(mockCacheService.set).not.toHaveBeenCalled();
			expect(mockCacheService.get).not.toHaveBeenCalled();
		});

		it('should not leak runtime metadata (uptime, version, timestamp)', () => {
			const result = controller.alive();

			expect(result).not.toHaveProperty('uptime');
			expect(result).not.toHaveProperty('version');
			expect(result).not.toHaveProperty('timestamp');
		});
	});

	describe('check (general health)', () => {
		it('should return only { status: "ok" } when all services are healthy', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheService.set.mockResolvedValue(undefined);
			mockCacheService.get.mockResolvedValue('ok');

			const result = await controller.check();

			expect(result).toEqual({ status: 'ok' });
		});

		it('should not leak runtime metadata (uptime, memory, version)', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheService.set.mockResolvedValue(undefined);
			mockCacheService.get.mockResolvedValue('ok');

			const result = (await controller.check()) as Record<string, unknown>;

			expect(result).not.toHaveProperty('uptime');
			expect(result).not.toHaveProperty('memory');
			expect(result).not.toHaveProperty('version');
			expect(result).not.toHaveProperty('services');
		});

		it('should throw ServiceUnavailableException when database is down', async () => {
			mockDataSource.query.mockRejectedValue(new Error('Connection refused'));
			mockCacheService.set.mockResolvedValue(undefined);
			mockCacheService.get.mockResolvedValue('ok');

			await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
		});
	});

	describe('throttler skip metadata', () => {
		// Garde-fou: avec des throttlers nommes, @SkipThrottle() sans argument
		// ne skip rien et fait flapper les pods en NotReady (429 sur readiness).
		it.each(['short', 'medium', 'long'])(
			'should skip the "%s" named throttler at controller level',
			(name) => {
				const reflector = new Reflector();
				const skipped = reflector.get<boolean>(`${THROTTLER_SKIP}${name}`, HealthController);

				expect(skipped).toBe(true);
			}
		);
	});

	describe('readiness', () => {
		it('should return 200 when all services are ready', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheService.set.mockResolvedValue(undefined);
			mockCacheService.get.mockResolvedValue('ok');
			mockTwilioHealth.check.mockResolvedValue({ status: 'skipped' });

			const result = await controller.readiness();

			expect(result.status).toBe('ready');
		});

		it('should throw ServiceUnavailableException when Twilio is unhealthy', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheService.set.mockResolvedValue(undefined);
			mockCacheService.get.mockResolvedValue('ok');
			mockTwilioHealth.check.mockResolvedValue({ status: 'unhealthy', message: 'Twilio down' });

			await expect(controller.readiness()).rejects.toThrow(ServiceUnavailableException);
		});
	});
});

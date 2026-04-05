import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';
import { CacheService } from '../cache/cache.service';
import { RedisConfig } from '../../config/redis.config';
import { TwilioHealthIndicator } from './twilio-health.indicator';

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
		it('should return 200 with status alive when database and cache are healthy', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheService.set.mockResolvedValue(undefined);
			mockCacheService.get.mockResolvedValue('ok');

			const result = await controller.alive();

			expect(result.status).toBe('alive');
			expect(result.services.database).toBe('healthy');
			expect(result.services.cache).toBe('healthy');
		});

		it('should throw ServiceUnavailableException (503) when database is down', async () => {
			mockDataSource.query.mockRejectedValue(new Error('Connection refused'));
			mockCacheService.set.mockResolvedValue(undefined);
			mockCacheService.get.mockResolvedValue('ok');

			await expect(controller.alive()).rejects.toThrow(ServiceUnavailableException);
		});

		it('should throw ServiceUnavailableException (503) when cache is down', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockRedisConfig.health = { isHealthy: false, lastError: new Error('Redis down') };

			await expect(controller.alive()).rejects.toThrow(ServiceUnavailableException);
		});

		it('should throw ServiceUnavailableException (503) when both database and cache are down', async () => {
			mockDataSource.query.mockRejectedValue(new Error('Connection refused'));
			mockRedisConfig.health = { isHealthy: false, lastError: new Error('Redis down') };

			await expect(controller.alive()).rejects.toThrow(ServiceUnavailableException);
		});

		it('should include service statuses in the error response when deps are down', async () => {
			mockDataSource.query.mockRejectedValue(new Error('Connection refused'));
			mockCacheService.set.mockResolvedValue(undefined);
			mockCacheService.get.mockResolvedValue('ok');

			const error = await controller.alive().catch((e) => e);

			expect(error).toBeInstanceOf(ServiceUnavailableException);
			const response = (error as ServiceUnavailableException).getResponse();
			expect(response).toEqual(
				expect.objectContaining({
					status: 'dead',
					services: expect.objectContaining({
						database: 'unhealthy',
					}),
				})
			);
		});

		it('should throw ServiceUnavailableException when cache set/get fails', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheService.set.mockRejectedValue(new Error('ECONNREFUSED'));

			await expect(controller.alive()).rejects.toThrow(ServiceUnavailableException);
		});

		it('should throw ServiceUnavailableException when cache returns unexpected result', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheService.set.mockResolvedValue(undefined);
			mockCacheService.get.mockResolvedValue(null);

			await expect(controller.alive()).rejects.toThrow(ServiceUnavailableException);
		});

		it('should include timestamp and uptime in response', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheService.set.mockResolvedValue(undefined);
			mockCacheService.get.mockResolvedValue('ok');

			const result = await controller.alive();

			expect(result.timestamp).toBeDefined();
			expect(result.uptime).toBeGreaterThanOrEqual(0);
			expect(result.version).toBeDefined();
		});
	});

	describe('check (general health)', () => {
		it('should return 200 when all services are healthy', async () => {
			mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
			mockCacheService.set.mockResolvedValue(undefined);
			mockCacheService.get.mockResolvedValue('ok');

			const result = await controller.check();

			expect(result.status).toBe('ok');
			expect(result.services.database).toBe('healthy');
			expect(result.services.cache).toBe('healthy');
		});

		it('should throw ServiceUnavailableException when database is down', async () => {
			mockDataSource.query.mockRejectedValue(new Error('Connection refused'));
			mockCacheService.set.mockResolvedValue(undefined);
			mockCacheService.get.mockResolvedValue('ok');

			await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
		});
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

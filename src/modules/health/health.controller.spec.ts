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
		it('should return 200 with status alive without checking dependencies', () => {
			const result = controller.alive();

			expect(result.status).toBe('alive');
			expect(result.timestamp).toBeDefined();
			expect(result.uptime).toBeGreaterThanOrEqual(0);
			expect(result.version).toBeDefined();
		});

		it('should not check database or cache', () => {
			controller.alive();

			expect(mockDataSource.query).not.toHaveBeenCalled();
			expect(mockCacheService.set).not.toHaveBeenCalled();
			expect(mockCacheService.get).not.toHaveBeenCalled();
		});

		it('should not include services field in response', () => {
			const result = controller.alive();

			expect(result).not.toHaveProperty('services');
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

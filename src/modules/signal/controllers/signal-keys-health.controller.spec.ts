import { Test, TestingModule } from '@nestjs/testing';
import { SignalKeysHealthController } from './signal-keys-health.controller';
import { PreKeyRepository } from '../repositories';

describe('SignalKeysHealthController', () => {
	let controller: SignalKeysHealthController;
	let preKeyRepository: jest.Mocked<PreKeyRepository>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [SignalKeysHealthController],
			providers: [
				{
					provide: PreKeyRepository,
					useValue: {
						count: jest.fn(),
						createQueryBuilder: jest.fn(() => ({
							select: jest.fn().mockReturnThis(),
							addSelect: jest.fn().mockReturnThis(),
							where: jest.fn().mockReturnThis(),
							groupBy: jest.fn().mockReturnThis(),
							addGroupBy: jest.fn().mockReturnThis(),
							getRawMany: jest.fn(),
						})),
					},
				},
			],
		}).compile();

		controller = module.get<SignalKeysHealthController>(SignalKeysHealthController);
		preKeyRepository = module.get(PreKeyRepository);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('getHealth', () => {
		it('should return healthy status when all is well', async () => {
			preKeyRepository.count.mockResolvedValue(5000);

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				addSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				groupBy: jest.fn().mockReturnThis(),
				addGroupBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([
					{ userId: 'user1', count: '50' },
					{ userId: 'user2', count: '100' },
				]),
			};

			preKeyRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

			const result = await controller.getHealth();

			expect(result.status).toBe('healthy');
			expect(result.issues).toHaveLength(0);
			expect(result.prekeys.totalUnused).toBe(5000);
			expect(result.prekeys.devicesWithLowPrekeys).toBe(0);
		});

		it('should return unhealthy status when devices have no prekeys', async () => {
			preKeyRepository.count.mockResolvedValue(1000);

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				addSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				groupBy: jest.fn().mockReturnThis(),
				addGroupBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([
					{ userId: 'user1', count: '0' },
					{ userId: 'user2', count: '50' },
				]),
			};

			preKeyRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

			const result = await controller.getHealth();

			expect(result.status).toBe('unhealthy');
			expect(result.prekeys.devicesWithNoPrekeys).toBe(1);
			expect(result.issues.length).toBeGreaterThan(0);
		});

		it('should return degraded status with low prekeys', async () => {
			preKeyRepository.count.mockResolvedValue(3000);

			// Create 15 devices with low prekeys
			const devicesWithLowPrekeys = Array.from({ length: 15 }, (_, i) => ({
				userId: `user${i}`,
				count: '15',
			}));

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				addSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				groupBy: jest.fn().mockReturnThis(),
				addGroupBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue(devicesWithLowPrekeys),
			};

			preKeyRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

			const result = await controller.getHealth();

			expect(result.status).toBe('degraded');
			expect(result.prekeys.devicesWithLowPrekeys).toBe(15);
		});

		it('should return healthy when scheduler is hardcoded as healthy', async () => {
			preKeyRepository.count.mockResolvedValue(5000);

			const mockQueryBuilder = {
				select: jest.fn().mockReturnThis(),
				addSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				groupBy: jest.fn().mockReturnThis(),
				addGroupBy: jest.fn().mockReturnThis(),
				getRawMany: jest.fn().mockResolvedValue([]),
			};

			preKeyRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

			const result = await controller.getHealth();

			expect(result.scheduler.isHealthy).toBe(true);
			expect(result.scheduler.lastCleanupTime).toBeNull();
			expect(result.scheduler.lastPreKeyCheckTime).toBeNull();
			expect(result.scheduler.lastOldPreKeyCleanupTime).toBeNull();
		});
	});

	describe('triggerManualCleanup', () => {
		it('should return hardcoded cleanup result', async () => {
			const result = await controller.triggerManualCleanup();

			expect(result).toEqual({
				message: 'Cleanup completed successfully (scheduler disabled)',
				expiredKeysDeleted: 0,
				oldPreKeysDeleted: 0,
			});
		});
	});
});

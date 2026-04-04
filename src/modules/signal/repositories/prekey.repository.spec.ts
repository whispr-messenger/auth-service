import { PreKeyRepository } from './prekey.repository';
import { PreKey } from '../entities/prekey.entity';

describe('PreKeyRepository', () => {
	let repository: PreKeyRepository;

	const mockManager = {
		connection: {
			getMetadata: jest.fn().mockReturnValue({ name: 'PreKey' }),
		},
	};

	beforeEach(() => {
		jest.clearAllMocks();
		repository = new PreKeyRepository(PreKey, mockManager as any);

		jest.spyOn(repository, 'find').mockImplementation(jest.fn());
		jest.spyOn(repository, 'findOne').mockImplementation(jest.fn());
		jest.spyOn(repository, 'count').mockImplementation(jest.fn());
		jest.spyOn(repository, 'update').mockImplementation(jest.fn());
		jest.spyOn(repository, 'save').mockImplementation(jest.fn());
		jest.spyOn(repository, 'create').mockImplementation(jest.fn());
		jest.spyOn(repository, 'delete').mockImplementation(jest.fn());
	});

	describe('findByUserIdAndDeviceId', () => {
		it('should return all prekeys for user and device ordered by createdAt ASC', async () => {
			const keys = [{ keyId: 1 }, { keyId: 2 }] as PreKey[];
			(repository.find as jest.Mock).mockResolvedValue(keys);

			const result = await repository.findByUserIdAndDeviceId('user-1', 'device-1');

			expect(result).toEqual(keys);
			expect(repository.find).toHaveBeenCalledWith({
				where: { userId: 'user-1', deviceId: 'device-1' },
				order: { createdAt: 'ASC' },
			});
		});
	});

	describe('findUnusedByUserIdAndDeviceId', () => {
		it('should return unused prekeys', async () => {
			const keys = [{ keyId: 1, isUsed: false }] as PreKey[];
			(repository.find as jest.Mock).mockResolvedValue(keys);

			const result = await repository.findUnusedByUserIdAndDeviceId('user-1', 'device-1');

			expect(result).toEqual(keys);
			expect(repository.find).toHaveBeenCalledWith({
				where: { userId: 'user-1', deviceId: 'device-1', isUsed: false },
				order: { createdAt: 'ASC' },
			});
		});
	});

	describe('getRandomUnusedPreKey', () => {
		it('should return a random unused prekey', async () => {
			const keys = [{ keyId: 1 }, { keyId: 2 }, { keyId: 3 }] as PreKey[];
			jest.spyOn(repository, 'findUnusedByUserIdAndDeviceId').mockResolvedValue(keys);

			const result = await repository.getRandomUnusedPreKey('user-1', 'device-1');

			expect(keys).toContain(result);
		});

		it('should return null when no unused prekeys', async () => {
			jest.spyOn(repository, 'findUnusedByUserIdAndDeviceId').mockResolvedValue([]);

			const result = await repository.getRandomUnusedPreKey('user-1', 'device-1');

			expect(result).toBeNull();
		});
	});

	describe('countUnusedByUserIdAndDeviceId', () => {
		it('should return count of unused prekeys', async () => {
			(repository.count as jest.Mock).mockResolvedValue(5);

			const result = await repository.countUnusedByUserIdAndDeviceId('user-1', 'device-1');

			expect(result).toBe(5);
			expect(repository.count).toHaveBeenCalledWith({
				where: { userId: 'user-1', deviceId: 'device-1', isUsed: false },
			});
		});
	});

	describe('markAsUsed', () => {
		it('should mark a prekey as used', async () => {
			(repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

			await repository.markAsUsed('prekey-id');

			expect(repository.update).toHaveBeenCalledWith('prekey-id', { isUsed: true });
		});
	});

	describe('createPreKeys', () => {
		it('should create and save multiple prekeys', async () => {
			const preKeys = [
				{ keyId: 1, publicKey: 'pub1' },
				{ keyId: 2, publicKey: 'pub2' },
			];
			const entities = preKeys.map((pk) => ({
				...pk,
				userId: 'user-1',
				deviceId: 'device-1',
			})) as PreKey[];
			(repository.create as jest.Mock).mockImplementation((data) => data as PreKey);
			(repository.save as jest.Mock).mockResolvedValue(entities);

			const result = await repository.createPreKeys('user-1', 'device-1', preKeys);

			expect(repository.save).toHaveBeenCalled();
			expect(result).toEqual(entities);
		});
	});

	describe('replacePreKeys', () => {
		it('should delete existing keys then create new ones', async () => {
			const preKeys = [{ keyId: 1, publicKey: 'pub1' }];
			jest.spyOn(repository, 'deleteByUserIdAndDeviceId').mockResolvedValue(undefined);
			jest.spyOn(repository, 'createPreKeys').mockResolvedValue([{ keyId: 1 }] as PreKey[]);

			await repository.replacePreKeys('user-1', 'device-1', preKeys);

			expect(repository.deleteByUserIdAndDeviceId).toHaveBeenCalledWith('user-1', 'device-1');
			expect(repository.createPreKeys).toHaveBeenCalledWith('user-1', 'device-1', preKeys);
		});
	});

	describe('findOldUnused', () => {
		it('should find unused prekeys older than specified days', async () => {
			(repository.find as jest.Mock).mockResolvedValue([]);

			await repository.findOldUnused(30);

			expect(repository.find).toHaveBeenCalledWith({
				where: {
					isUsed: false,
					createdAt: expect.any(Object),
				},
			});
		});
	});

	describe('deleteOldUnused', () => {
		it('should delete unused prekeys older than specified days', async () => {
			(repository.delete as jest.Mock).mockResolvedValue({ affected: 2 });

			await repository.deleteOldUnused(30);

			expect(repository.delete).toHaveBeenCalledWith({
				isUsed: false,
				createdAt: expect.any(Object),
			});
		});
	});

	describe('deleteOldUsed', () => {
		it('should delete used prekeys older than specified days', async () => {
			(repository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

			await repository.deleteOldUsed(7);

			expect(repository.delete).toHaveBeenCalledWith({
				isUsed: true,
				createdAt: expect.any(Object),
			});
		});
	});

	describe('deleteByUserIdAndDeviceId', () => {
		it('should delete all prekeys for a user and device', async () => {
			(repository.delete as jest.Mock).mockResolvedValue({ affected: 5 });

			await repository.deleteByUserIdAndDeviceId('user-1', 'device-1');

			expect(repository.delete).toHaveBeenCalledWith({ userId: 'user-1', deviceId: 'device-1' });
		});
	});

	describe('deleteByUserId', () => {
		it('should delete all prekeys for a user', async () => {
			(repository.delete as jest.Mock).mockResolvedValue({ affected: 10 });

			await repository.deleteByUserId('user-1');

			expect(repository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
		});
	});
});

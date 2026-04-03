import { IdentityKeyRepository } from './identity-key.repository';
import { IdentityKey } from '../entities/identity-key.entity';

describe('IdentityKeyRepository', () => {
	let repository: IdentityKeyRepository;

	const mockManager = {
		connection: {
			getMetadata: jest.fn().mockReturnValue({ name: 'IdentityKey' }),
		},
		findOne: jest.fn(),
		find: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		delete: jest.fn(),
		count: jest.fn(),
		update: jest.fn(),
	};

	beforeEach(() => {
		jest.clearAllMocks();
		repository = new IdentityKeyRepository(IdentityKey, mockManager as any);

		// Spy on inherited Repository methods
		jest.spyOn(repository, 'findOne').mockImplementation(mockManager.findOne);
		jest.spyOn(repository, 'save').mockImplementation(mockManager.save);
		jest.spyOn(repository, 'create').mockImplementation(mockManager.create);
		jest.spyOn(repository, 'delete').mockImplementation(mockManager.delete);
	});

	describe('findByUserIdAndDeviceId', () => {
		it('should find an identity key by userId and deviceId', async () => {
			const expected = { userId: 'user-1', deviceId: 'device-1', publicKey: 'pubkey' } as IdentityKey;
			mockManager.findOne.mockResolvedValue(expected);

			const result = await repository.findByUserIdAndDeviceId('user-1', 'device-1');

			expect(result).toEqual(expected);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { userId: 'user-1', deviceId: 'device-1' },
			});
		});

		it('should return null when not found', async () => {
			mockManager.findOne.mockResolvedValue(null);

			const result = await repository.findByUserIdAndDeviceId('user-1', 'device-1');

			expect(result).toBeNull();
		});
	});

	describe('upsertIdentityKey', () => {
		it('should update existing key when it exists', async () => {
			const existing = {
				userId: 'user-1',
				deviceId: 'device-1',
				publicKey: 'old-key',
				updatedAt: new Date('2024-01-01'),
			} as IdentityKey;
			const updated = { ...existing, publicKey: 'new-key' } as IdentityKey;
			mockManager.findOne.mockResolvedValue(existing);
			mockManager.save.mockResolvedValue(updated);

			const result = await repository.upsertIdentityKey('user-1', 'device-1', 'new-key');

			expect(result.publicKey).toBe('new-key');
			expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ publicKey: 'new-key' }));
		});

		it('should create a new key when it does not exist', async () => {
			const newKey = { userId: 'user-1', deviceId: 'device-1', publicKey: 'new-key' } as IdentityKey;
			mockManager.findOne.mockResolvedValue(null);
			mockManager.create.mockReturnValue(newKey);
			mockManager.save.mockResolvedValue(newKey);

			const result = await repository.upsertIdentityKey('user-1', 'device-1', 'new-key');

			expect(result).toEqual(newKey);
			expect(repository.create).toHaveBeenCalledWith({
				userId: 'user-1',
				deviceId: 'device-1',
				publicKey: 'new-key',
			});
			expect(repository.save).toHaveBeenCalledWith(newKey);
		});
	});

	describe('deleteByUserIdAndDeviceId', () => {
		it('should delete identity key for a user and device', async () => {
			mockManager.delete.mockResolvedValue({ affected: 1 });

			await repository.deleteByUserIdAndDeviceId('user-1', 'device-1');

			expect(repository.delete).toHaveBeenCalledWith({ userId: 'user-1', deviceId: 'device-1' });
		});
	});

	describe('deleteByUserId', () => {
		it('should delete all identity keys for a user', async () => {
			mockManager.delete.mockResolvedValue({ affected: 3 });

			await repository.deleteByUserId('user-1');

			expect(repository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
		});
	});
});

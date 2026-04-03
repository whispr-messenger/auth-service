import { SignedPreKeyRepository } from './signed-prekey.repository';
import { SignedPreKey } from '../entities/signed-prekey.entity';

describe('SignedPreKeyRepository', () => {
	let repository: SignedPreKeyRepository;

	const mockManager = {
		connection: {
			getMetadata: jest.fn().mockReturnValue({ name: 'SignedPreKey' }),
		},
	};

	const expiresAt = new Date(Date.now() + 86400000);

	beforeEach(() => {
		jest.clearAllMocks();
		repository = new SignedPreKeyRepository(SignedPreKey, mockManager as any);

		jest.spyOn(repository, 'find').mockImplementation(jest.fn());
		jest.spyOn(repository, 'findOne').mockImplementation(jest.fn());
		jest.spyOn(repository, 'save').mockImplementation(jest.fn());
		jest.spyOn(repository, 'create').mockImplementation(jest.fn());
		jest.spyOn(repository, 'delete').mockImplementation(jest.fn());
	});

	describe('findByUserIdAndDeviceId', () => {
		it('should return signed prekeys ordered by createdAt DESC', async () => {
			const keys = [{ keyId: 2 }, { keyId: 1 }] as SignedPreKey[];
			(repository.find as jest.Mock).mockResolvedValue(keys);

			const result = await repository.findByUserIdAndDeviceId('user-1', 'device-1');

			expect(result).toEqual(keys);
			expect(repository.find).toHaveBeenCalledWith({
				where: { userId: 'user-1', deviceId: 'device-1' },
				order: { createdAt: 'DESC' },
			});
		});
	});

	describe('findActiveByUserIdAndDeviceId', () => {
		it('should return the most recent active signed prekey', async () => {
			const key = { keyId: 1, expiresAt } as SignedPreKey;
			(repository.findOne as jest.Mock).mockResolvedValue(key);

			const result = await repository.findActiveByUserIdAndDeviceId('user-1', 'device-1');

			expect(result).toEqual(key);
			expect(repository.findOne).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ userId: 'user-1', deviceId: 'device-1' }),
					order: { createdAt: 'DESC' },
				})
			);
		});

		it('should return null when no active key exists', async () => {
			(repository.findOne as jest.Mock).mockResolvedValue(null);

			const result = await repository.findActiveByUserIdAndDeviceId('user-1', 'device-1');

			expect(result).toBeNull();
		});
	});

	describe('findByUserIdDeviceIdAndKeyId', () => {
		it('should find a specific signed prekey by keyId', async () => {
			const key = { userId: 'user-1', deviceId: 'device-1', keyId: 42 } as SignedPreKey;
			(repository.findOne as jest.Mock).mockResolvedValue(key);

			const result = await repository.findByUserIdDeviceIdAndKeyId('user-1', 'device-1', 42);

			expect(result).toEqual(key);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { userId: 'user-1', deviceId: 'device-1', keyId: 42 },
			});
		});

		it('should return null when not found', async () => {
			(repository.findOne as jest.Mock).mockResolvedValue(null);

			const result = await repository.findByUserIdDeviceIdAndKeyId('user-1', 'device-1', 99);

			expect(result).toBeNull();
		});
	});

	describe('createSignedPreKey', () => {
		it('should create and save a new signed prekey', async () => {
			const newKey = {
				userId: 'user-1',
				deviceId: 'device-1',
				keyId: 1,
				publicKey: 'pubkey',
				signature: 'sig',
				expiresAt,
			} as SignedPreKey;
			(repository.create as jest.Mock).mockReturnValue(newKey);
			(repository.save as jest.Mock).mockResolvedValue(newKey);

			const result = await repository.createSignedPreKey(
				'user-1',
				'device-1',
				1,
				'pubkey',
				'sig',
				expiresAt
			);

			expect(result).toEqual(newKey);
			expect(repository.save).toHaveBeenCalledWith(newKey);
		});
	});

	describe('upsertSignedPreKey', () => {
		it('should update existing key when found', async () => {
			const existing = {
				userId: 'user-1',
				deviceId: 'device-1',
				keyId: 1,
				publicKey: 'old-key',
				signature: 'old-sig',
				expiresAt: new Date(),
			} as SignedPreKey;
			jest.spyOn(repository, 'findByUserIdDeviceIdAndKeyId').mockResolvedValue(existing);
			(repository.save as jest.Mock).mockResolvedValue({ ...existing, publicKey: 'new-key' });

			const result = await repository.upsertSignedPreKey(
				'user-1',
				'device-1',
				1,
				'new-key',
				'new-sig',
				expiresAt
			);

			expect(result.publicKey).toBe('new-key');
			expect(repository.save).toHaveBeenCalledWith(
				expect.objectContaining({ publicKey: 'new-key', signature: 'new-sig', expiresAt })
			);
		});

		it('should create a new key when not found', async () => {
			const newKey = {
				userId: 'user-1',
				deviceId: 'device-1',
				keyId: 1,
				publicKey: 'pubkey',
				signature: 'sig',
				expiresAt,
			} as SignedPreKey;
			jest.spyOn(repository, 'findByUserIdDeviceIdAndKeyId').mockResolvedValue(null);
			jest.spyOn(repository, 'createSignedPreKey').mockResolvedValue(newKey);

			const result = await repository.upsertSignedPreKey(
				'user-1',
				'device-1',
				1,
				'pubkey',
				'sig',
				expiresAt
			);

			expect(result).toEqual(newKey);
			expect(repository.createSignedPreKey).toHaveBeenCalledWith(
				'user-1',
				'device-1',
				1,
				'pubkey',
				'sig',
				expiresAt
			);
		});
	});

	describe('findExpired', () => {
		it('should return expired signed prekeys', async () => {
			const expired = [{ keyId: 1, expiresAt: new Date('2020-01-01') }] as SignedPreKey[];
			(repository.find as jest.Mock).mockResolvedValue(expired);

			const result = await repository.findExpired();

			expect(result).toEqual(expired);
			expect(repository.find).toHaveBeenCalledWith({
				where: { expiresAt: expect.any(Object) },
			});
		});
	});

	describe('deleteExpiredByUserIdAndDeviceId', () => {
		it('should delete expired keys for a user and device', async () => {
			(repository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

			await repository.deleteExpiredByUserIdAndDeviceId('user-1', 'device-1');

			expect(repository.delete).toHaveBeenCalledWith(
				expect.objectContaining({ userId: 'user-1', deviceId: 'device-1' })
			);
		});
	});

	describe('deleteByUserIdAndDeviceId', () => {
		it('should delete all signed prekeys for a user and device', async () => {
			(repository.delete as jest.Mock).mockResolvedValue({ affected: 2 });

			await repository.deleteByUserIdAndDeviceId('user-1', 'device-1');

			expect(repository.delete).toHaveBeenCalledWith({ userId: 'user-1', deviceId: 'device-1' });
		});
	});

	describe('deleteByUserId', () => {
		it('should delete all signed prekeys for a user', async () => {
			(repository.delete as jest.Mock).mockResolvedValue({ affected: 5 });

			await repository.deleteByUserId('user-1');

			expect(repository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
		});
	});
});

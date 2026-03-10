import { Test, TestingModule } from '@nestjs/testing';
import { SignalKeyStorageService } from './signal-key-storage.service';
import { IdentityKeyRepository } from '../repositories/identity-key.repository';
import { SignedPreKeyRepository } from '../repositories/signed-prekey.repository';
import { PreKeyRepository } from '../repositories/prekey.repository';
import { IdentityKey } from '../entities/identity-key.entity';
import { SignedPreKey } from '../entities/signed-prekey.entity';
import { PreKey } from '../entities/prekey.entity';
import { SignedPreKeyDto, PreKeyDto } from '../dto';

describe('SignalKeyStorageService', () => {
	let service: SignalKeyStorageService;
	let identityKeyRepository: jest.Mocked<IdentityKeyRepository>;
	let signedPreKeyRepository: jest.Mocked<SignedPreKeyRepository>;
	let preKeyRepository: jest.Mocked<PreKeyRepository>;

	const mockUserId = 'test-user-id';
	const mockDeviceId = 'test-device-id';

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SignalKeyStorageService,
				{
					provide: IdentityKeyRepository,
					useValue: {
						upsertIdentityKey: jest.fn(),
						findByUserIdAndDeviceId: jest.fn(),
						deleteByUserId: jest.fn(),
						deleteByUserIdAndDeviceId: jest.fn(),
					},
				},
				{
					provide: SignedPreKeyRepository,
					useValue: {
						upsertSignedPreKey: jest.fn(),
						findActiveByUserIdAndDeviceId: jest.fn(),
						deleteByUserId: jest.fn(),
						deleteByUserIdAndDeviceId: jest.fn(),
					},
				},
				{
					provide: PreKeyRepository,
					useValue: {
						replacePreKeys: jest.fn(),
						getRandomUnusedPreKey: jest.fn(),
						countUnusedByUserIdAndDeviceId: jest.fn(),
						markAsUsed: jest.fn(),
						deleteByUserId: jest.fn(),
						deleteByUserIdAndDeviceId: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<SignalKeyStorageService>(SignalKeyStorageService);
		identityKeyRepository = module.get(IdentityKeyRepository);
		signedPreKeyRepository = module.get(SignedPreKeyRepository);
		preKeyRepository = module.get(PreKeyRepository);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('storeIdentityKey', () => {
		it('should store an identity key for a user', async () => {
			const identityKey = 'base64-encoded-public-key';
			const mockIdentityKey: Partial<IdentityKey> = {
				id: 'key-id',
				userId: mockUserId,
				deviceId: mockDeviceId,
				publicKey: identityKey,
				createdAt: new Date(),
				updatedAt: new Date(),
				user: undefined,
			};

			identityKeyRepository.upsertIdentityKey.mockResolvedValue(mockIdentityKey as IdentityKey);

			const result = await service.storeIdentityKey(mockUserId, mockDeviceId, identityKey);

			expect(identityKeyRepository.upsertIdentityKey).toHaveBeenCalledWith(
				mockUserId,
				mockDeviceId,
				identityKey
			);
			expect(result).toEqual(mockIdentityKey);
		});

		it('should throw an error if storing fails', async () => {
			const identityKey = 'base64-encoded-public-key';
			identityKeyRepository.upsertIdentityKey.mockRejectedValue(new Error('Database error'));

			await expect(service.storeIdentityKey(mockUserId, mockDeviceId, identityKey)).rejects.toThrow(
				'Database error'
			);
		});
	});

	describe('storeSignedPreKey', () => {
		it('should upsert a signed prekey with expiration', async () => {
			const signedPreKeyDto: SignedPreKeyDto = {
				keyId: 1,
				publicKey: 'base64-signed-prekey',
				signature: 'base64-signature',
			};

			const mockSignedPreKey: Partial<SignedPreKey> = {
				id: 'spk-id',
				userId: mockUserId,
				keyId: signedPreKeyDto.keyId,
				publicKey: signedPreKeyDto.publicKey,
				signature: signedPreKeyDto.signature,
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				user: undefined,
			};

			signedPreKeyRepository.upsertSignedPreKey.mockResolvedValue(mockSignedPreKey as SignedPreKey);

			const result = await service.storeSignedPreKey(mockUserId, mockDeviceId, signedPreKeyDto);

			expect(signedPreKeyRepository.upsertSignedPreKey).toHaveBeenCalledWith(
				mockUserId,
				mockDeviceId,
				signedPreKeyDto.keyId,
				signedPreKeyDto.publicKey,
				signedPreKeyDto.signature,
				expect.any(Date)
			);
			expect(result).toEqual(mockSignedPreKey);
		});

		it('should update an existing signed prekey on re-login', async () => {
			const signedPreKeyDto: SignedPreKeyDto = {
				keyId: 1,
				publicKey: 'new-base64-signed-prekey',
				signature: 'new-base64-signature',
			};

			const updatedMock: Partial<SignedPreKey> = {
				id: 'spk-id',
				userId: mockUserId,
				keyId: 1,
				publicKey: 'new-base64-signed-prekey',
				signature: 'new-base64-signature',
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				user: undefined,
			};

			signedPreKeyRepository.upsertSignedPreKey.mockResolvedValue(updatedMock as SignedPreKey);

			const result = await service.storeSignedPreKey(mockUserId, mockDeviceId, signedPreKeyDto);

			expect(signedPreKeyRepository.upsertSignedPreKey).toHaveBeenCalledTimes(1);
			expect(result.publicKey).toBe('new-base64-signed-prekey');
		});
	});

	describe('storePreKeys', () => {
		it('should replace prekeys for the device', async () => {
			const preKeysDto: PreKeyDto[] = [
				{ keyId: 1, publicKey: 'pk1' },
				{ keyId: 2, publicKey: 'pk2' },
				{ keyId: 3, publicKey: 'pk3' },
			];

			const mockPreKeys: Partial<PreKey>[] = preKeysDto.map((pk, index) => ({
				id: `pk-id-${index}`,
				userId: mockUserId,
				keyId: pk.keyId,
				publicKey: pk.publicKey,
				isOneTime: true,
				isUsed: false,
				createdAt: new Date(),
				user: undefined,
			}));

			preKeyRepository.replacePreKeys.mockResolvedValue(mockPreKeys as PreKey[]);

			const result = await service.storePreKeys(mockUserId, mockDeviceId, preKeysDto);

			expect(preKeyRepository.replacePreKeys).toHaveBeenCalledWith(
				mockUserId,
				mockDeviceId,
				preKeysDto.map((pk) => ({ keyId: pk.keyId, publicKey: pk.publicKey }))
			);
			expect(result).toEqual(mockPreKeys);
			expect(result).toHaveLength(3);
		});

		it('should replace existing prekeys on re-login without duplicate key errors', async () => {
			const preKeysDto: PreKeyDto[] = [
				{ keyId: 1, publicKey: 'new-pk1' },
				{ keyId: 2, publicKey: 'new-pk2' },
			];

			const mockPreKeys: Partial<PreKey>[] = preKeysDto.map((pk, index) => ({
				id: `pk-id-${index}`,
				userId: mockUserId,
				keyId: pk.keyId,
				publicKey: pk.publicKey,
				isOneTime: true,
				isUsed: false,
				createdAt: new Date(),
				user: undefined,
			}));

			preKeyRepository.replacePreKeys.mockResolvedValue(mockPreKeys as PreKey[]);

			const result = await service.storePreKeys(mockUserId, mockDeviceId, preKeysDto);

			expect(preKeyRepository.replacePreKeys).toHaveBeenCalledTimes(1);
			expect(result).toHaveLength(2);
		});
	});

	describe('getIdentityKey', () => {
		it('should retrieve an identity key for a user', async () => {
			const mockIdentityKey: Partial<IdentityKey> = {
				id: 'key-id',
				userId: mockUserId,
				deviceId: mockDeviceId,
				publicKey: 'base64-key',
				createdAt: new Date(),
				updatedAt: new Date(),
				user: undefined,
			};

			identityKeyRepository.findByUserIdAndDeviceId.mockResolvedValue(mockIdentityKey as IdentityKey);

			const result = await service.getIdentityKey(mockUserId, mockDeviceId);

			expect(identityKeyRepository.findByUserIdAndDeviceId).toHaveBeenCalledWith(
				mockUserId,
				mockDeviceId
			);
			expect(result).toEqual(mockIdentityKey);
		});

		it('should return null if no identity key exists', async () => {
			identityKeyRepository.findByUserIdAndDeviceId.mockResolvedValue(null);

			const result = await service.getIdentityKey(mockUserId, mockDeviceId);

			expect(result).toBeNull();
		});
	});

	describe('getActiveSignedPreKey', () => {
		it('should retrieve the active signed prekey', async () => {
			const mockSignedPreKey: Partial<SignedPreKey> = {
				id: 'spk-id',
				userId: mockUserId,
				keyId: 1,
				publicKey: 'base64-key',
				signature: 'base64-sig',
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				user: undefined,
			};

			signedPreKeyRepository.findActiveByUserIdAndDeviceId.mockResolvedValue(
				mockSignedPreKey as SignedPreKey
			);

			const result = await service.getActiveSignedPreKey(mockUserId, mockDeviceId);

			expect(signedPreKeyRepository.findActiveByUserIdAndDeviceId).toHaveBeenCalledWith(
				mockUserId,
				mockDeviceId
			);
			expect(result).toEqual(mockSignedPreKey);
		});

		it('should return null if no active signed prekey exists', async () => {
			signedPreKeyRepository.findActiveByUserIdAndDeviceId.mockResolvedValue(null);

			const result = await service.getActiveSignedPreKey(mockUserId, mockDeviceId);

			expect(result).toBeNull();
		});
	});

	describe('getUnusedPreKey', () => {
		it('should retrieve a random unused prekey', async () => {
			const mockPreKey: Partial<PreKey> = {
				id: 'pk-id',
				userId: mockUserId,
				keyId: 42,
				publicKey: 'base64-key',
				isOneTime: true,
				isUsed: false,
				createdAt: new Date(),
				user: undefined,
			};

			preKeyRepository.getRandomUnusedPreKey.mockResolvedValue(mockPreKey as PreKey);

			const result = await service.getUnusedPreKey(mockUserId, mockDeviceId);

			expect(preKeyRepository.getRandomUnusedPreKey).toHaveBeenCalledWith(mockUserId, mockDeviceId);
			expect(result).toEqual(mockPreKey);
		});

		it('should return null if no unused prekeys are available', async () => {
			preKeyRepository.getRandomUnusedPreKey.mockResolvedValue(null);

			const result = await service.getUnusedPreKey(mockUserId, mockDeviceId);

			expect(result).toBeNull();
		});
	});

	describe('getUnusedPreKeyCount', () => {
		it('should return the count of unused prekeys', async () => {
			preKeyRepository.countUnusedByUserIdAndDeviceId.mockResolvedValue(50);

			const result = await service.getUnusedPreKeyCount(mockUserId, mockDeviceId);

			expect(preKeyRepository.countUnusedByUserIdAndDeviceId).toHaveBeenCalledWith(
				mockUserId,
				mockDeviceId
			);
			expect(result).toBe(50);
		});
	});

	describe('markPreKeyAsUsed', () => {
		it('should mark a prekey as used', async () => {
			const preKeyId = 'pk-id';
			preKeyRepository.markAsUsed.mockResolvedValue(undefined);

			await service.markPreKeyAsUsed(preKeyId);

			expect(preKeyRepository.markAsUsed).toHaveBeenCalledWith(preKeyId);
		});
	});

	describe('deleteAllKeysForUser', () => {
		it('should delete all keys for a user', async () => {
			identityKeyRepository.deleteByUserId.mockResolvedValue(undefined);
			signedPreKeyRepository.deleteByUserId.mockResolvedValue(undefined);
			preKeyRepository.deleteByUserId.mockResolvedValue(undefined);

			await service.deleteAllKeysForUser(mockUserId);

			expect(identityKeyRepository.deleteByUserId).toHaveBeenCalledWith(mockUserId);
			expect(signedPreKeyRepository.deleteByUserId).toHaveBeenCalledWith(mockUserId);
			expect(preKeyRepository.deleteByUserId).toHaveBeenCalledWith(mockUserId);
		});

		it('should throw an error if deletion fails', async () => {
			identityKeyRepository.deleteByUserId.mockRejectedValue(new Error('Delete failed'));

			await expect(service.deleteAllKeysForUser(mockUserId)).rejects.toThrow('Delete failed');
		});
	});
});

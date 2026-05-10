import { DeviceRepository } from './device.repository';
import { Device } from '../entities/device.entity';

describe('DeviceRepository', () => {
	let repository: DeviceRepository;

	const mockManager = {
		connection: {
			getMetadata: jest.fn().mockReturnValue({ name: 'Device' }),
		},
	};

	beforeEach(() => {
		jest.clearAllMocks();
		repository = new DeviceRepository(Device, mockManager as any);

		jest.spyOn(repository, 'findOne').mockImplementation(jest.fn());
		jest.spyOn(repository, 'find').mockImplementation(jest.fn());
		jest.spyOn(repository, 'count').mockImplementation(jest.fn());
	});

	describe('findByUserAndFingerprint', () => {
		it('should find by fingerprint when provided', async () => {
			const device = { id: 'device-id', userId: 'user-id' } as Device;
			(repository.findOne as jest.Mock).mockResolvedValue(device);

			const result = await repository.findByUserAndFingerprint(
				'user-id',
				'iPhone',
				'mobile',
				'fp-abc123'
			);

			expect(result).toEqual(device);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { userId: 'user-id', deviceFingerprint: 'fp-abc123' },
			});
		});

		it('should find by name and type when no fingerprint', async () => {
			const device = { id: 'device-id', userId: 'user-id' } as Device;
			(repository.findOne as jest.Mock).mockResolvedValue(device);

			const result = await repository.findByUserAndFingerprint('user-id', 'iPhone', 'mobile');

			expect(result).toEqual(device);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { userId: 'user-id', deviceName: 'iPhone', deviceType: 'mobile' },
			});
		});

		it('should return null when device not found', async () => {
			(repository.findOne as jest.Mock).mockResolvedValue(null);

			const result = await repository.findByUserAndFingerprint('user-id', 'iPhone', 'mobile');

			expect(result).toBeNull();
		});
	});

	describe('findVerifiedByUserId', () => {
		it('should return verified devices ordered by lastActive DESC', async () => {
			const devices = [{ id: 'd1' }, { id: 'd2' }] as Device[];
			(repository.find as jest.Mock).mockResolvedValue(devices);

			const result = await repository.findVerifiedByUserId('user-id');

			expect(result).toEqual(devices);
			expect(repository.find).toHaveBeenCalledWith({
				where: { userId: 'user-id', isVerified: true },
				order: { lastActive: 'DESC' },
			});
		});
	});

	describe('findActiveDevices', () => {
		it('should return active verified devices within threshold', async () => {
			const devices = [{ id: 'd1' }] as Device[];
			(repository.find as jest.Mock).mockResolvedValue(devices);

			const result = await repository.findActiveDevices('user-id', 30);

			expect(result).toEqual(devices);
			expect(repository.find).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ userId: 'user-id', isVerified: true }),
					order: { lastActive: 'DESC' },
				})
			);
		});
	});

	describe('countVerifiedDevices', () => {
		it('should return count of verified devices', async () => {
			(repository.count as jest.Mock).mockResolvedValue(3);

			const result = await repository.countVerifiedDevices('user-id');

			expect(result).toBe(3);
			expect(repository.count).toHaveBeenCalledWith({
				where: { userId: 'user-id', isVerified: true },
			});
		});
	});

	describe('countActiveDevices', () => {
		it('should return count of active verified devices', async () => {
			(repository.count as jest.Mock).mockResolvedValue(2);

			const result = await repository.countActiveDevices('user-id', 30);

			expect(result).toBe(2);
			expect(repository.count).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ userId: 'user-id', isVerified: true }),
				})
			);
		});
	});

	describe('findByUserIdAndDeviceId', () => {
		it('should find device by userId and deviceId', async () => {
			const device = { id: 'device-id', userId: 'user-id' } as Device;
			(repository.findOne as jest.Mock).mockResolvedValue(device);

			const result = await repository.findByUserIdAndDeviceId('user-id', 'device-id');

			expect(result).toEqual(device);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: 'device-id', userId: 'user-id' },
			});
		});

		it('should return null when not found', async () => {
			(repository.findOne as jest.Mock).mockResolvedValue(null);

			const result = await repository.findByUserIdAndDeviceId('user-id', 'bad-id');

			expect(result).toBeNull();
		});
	});

	describe('findOldestVerifiedByUserId', () => {
		it('should return the oldest verified device ordered by createdAt ASC', async () => {
			const device = { id: 'oldest-device', userId: 'user-id', isVerified: true } as Device;
			(repository.findOne as jest.Mock).mockResolvedValue(device);

			const result = await repository.findOldestVerifiedByUserId('user-id');

			expect(result).toEqual(device);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { userId: 'user-id', isVerified: true },
				order: { createdAt: 'ASC' },
			});
		});

		it('should return null when user has no verified devices', async () => {
			(repository.findOne as jest.Mock).mockResolvedValue(null);

			const result = await repository.findOldestVerifiedByUserId('user-id');

			expect(result).toBeNull();
		});
	});
});

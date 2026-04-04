import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserAuthService } from './user-auth.service';
import { UserAuth } from '../entities/user-auth.entity';

describe('UserAuthService', () => {
	let service: UserAuthService;

	const mockUserAuthRepository = {
		findOne: jest.fn(),
		create: jest.fn(),
		save: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UserAuthService,
				{
					provide: getRepositoryToken(UserAuth),
					useValue: mockUserAuthRepository,
				},
			],
		}).compile();

		service = module.get<UserAuthService>(UserAuthService);
	});

	describe('findByPhoneNumber', () => {
		it('should return a user when found', async () => {
			const user = { id: 'user-id', phoneNumber: '+33612345678' } as UserAuth;
			mockUserAuthRepository.findOne.mockResolvedValue(user);

			const result = await service.findByPhoneNumber('+33612345678');

			expect(result).toEqual(user);
			expect(mockUserAuthRepository.findOne).toHaveBeenCalledWith({
				where: { phoneNumber: '+33612345678' },
			});
		});

		it('should return null when not found', async () => {
			mockUserAuthRepository.findOne.mockResolvedValue(null);

			const result = await service.findByPhoneNumber('+33600000000');

			expect(result).toBeNull();
		});
	});

	describe('findById', () => {
		it('should return a user when found', async () => {
			const user = { id: 'user-id', phoneNumber: '+33612345678' } as UserAuth;
			mockUserAuthRepository.findOne.mockResolvedValue(user);

			const result = await service.findById('user-id');

			expect(result).toEqual(user);
			expect(mockUserAuthRepository.findOne).toHaveBeenCalledWith({
				where: { id: 'user-id' },
			});
		});

		it('should return null when not found', async () => {
			mockUserAuthRepository.findOne.mockResolvedValue(null);

			const result = await service.findById('bad-id');

			expect(result).toBeNull();
		});
	});

	describe('createUser', () => {
		it('should create a user entity from partial data', () => {
			const partial = { phoneNumber: '+33612345678' };
			const user = { id: 'user-id', ...partial } as UserAuth;
			mockUserAuthRepository.create.mockReturnValue(user);

			const result = service.createUser(partial);

			expect(result).toEqual(user);
			expect(mockUserAuthRepository.create).toHaveBeenCalledWith(partial);
		});
	});

	describe('saveUser', () => {
		it('should save and return the user', async () => {
			const user = { id: 'user-id', phoneNumber: '+33612345678' } as UserAuth;
			mockUserAuthRepository.save.mockResolvedValue(user);

			const result = await service.saveUser(user);

			expect(result).toEqual(user);
			expect(mockUserAuthRepository.save).toHaveBeenCalledWith(user);
		});
	});
});

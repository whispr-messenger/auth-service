import { Test, TestingModule } from '@nestjs/testing';
import { SmsVerificationStrategy } from './sms-verification.strategy';
import { SmsService } from '../services/sms/sms.service';

describe('SmsVerificationStrategy', () => {
	let strategy: SmsVerificationStrategy;

	const mockSmsService = {
		sendVerificationCode: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [SmsVerificationStrategy, { provide: SmsService, useValue: mockSmsService }],
		}).compile();

		strategy = module.get<SmsVerificationStrategy>(SmsVerificationStrategy);
	});

	describe('getChannelName', () => {
		it('should return "sms"', () => {
			expect(strategy.getChannelName()).toBe('sms');
		});
	});

	describe('sendVerification', () => {
		it('should call smsService.sendVerificationCode with the provided args', async () => {
			mockSmsService.sendVerificationCode.mockResolvedValue(undefined);

			await strategy.sendVerification('+33612345678', '123456', 'registration');

			expect(mockSmsService.sendVerificationCode).toHaveBeenCalledWith(
				'+33612345678',
				'123456',
				'registration'
			);
		});

		it('should not throw when smsService fails in non-production env', async () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = 'development';

			try {
				mockSmsService.sendVerificationCode.mockRejectedValue(new Error('SMS failed'));

				await expect(
					strategy.sendVerification('+33612345678', '123456', 'login')
				).resolves.toBeUndefined();
			} finally {
				process.env.NODE_ENV = originalEnv;
			}
		});

		it('should rethrow when smsService fails in production', async () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = 'production';

			try {
				mockSmsService.sendVerificationCode.mockRejectedValue(new Error('SMS failed'));

				await expect(
					strategy.sendVerification('+33612345678', '123456', 'registration')
				).rejects.toThrow('SMS failed');
			} finally {
				process.env.NODE_ENV = originalEnv;
			}
		});
	});
});

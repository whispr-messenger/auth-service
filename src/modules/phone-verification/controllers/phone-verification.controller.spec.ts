import { Test, TestingModule } from '@nestjs/testing';
import { PhoneVerificationController } from './phone-verification.controller';
import { PhoneVerificationService } from '../services';

describe('PhoneVerificationController', () => {
	let controller: PhoneVerificationController;

	const mockPhoneVerificationService = {
		requestRegistrationVerification: jest.fn(),
		confirmRegistrationVerification: jest.fn(),
		requestLoginVerification: jest.fn(),
		confirmLoginVerification: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [PhoneVerificationController],
			providers: [{ provide: PhoneVerificationService, useValue: mockPhoneVerificationService }],
		}).compile();

		controller = module.get<PhoneVerificationController>(PhoneVerificationController);
	});

	describe('requestRegistrationVerification', () => {
		it('should delegate to service and return result', async () => {
			const dto = { phoneNumber: '+33612345678' };
			const req = { ip: '1.2.3.4' } as any;
			mockPhoneVerificationService.requestRegistrationVerification.mockResolvedValue({
				verificationId: 'vid-1',
			});

			const result = await controller.requestRegistrationVerification(dto, req);

			expect(result).toEqual({ verificationId: 'vid-1' });
			expect(mockPhoneVerificationService.requestRegistrationVerification).toHaveBeenCalledWith(
				dto,
				'1.2.3.4'
			);
		});
	});

	describe('confirmRegistrationVerification', () => {
		it('should delegate to service and return result', async () => {
			const dto = { verificationId: 'vid-1', code: '123456' };
			mockPhoneVerificationService.confirmRegistrationVerification.mockResolvedValue({
				verified: true,
			});

			const result = await controller.confirmRegistrationVerification(dto);

			expect(result).toEqual({ verified: true });
			expect(mockPhoneVerificationService.confirmRegistrationVerification).toHaveBeenCalledWith(dto);
		});
	});

	describe('requestLoginVerification', () => {
		it('should delegate to service and return result', async () => {
			const dto = { phoneNumber: '+33612345678' };
			const req = { ip: '5.6.7.8' } as any;
			mockPhoneVerificationService.requestLoginVerification.mockResolvedValue({
				verificationId: 'vid-2',
			});

			const result = await controller.requestLoginVerification(dto, req);

			expect(result).toEqual({ verificationId: 'vid-2' });
			expect(mockPhoneVerificationService.requestLoginVerification).toHaveBeenCalledWith(
				dto,
				'5.6.7.8'
			);
		});
	});

	describe('confirmLoginVerification', () => {
		it('should delegate to service and return result', async () => {
			const dto = { verificationId: 'vid-2', code: '654321' };
			mockPhoneVerificationService.confirmLoginVerification.mockResolvedValue({
				verified: true,
				requires2FA: false,
			});

			const result = await controller.confirmLoginVerification(dto);

			expect(result).toEqual({ verified: true, requires2FA: false });
			expect(mockPhoneVerificationService.confirmLoginVerification).toHaveBeenCalledWith(dto);
		});
	});
});

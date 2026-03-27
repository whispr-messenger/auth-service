import { Test, TestingModule } from '@nestjs/testing';

import { VerificationCodeGeneratorService } from './verification-code-generator.service';

describe('VerificationCodeGeneratorService', () => {
	let service: VerificationCodeGeneratorService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [VerificationCodeGeneratorService],
		}).compile();

		service = module.get<VerificationCodeGeneratorService>(VerificationCodeGeneratorService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('generateCode', () => {
		it('should generate a 6-digit code by default', () => {
			const code = service.generateCode();
			expect(code).toMatch(/^\d{6}$/);
		});

		it('should generate a code of the specified length', () => {
			expect(service.generateCode(4)).toMatch(/^\d{4}$/);
			expect(service.generateCode(8)).toMatch(/^\d{8}$/);
		});

		it('should generate codes within the valid numeric range for length 6', () => {
			for (let i = 0; i < 20; i++) {
				const code = parseInt(service.generateCode(6), 10);
				expect(code).toBeGreaterThanOrEqual(100000);
				expect(code).toBeLessThanOrEqual(999999);
			}
		});
	});

	describe('hashCode', () => {
		it('should return a bcrypt hash', async () => {
			const hash = await service.hashCode('123456');
			expect(hash).toMatch(/^\$2[aby]\$/);
		});
	});

	describe('compareCode', () => {
		it('should return true when codes match', async () => {
			const code = '123456';
			const hash = await service.hashCode(code);
			expect(await service.compareCode(code, hash)).toBe(true);
		});

		it('should return false when codes do not match', async () => {
			const hash = await service.hashCode('123456');
			expect(await service.compareCode('654321', hash)).toBe(false);
		});
	});
});

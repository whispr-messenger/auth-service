import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PhoneNumberService } from './phone-number.service';

describe('PhoneNumberService', () => {
	let service: PhoneNumberService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PhoneNumberService],
		}).compile();

		service = module.get<PhoneNumberService>(PhoneNumberService);
	});

	describe('normalize', () => {
		it('should normalize a valid phone number to E.164 format', () => {
			const result = service.normalize('+33612345678');

			expect(result).toBe('+33612345678');
		});

		it('should normalize a phone number with spaces', () => {
			const result = service.normalize('+33 6 12 34 56 78');

			expect(result).toBe('+33612345678');
		});

		it('should throw BadRequestException for invalid phone number', () => {
			expect(() => service.normalize('not-a-phone')).toThrow(BadRequestException);
		});

		it('should throw BadRequestException for empty string', () => {
			expect(() => service.normalize('')).toThrow(BadRequestException);
		});
	});

	describe('validate', () => {
		it('should return true for a valid phone number', () => {
			expect(service.validate('+33612345678')).toBe(true);
		});

		it('should return false for an invalid phone number', () => {
			expect(service.validate('not-a-phone')).toBe(false);
		});

		it('should return false for an empty string', () => {
			expect(service.validate('')).toBe(false);
		});
	});

	describe('parse', () => {
		it('should return a PhoneNumber object for a valid number', () => {
			const result = service.parse('+33612345678');

			expect(result).toBeDefined();
			expect(result.isValid()).toBe(true);
		});

		it('should throw BadRequestException for an invalid phone number', () => {
			expect(() => service.parse('not-a-phone')).toThrow(BadRequestException);
		});
	});
});

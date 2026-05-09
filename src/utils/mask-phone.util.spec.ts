import { maskPhone } from './mask-phone.util';

describe('maskPhone', () => {
	it('masks a standard French E.164 number keeping prefix and last 4 digits', () => {
		expect(maskPhone('+33612345678')).toBe('+33***5678');
	});

	it('masks a US E.164 number', () => {
		expect(maskPhone('+14155551234')).toBe('+14***1234');
	});

	it('returns <empty> for empty string', () => {
		expect(maskPhone('')).toBe('<empty>');
	});

	it('returns <empty> for null', () => {
		expect(maskPhone(null)).toBe('<empty>');
	});

	it('returns <empty> for undefined', () => {
		expect(maskPhone(undefined)).toBe('<empty>');
	});

	it('returns *** for short input below masking threshold', () => {
		expect(maskPhone('+33612')).toBe('***');
	});

	it('does not leak middle digits of a long number', () => {
		const masked = maskPhone('+33698765432');
		expect(masked).not.toContain('98765');
		expect(masked).not.toContain('9876');
	});
});

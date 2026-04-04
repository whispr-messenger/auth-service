import { Test, TestingModule } from '@nestjs/testing';
import { DeviceFingerprintService } from './device-fingerprint.service';
import { Request } from 'express';

describe('DeviceFingerprintService', () => {
	let service: DeviceFingerprintService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [DeviceFingerprintService],
		}).compile();

		service = module.get<DeviceFingerprintService>(DeviceFingerprintService);
	});

	const buildRequest = (userAgent?: string, ip = '127.0.0.1'): Partial<Request> => ({
		headers: { 'user-agent': userAgent },
		ip,
	});

	describe('extractFingerprint', () => {
		it('should extract user agent and ip from request', () => {
			const req = buildRequest('Mozilla/5.0 (Linux; Android 10) Mobile');

			const result = service.extractFingerprint(req as Request);

			expect(result.userAgent).toBe('Mozilla/5.0 (Linux; Android 10) Mobile');
			expect(result.ipAddress).toBe('127.0.0.1');
			expect(result.timestamp).toBeLessThanOrEqual(Date.now());
		});

		it('should use provided deviceType over auto-detection', () => {
			const req = buildRequest('Mozilla/5.0');

			const result = service.extractFingerprint(req as Request, 'tablet');

			expect(result.deviceType).toBe('tablet');
		});

		it('should auto-detect mobile from user agent', () => {
			const req = buildRequest('Mozilla/5.0 (iPhone; CPU iPhone OS 14) Mobile');

			const result = service.extractFingerprint(req as Request);

			expect(result.deviceType).toBe('mobile');
		});

		it('should auto-detect tablet from user agent', () => {
			const req = buildRequest('Mozilla/5.0 (iPad; CPU OS 14) Tablet');

			const result = service.extractFingerprint(req as Request);

			expect(result.deviceType).toBe('tablet');
		});

		it('should return desktop when user agent has no mobile/tablet indicator', () => {
			const req = buildRequest('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

			const result = service.extractFingerprint(req as Request);

			expect(result.deviceType).toBe('desktop');
		});

		it('should return unknown when user agent is missing', () => {
			const req = buildRequest(undefined);

			const result = service.extractFingerprint(req as Request);

			expect(result.deviceType).toBe('unknown');
		});
	});
});

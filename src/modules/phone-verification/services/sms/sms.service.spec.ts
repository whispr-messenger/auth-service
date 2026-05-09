import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

describe('SmsService', () => {
	let service: SmsService;

	const buildModule = async (configValues: Record<string, string> = {}) => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SmsService,
				{
					provide: ConfigService,
					useValue: {
						get: jest.fn().mockImplementation((key: string) => configValues[key]),
					},
				},
			],
		}).compile();

		return module.get<SmsService>(SmsService);
	};

	beforeEach(async () => {
		service = await buildModule({ NODE_ENV: 'development' });
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('sendVerificationCode', () => {
		it('should log and return in demo mode without sending SMS', async () => {
			service = await buildModule({ DEMO_MODE: 'true', NODE_ENV: 'production' });

			await expect(
				service.sendVerificationCode('+33612345678', '123456', 'registration')
			).resolves.toBeUndefined();
		});

		it('should log and return in development mode without sending SMS', async () => {
			service = await buildModule({ NODE_ENV: 'development' });

			await expect(
				service.sendVerificationCode('+33612345678', '123456', 'login')
			).resolves.toBeUndefined();
		});

		it('should throw HttpException when Twilio fails in production', async () => {
			service = await buildModule({
				NODE_ENV: 'production',
				TWILIO_ACCOUNT_SID: 'AC123',
				TWILIO_AUTH_TOKEN: 'token',
				TWILIO_FROM_NUMBER: '+1234567890',
			});

			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: false,
				text: jest.fn().mockResolvedValue('error'),
			} as any);

			const promise = service.sendVerificationCode('+33612345678', '123456', 'registration');

			await expect(promise).rejects.toThrow(HttpException);
			await expect(promise).rejects.toThrow("Erreur lors de l'envoi du SMS");

			await expect(promise).rejects.toMatchObject({
				status: HttpStatus.INTERNAL_SERVER_ERROR,
			});
		});

		it('should succeed when Twilio responds ok in production', async () => {
			service = await buildModule({
				NODE_ENV: 'production',
				TWILIO_ACCOUNT_SID: 'AC123',
				TWILIO_AUTH_TOKEN: 'token',
				TWILIO_FROM_NUMBER: '+1234567890',
			});

			jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as any);

			await expect(
				service.sendVerificationCode('+33612345678', '123456', 'registration')
			).resolves.toBeUndefined();
		});
	});

	describe('sendSecurityAlert', () => {
		it('should log and return in development mode', async () => {
			service = await buildModule({ NODE_ENV: 'development' });

			await expect(service.sendSecurityAlert('+33612345678', 'new_device')).resolves.toBeUndefined();
		});

		it('should not throw when Twilio fails (security alerts are non-critical)', async () => {
			service = await buildModule({
				NODE_ENV: 'production',
				TWILIO_ACCOUNT_SID: 'AC123',
				TWILIO_AUTH_TOKEN: 'token',
				TWILIO_FROM_NUMBER: '+1234567890',
			});

			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: false,
				text: jest.fn().mockResolvedValue('error'),
			} as any);

			await expect(
				service.sendSecurityAlert('+33612345678', 'suspicious_login')
			).resolves.toBeUndefined();
		});

		it('should handle all alert types', async () => {
			service = await buildModule({ NODE_ENV: 'development' });

			for (const alertType of ['new_device', 'suspicious_login', 'password_change'] as const) {
				await expect(service.sendSecurityAlert('+33612345678', alertType)).resolves.toBeUndefined();
			}
		});
	});

	describe('buildMessage (via sendVerificationCode prod path)', () => {
		// WHISPR-1372: les logs ne contiennent plus le message en clair (OTP redacted),
		// donc on verifie le contenu du message via le body envoye a Twilio en prod.
		const setupProdAndCaptureBody = async (): Promise<URLSearchParams> => {
			service = await buildModule({
				NODE_ENV: 'production',
				TWILIO_ACCOUNT_SID: 'AC123',
				TWILIO_AUTH_TOKEN: 'token',
				TWILIO_FROM_NUMBER: '+1234567890',
			});
			let captured: URLSearchParams = new URLSearchParams();
			jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
				captured = init?.body as URLSearchParams;
				return { ok: true } as any;
			});
			return captured;
		};

		it('should use correct purpose text for registration', async () => {
			await setupProdAndCaptureBody();
			const fetchSpy = globalThis.fetch as jest.Mock;

			await service.sendVerificationCode('+33612345678', '123456', 'registration');

			const body = fetchSpy.mock.calls[0][1].body as URLSearchParams;
			expect(body.get('Body')).toContain('inscription');
		});

		it('should use correct purpose text for login', async () => {
			await setupProdAndCaptureBody();
			const fetchSpy = globalThis.fetch as jest.Mock;

			await service.sendVerificationCode('+33612345678', '123456', 'login');

			const body = fetchSpy.mock.calls[0][1].body as URLSearchParams;
			expect(body.get('Body')).toContain('connexion');
		});

		it('should fall back to vérification for unknown purpose', async () => {
			await setupProdAndCaptureBody();
			const fetchSpy = globalThis.fetch as jest.Mock;

			await service.sendVerificationCode('+33612345678', '123456', 'unknown');

			const body = fetchSpy.mock.calls[0][1].body as URLSearchParams;
			expect(body.get('Body')).toContain('vérification');
		});
	});

	describe('phone masking in logs (WHISPR-1372)', () => {
		it('should NEVER log the OTP code in dev mode', async () => {
			service = await buildModule({ NODE_ENV: 'development' });
			const logSpy = jest.spyOn(service['logger'], 'log');

			await service.sendVerificationCode('+33612345678', '987654', 'registration');

			const calls = logSpy.mock.calls.flat().join(' ');
			expect(calls).not.toContain('987654');
			expect(calls).toContain('[OTP redacted]');
		});

		it('should mask the phone number in dev logs', async () => {
			service = await buildModule({ NODE_ENV: 'development' });
			const logSpy = jest.spyOn(service['logger'], 'log');

			await service.sendVerificationCode('+33612345678', '123456', 'login');

			const calls = logSpy.mock.calls.flat().join(' ');
			expect(calls).toContain('+33***5678');
			expect(calls).not.toContain('+33612345678');
		});
	});
});

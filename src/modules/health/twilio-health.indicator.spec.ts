import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TwilioHealthIndicator } from './twilio-health.indicator';

const buildIndicator = async (configValues: Record<string, string> = {}) => {
	const module: TestingModule = await Test.createTestingModule({
		providers: [
			TwilioHealthIndicator,
			{
				provide: ConfigService,
				useValue: {
					get: jest.fn().mockImplementation((key: string) => configValues[key]),
				},
			},
		],
	}).compile();

	return module.get<TwilioHealthIndicator>(TwilioHealthIndicator);
};

const productionConfig = {
	NODE_ENV: 'production',
	TWILIO_ACCOUNT_SID: 'ACtest123',
	TWILIO_AUTH_TOKEN: 'authtoken456',
};

describe('TwilioHealthIndicator', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should be defined', async () => {
		const indicator = await buildIndicator();
		expect(indicator).toBeDefined();
	});

	describe('check() — non-production', () => {
		it('should skip the check when NODE_ENV is not production', async () => {
			const indicator = await buildIndicator({ NODE_ENV: 'development' });
			const result = await indicator.check();
			expect(result).toEqual({ status: 'skipped' });
		});

		it('should skip the check when NODE_ENV is test', async () => {
			const indicator = await buildIndicator({ NODE_ENV: 'test' });
			const result = await indicator.check();
			expect(result).toEqual({ status: 'skipped' });
		});
	});

	describe('check() — production, missing credentials', () => {
		it('should return unhealthy when TWILIO_ACCOUNT_SID is missing', async () => {
			const indicator = await buildIndicator({
				NODE_ENV: 'production',
				TWILIO_AUTH_TOKEN: 'token',
			});

			const result = await indicator.check();
			expect(result.status).toBe('unhealthy');
			expect(result.message).toContain('not configured');
		});

		it('should return unhealthy when TWILIO_AUTH_TOKEN is missing', async () => {
			const indicator = await buildIndicator({
				NODE_ENV: 'production',
				TWILIO_ACCOUNT_SID: 'ACtest',
			});

			const result = await indicator.check();
			expect(result.status).toBe('unhealthy');
			expect(result.message).toContain('not configured');
		});
	});

	describe('check() — production, with credentials', () => {
		it('should return healthy when Twilio responds 200', async () => {
			const indicator = await buildIndicator(productionConfig);

			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				status: 200,
			} as Response);

			const result = await indicator.check();
			expect(result).toEqual({ status: 'healthy' });
		});

		it('should return unhealthy when Twilio responds 401 (invalid credentials)', async () => {
			const indicator = await buildIndicator(productionConfig);

			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: false,
				status: 401,
			} as Response);

			const result = await indicator.check();
			expect(result.status).toBe('unhealthy');
			expect(result.message).toContain('401');
		});

		it('should return unhealthy when Twilio responds 403 (suspended account)', async () => {
			const indicator = await buildIndicator(productionConfig);

			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: false,
				status: 403,
			} as Response);

			const result = await indicator.check();
			expect(result.status).toBe('unhealthy');
			expect(result.message).toContain('403');
		});

		it('should return unhealthy for unexpected non-ok HTTP status', async () => {
			const indicator = await buildIndicator(productionConfig);

			jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: false,
				status: 500,
			} as Response);

			const result = await indicator.check();
			expect(result.status).toBe('unhealthy');
			expect(result.message).toContain('500');
		});

		it('should return timeout when fetch is aborted (Twilio unreachable)', async () => {
			const indicator = await buildIndicator(productionConfig);

			jest.spyOn(globalThis, 'fetch').mockRejectedValue(
				Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
			);

			const result = await indicator.check();
			expect(result.status).toBe('timeout');
			expect(result.message).toContain('timeout');
		});

		it('should return unhealthy on unexpected network error', async () => {
			const indicator = await buildIndicator(productionConfig);

			jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'));

			const result = await indicator.check();
			expect(result.status).toBe('unhealthy');
			expect(result.message).toBe('Network failure');
		});

		it('should call the correct Twilio endpoint with Basic Auth header', async () => {
			const indicator = await buildIndicator(productionConfig);

			const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
				status: 200,
			} as Response);

			await indicator.check();

			expect(fetchSpy).toHaveBeenCalledWith(
				`https://api.twilio.com/2010-04-01/Accounts/${productionConfig.TWILIO_ACCOUNT_SID}.json`,
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						Authorization: `Basic ${Buffer.from(`${productionConfig.TWILIO_ACCOUNT_SID}:${productionConfig.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
					}),
				})
			);
		});
	});
});

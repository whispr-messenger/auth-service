import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type TwilioHealthStatus = 'healthy' | 'unhealthy' | 'timeout' | 'skipped';

export interface TwilioHealthResult {
	status: TwilioHealthStatus;
	message?: string;
}

const TWILIO_HEALTH_TIMEOUT_MS = 5000;

@Injectable()
export class TwilioHealthIndicator {
	private readonly logger = new Logger(TwilioHealthIndicator.name);
	private readonly accountSid: string;
	private readonly authToken: string;
	private readonly isProduction: boolean;

	constructor(private readonly configService: ConfigService) {
		this.accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID') || '';
		this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN') || '';
		this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
	}

	async check(): Promise<TwilioHealthResult> {
		if (!this.isProduction) {
			return { status: 'skipped' };
		}

		if (!this.accountSid || !this.authToken) {
			this.logger.warn('Twilio credentials are missing (TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN)');
			return { status: 'unhealthy', message: 'Twilio credentials not configured' };
		}

		const controller = new AbortController();
		const timeoutId = globalThis.setTimeout(() => controller.abort(), TWILIO_HEALTH_TIMEOUT_MS);

		try {
			const response = await fetch(
				`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}.json`,
				{
					method: 'GET',
					headers: {
						Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
					},
					signal: controller.signal,
				}
			);

			if (response.ok) {
				return { status: 'healthy' };
			}

			if (response.status === 401 || response.status === 403) {
				this.logger.warn(
					`Twilio authentication failed (HTTP ${response.status}): invalid credentials or suspended account`
				);
				return { status: 'unhealthy', message: `Twilio auth failed: HTTP ${response.status}` };
			}

			this.logger.warn(`Twilio health check returned unexpected status: HTTP ${response.status}`);
			return { status: 'unhealthy', message: `Twilio returned HTTP ${response.status}` };
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				this.logger.warn(
					'Twilio health check timed out — marking as timeout (not permanently unhealthy)'
				);
				return { status: 'timeout', message: 'Twilio unreachable (timeout)' };
			}

			this.logger.warn(`Twilio health check failed with error: ${(error as Error).message}`);
			return { status: 'unhealthy', message: (error as Error).message };
		} finally {
			globalThis.clearTimeout(timeoutId);
		}
	}
}

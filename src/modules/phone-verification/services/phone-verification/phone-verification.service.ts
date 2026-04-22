import {
	BadRequestException,
	ConflictException,
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import {
	VerificationRequestDto,
	VerificationConfirmDto,
	VerificationRequestResponseDto,
	VerificationConfirmResponseDto,
	VerificationLoginResponseDto,
} from '../../dto';
import { UserAuthService } from '../../../common/services/user-auth.service';
import { VerificationCodeGeneratorService } from '../verification-code-generator/verification-code-generator.service';
import { PhoneNumberService } from '../phone-number/phone-number.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import type { VerificationRepository } from '../../repositories/verification.repository';
import type { VerificationChannelStrategy } from '../../strategies/verification-channel.strategy';
import { VerificationPurpose, VerificationCode, VerificationCreationResult } from '../../types';

/**
 * Service responsible for phone verification workflow orchestration.
 * Uses injected dependencies to handle verification requests, code validation,
 * and user authentication flows.
 */
@Injectable()
export class PhoneVerificationService {
	private readonly logger = new Logger(PhoneVerificationService.name);
	private readonly isDemoMode: boolean;
	private readonly exposeDemoOtp: boolean;
	private readonly otpBypassCode: string | undefined;
	private readonly VERIFICATION_TTL_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
	private readonly POST_CONFIRM_TTL_MS = 60 * 1000; // 60 seconds post-confirm in milliseconds
	private readonly MAX_ATTEMPTS = 5;
	// WHISPR-866: rate-limit thresholds are tunable via env vars so we can loosen
	// them for QA/staging and tighten them for production without a code change.
	private readonly RATE_LIMIT_TTL_SECONDS = 60 * 60; // 1 hour in seconds
	private readonly MAX_REQUESTS_PER_HOUR: number;
	// WHISPR-762: tighter sliding window to mitigate OTP flooding/impersonation probes.
	// WHISPR-866: phone-scoped short window maps to SMS_RATE_LIMIT_PER_MINUTE.
	private readonly SHORT_WINDOW_TTL_SECONDS = 60; // 1 minute
	private readonly MAX_REQUESTS_PER_SHORT_WINDOW_PHONE: number;
	private readonly MAX_REQUESTS_PER_SHORT_WINDOW_IP = 10;

	constructor(
		@Inject('VerificationRepository') private readonly verificationRepo: VerificationRepository,
		private readonly codeGenerator: VerificationCodeGeneratorService,
		private readonly phoneService: PhoneNumberService,
		private readonly rateLimitService: RateLimitService,
		@Inject('VerificationChannelStrategy')
		private readonly verificationChannel: VerificationChannelStrategy,
		private readonly configService: ConfigService,
		private readonly userAuthService: UserAuthService
	) {
		this.isDemoMode = this.configService.get<string>('DEMO_MODE') === 'true';
		this.otpBypassCode = this.configService.get<string>('OTP_BYPASS_CODE');

		// WHISPR-1117: the demo OTP must NEVER be returned in responses on prod,
		// regardless of DEMO_MODE. Allow explicit override via EXPOSE_DEMO_OTP
		// for tightly-controlled staging/QA scenarios, but default to hiding.
		const nodeEnv = this.configService.get<string>('NODE_ENV');
		const exposeFlag = this.configService.get<string>('EXPOSE_DEMO_OTP') === 'true';
		this.exposeDemoOtp = nodeEnv !== 'production' || exposeFlag;

		// WHISPR-866: thresholds read from env with sensible prod defaults.
		this.MAX_REQUESTS_PER_HOUR = this.readPositiveInt('SMS_RATE_LIMIT_PER_HOUR', 20);
		this.MAX_REQUESTS_PER_SHORT_WINDOW_PHONE = this.readPositiveInt('SMS_RATE_LIMIT_PER_MINUTE', 5);

		if (this.otpBypassCode) {
			this.logger.warn(
				'OTP_BYPASS_CODE is set — OTP bypass mode is active. SMS sending is disabled and the bypass code will be accepted for any phone number. Do NOT use this in production.'
			);
		}
	}

	/**
	 * Reads a positive integer env var via ConfigService, falling back to the
	 * provided default when unset or when the value is not a strictly positive
	 * integer. Guards against misconfigurations that would accidentally disable
	 * the rate limiter (e.g. `SMS_RATE_LIMIT_PER_HOUR=0`).
	 */
	private readPositiveInt(key: string, defaultValue: number): number {
		const raw = this.configService.get<string>(key);
		if (raw === undefined || raw === null || raw === '') {
			return defaultValue;
		}
		const parsed = Number.parseInt(String(raw), 10);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			this.logger.warn(
				`[WHISPR-866] Invalid value for ${key} ("${raw}") — falling back to default ${defaultValue}.`
			);
			return defaultValue;
		}
		return parsed;
	}

	/**
	 * Requests a verification code for a phone number.
	 * @param phoneNumber - The phone number to verify
	 * @param purpose - The purpose of the verification (registration or login)
	 * @returns The verification ID and optionally the code (in demo mode)
	 */
	private async requestVerification(
		phoneNumber: string,
		purpose: VerificationPurpose,
		deviceId?: string,
		ipAddress?: string
	): Promise<VerificationRequestResponseDto> {
		const normalizedPhone = this.phoneService.normalize(phoneNumber);

		await this.checkRateLimit(normalizedPhone);
		await this.checkShortWindowRateLimit(normalizedPhone, ipAddress);

		const { verificationId, code, verificationData } = await this.createVerificationData(
			normalizedPhone,
			purpose,
			deviceId
		);

		await this.verificationRepo.save(verificationId, verificationData, this.VERIFICATION_TTL_MS);

		await this.incrementRateLimit(normalizedPhone);
		await this.incrementShortWindowRateLimit(normalizedPhone, ipAddress);

		await this.sendVerificationCode(normalizedPhone, code, purpose);

		return this.buildVerificationResponse(verificationId, code);
	}

	/**
	 * WHISPR-762 — short-window rate limits to mitigate OTP flooding and
	 * impersonation probing. Separate counters for phone and IP so one actor
	 * cannot cycle numbers nor cycle IPs to exhaust a single phone.
	 */
	private async checkShortWindowRateLimit(phoneNumber: string, ipAddress?: string): Promise<void> {
		await this.rateLimitService.checkLimit(
			`rate_limit:short:phone:${phoneNumber}`,
			this.MAX_REQUESTS_PER_SHORT_WINDOW_PHONE,
			this.SHORT_WINDOW_TTL_SECONDS,
			'Too many verification code requests for this phone number'
		);

		if (ipAddress) {
			await this.rateLimitService.checkLimit(
				`rate_limit:short:ip:${ipAddress}`,
				this.MAX_REQUESTS_PER_SHORT_WINDOW_IP,
				this.SHORT_WINDOW_TTL_SECONDS,
				'Too many verification code requests from this IP'
			);
		}
	}

	private async incrementShortWindowRateLimit(phoneNumber: string, ipAddress?: string): Promise<void> {
		await this.rateLimitService.increment(
			`rate_limit:short:phone:${phoneNumber}`,
			this.SHORT_WINDOW_TTL_SECONDS
		);
		if (ipAddress) {
			await this.rateLimitService.increment(
				`rate_limit:short:ip:${ipAddress}`,
				this.SHORT_WINDOW_TTL_SECONDS
			);
		}
	}

	/**
	 * Checks if the phone number has exceeded the rate limit.
	 * @param phoneNumber - The normalized phone number
	 * @throws HttpException if rate limit is exceeded
	 */
	private async checkRateLimit(phoneNumber: string): Promise<void> {
		const key = `rate_limit:${phoneNumber}`;
		const errorMessage = 'Too many verification code requests';

		await this.rateLimitService.checkLimit(
			key,
			this.MAX_REQUESTS_PER_HOUR,
			this.RATE_LIMIT_TTL_SECONDS,
			errorMessage
		);
	}

	/**
	 * Increments the rate limit counter for the phone number.
	 * @param phoneNumber - The normalized phone number
	 */
	private async incrementRateLimit(phoneNumber: string): Promise<void> {
		const key = `rate_limit:${phoneNumber}`;
		await this.rateLimitService.increment(key, this.RATE_LIMIT_TTL_SECONDS);
	}

	/**
	 * Creates verification data with a new ID and hashed code.
	 * @param phoneNumber - The normalized phone number
	 * @param purpose - The purpose of the verification
	 * @returns Object containing verification ID, plain code, and verification data
	 */
	private async createVerificationData(
		phoneNumber: string,
		purpose: VerificationPurpose,
		deviceId?: string
	): Promise<VerificationCreationResult> {
		const verificationId = uuidv4();
		const code = this.codeGenerator.generateCode();
		const hashedCode = await this.codeGenerator.hashCode(code);
		const expirationTime = Date.now() + this.VERIFICATION_TTL_MS;

		const verificationData: VerificationCode = {
			phoneNumber,
			hashedCode,
			purpose,
			attempts: 0,
			expiresAt: expirationTime,
			...(deviceId ? { deviceId } : {}),
		};

		return { verificationId, code, verificationData };
	}

	/**
	 * Sends the verification code through the configured channel.
	 * Logs errors but doesn't throw to allow the verification process to continue.
	 * @param phoneNumber - The phone number to send to
	 * @param code - The verification code
	 * @param purpose - The purpose of the verification
	 */
	private async sendVerificationCode(
		phoneNumber: string,
		code: string,
		purpose: VerificationPurpose
	): Promise<void> {
		if (this.otpBypassCode) {
			this.logger.warn(`[OTP BYPASS] Skipping SMS for ${phoneNumber} — bypass mode is active.`);
			return;
		}

		try {
			await this.verificationChannel.sendVerification(phoneNumber, code, purpose);
		} catch (error) {
			if (process.env.NODE_ENV !== 'test') {
				this.logger.error('Failed to send verification code:', error);
				this.logger.log(`Verification code for ${phoneNumber}: ${code}`);
			}
		}
	}

	/**
	 * Builds the verification response based on demo mode configuration.
	 * @param verificationId - The verification ID
	 * @param code - The verification code
	 * @returns Response with ID and optionally the code
	 */
	private buildVerificationResponse(verificationId: string, code: string): VerificationRequestResponseDto {
		if (this.isDemoMode && this.exposeDemoOtp) {
			// When a bypass code is configured, surface that predictable value in
			// demo responses instead of the randomly generated one. Both codes are
			// accepted by verifyCode, but users remembering "123456" across sessions
			// get a smoother QA experience than chasing a fresh random every time.
			const exposedCode = this.otpBypassCode ?? code;
			this.logger.debug('Demo mode is activated: sending verification code in response payload.');
			return { verificationId, code: exposedCode };
		}

		if (this.isDemoMode && !this.exposeDemoOtp) {
			// WHISPR-1117: demo mode still short-circuits the SMS provider, but we
			// refuse to leak the plaintext OTP in the HTTP response on production
			// unless the operator explicitly opts in via EXPOSE_DEMO_OTP=true.
			this.logger.warn(
				'[WHISPR-1117] Demo mode is active but EXPOSE_DEMO_OTP is not set in production — withholding OTP from response.'
			);
		}

		return { verificationId };
	}

	/**
	 * Verifies a code against a verification ID.
	 * @param verificationId - The verification ID
	 * @param code - The code to verify (empty string to just retrieve verified data)
	 * @returns The verification data
	 * @throws BadRequestException if code is invalid or verification not found
	 * @throws HttpException with TOO_MANY_REQUESTS if max attempts exceeded
	 */
	public async verifyCode(
		verificationId: string,
		code: string,
		deviceId?: string
	): Promise<VerificationCode> {
		const verificationData = await this.verificationRepo.findById(verificationId);

		if (!verificationData) {
			throw new BadRequestException('Invalid or expired verification code');
		}

		this.assertDeviceBinding(verificationData, deviceId);

		if (verificationData.verified) {
			if (code === '') {
				return verificationData;
			}
			throw new BadRequestException('Verification code has already been confirmed');
		}

		if (verificationData.attempts >= this.MAX_ATTEMPTS) {
			await this.verificationRepo.delete(verificationId);
			throw new HttpException('Too many verification attempts', HttpStatus.TOO_MANY_REQUESTS);
		}

		if (this.otpBypassCode && code === this.otpBypassCode) {
			this.logger.warn(`[OTP BYPASS] Bypass code accepted for verification ${verificationId}.`);
			return verificationData;
		}

		const isValid = await this.codeGenerator.compareCode(code, verificationData.hashedCode);

		if (!isValid) {
			verificationData.attempts++;
			await this.verificationRepo.update(
				verificationId,
				verificationData,
				Math.ceil(verificationData.expiresAt - Date.now())
			);
			throw new BadRequestException('Incorrect verification code');
		}

		return verificationData;
	}

	/**
	 * Marks a verification as confirmed and updates it in storage.
	 * @param verificationId - The verification ID
	 * @param verificationData - The verification data to mark as verified
	 */
	private async markVerificationAsConfirmed(
		verificationId: string,
		verificationData: VerificationCode
	): Promise<void> {
		const remainingMs = verificationData.expiresAt - Date.now();
		if (remainingMs <= 0) {
			await this.verificationRepo.delete(verificationId);
			throw new BadRequestException('Invalid or expired verification code');
		}
		verificationData.verified = true;
		await this.verificationRepo.update(
			verificationId,
			verificationData,
			Math.min(this.POST_CONFIRM_TTL_MS, remainingMs)
		);
	}

	/**
	 * Retrieves a confirmed verification data.
	 * @param verificationId - The verification ID
	 * @returns The verification data if it has been confirmed
	 * @throws BadRequestException if verification not found or not confirmed
	 */
	public async getConfirmedVerification(
		verificationId: string,
		deviceId?: string
	): Promise<VerificationCode> {
		const verificationData = await this.verificationRepo.findById(verificationId);

		if (!verificationData) {
			throw new BadRequestException('Invalid or expired verification code');
		}

		this.assertDeviceBinding(verificationData, deviceId);

		if (!verificationData.verified) {
			throw new BadRequestException('Verification code has not been confirmed yet');
		}

		return verificationData;
	}

	/**
	 * WHISPR-762 — enforce that if an OTP session was bound to a deviceId at
	 * send time, all subsequent operations (confirm, consume) MUST present the
	 * same deviceId. Prevents an attacker from verifying/consuming an OTP sent
	 * to a victim's phone from a different device.
	 *
	 * Backward compatibility: sessions created before the binding rollout (no
	 * deviceId stored) remain usable from any device. New clients that send a
	 * deviceId on request get hard binding.
	 */
	private assertDeviceBinding(verificationData: VerificationCode, providedDeviceId?: string): void {
		if (!verificationData.deviceId) {
			return;
		}
		if (!providedDeviceId || providedDeviceId !== verificationData.deviceId) {
			this.logger.warn(
				`[WHISPR-762] OTP device binding mismatch — sessionDeviceId=${verificationData.deviceId} requestDeviceId=${providedDeviceId ?? 'none'}`
			);
			throw new BadRequestException('Invalid or expired verification code');
		}
	}

	/**
	 * Consumes a verification, deleting it from storage.
	 * @param verificationId - The verification ID to consume
	 */
	public async consumeVerification(verificationId: string): Promise<void> {
		await this.verificationRepo.delete(verificationId);
	}

	/**
	 * Requests a verification code for user registration.
	 * @param dto - The verification request data
	 * @returns The verification ID and optionally the code (in demo mode)
	 * @throws ConflictException if user already exists
	 */
	public async requestRegistrationVerification(
		dto: VerificationRequestDto,
		ipAddress?: string
	): Promise<VerificationRequestResponseDto> {
		// First check: fast-fail before issuing an OTP to a phone that already has an account.
		// A second check is intentionally performed at register() time (TOCTOU protection): the
		// number could be registered by another request during the ~15-minute verification window.
		const existingUser = await this.userAuthService.findByPhoneNumber(dto.phoneNumber);

		if (existingUser) {
			throw new ConflictException('An account with this phone number already exists.');
		}

		return this.requestVerification(dto.phoneNumber, 'registration', dto.deviceId, ipAddress);
	}

	/**
	 * Confirms a registration verification code.
	 * @param dto - The verification confirmation data
	 * @returns Object indicating verification success
	 */
	public async confirmRegistrationVerification(
		dto: VerificationConfirmDto
	): Promise<VerificationConfirmResponseDto> {
		const verificationData = await this.verifyCode(dto.verificationId, dto.code, dto.deviceId);
		await this.markVerificationAsConfirmed(dto.verificationId, verificationData);
		return { verified: true };
	}

	/**
	 * Requests a verification code for user login.
	 * @param dto - The verification request data
	 * @returns The verification ID and optionally the code (in demo mode)
	 * @throws BadRequestException if user doesn't exist
	 */
	public async requestLoginVerification(
		dto: VerificationRequestDto,
		ipAddress?: string
	): Promise<VerificationRequestResponseDto> {
		const user = await this.userAuthService.findByPhoneNumber(dto.phoneNumber);

		if (!user) {
			throw new BadRequestException('No account found with this phone number');
		}

		return this.requestVerification(dto.phoneNumber, 'login', dto.deviceId, ipAddress);
	}

	/**
	 * Confirms a login verification code.
	 * @param dto - The verification confirmation data
	 * @returns Object indicating verification success and whether 2FA is required
	 */
	public async confirmLoginVerification(
		dto: VerificationConfirmDto
	): Promise<VerificationLoginResponseDto> {
		const verificationData = await this.verifyCode(dto.verificationId, dto.code, dto.deviceId);
		await this.markVerificationAsConfirmed(dto.verificationId, verificationData);

		const user = await this.userAuthService.findByPhoneNumber(verificationData.phoneNumber);

		if (!user) {
			throw new BadRequestException('User not found');
		}

		return { verified: true, requires2FA: user.twoFactorEnabled };
	}
}

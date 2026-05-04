import { VerificationPurpose } from './verification-purpose.type';

export interface VerificationCode {
	phoneNumber: string;
	hashedCode: string;
	purpose: VerificationPurpose;
	attempts: number;
	expiresAt: number;
	verified?: boolean;
	/**
	 * Client-generated stable UUID of the device that requested the OTP.
	 * When present, verify/confirm operations MUST be performed by the same
	 * deviceId — prevents OTP impersonation where an attacker tries to confirm
	 * a code sent to a victim's phone on a different device (WHISPR-762).
	 */
	deviceId?: string;
}

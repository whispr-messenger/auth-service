export class QrAuthResponseDto {
	sessionId: string;
	qrCode: string;
	expiresAt: Date;
	message: string;
}

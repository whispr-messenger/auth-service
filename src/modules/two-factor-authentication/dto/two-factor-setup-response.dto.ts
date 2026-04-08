import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorSetupResponseDto {
	@ApiProperty({
		description: 'TOTP secret key in base32 encoding for manual entry',
		example: 'JBSWY3DPEHPK3PXP',
	})
	secret: string;

	@ApiProperty({
		description: 'otpauth:// URI for generating a QR code client-side',
		example: 'otpauth://totp/Whispr?secret=JBSWY3DPEHPK3PXP&issuer=Whispr',
	})
	otpauthUri: string;

	@ApiProperty({
		description: 'QR code as a base64-encoded PNG data URL',
		example: 'data:image/png;base64,iVBORw0KGgo...',
	})
	qrCodeUrl: string;
}

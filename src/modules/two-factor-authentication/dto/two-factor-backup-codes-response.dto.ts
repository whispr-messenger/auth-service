import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorBackupCodesResponseDto {
	@ApiProperty({
		description: 'One-time backup codes to use if the TOTP device is unavailable',
		example: ['ABCD-1234', 'WXYZ-5678'],
		type: [String],
	})
	backupCodes: string[];
}

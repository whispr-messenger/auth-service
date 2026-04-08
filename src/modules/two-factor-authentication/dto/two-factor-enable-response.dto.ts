import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorEnableResponseDto {
	@ApiProperty({
		description: 'One-time backup codes to use if the TOTP device is unavailable',
		example: ['a1b2c3d4', 'e5f6g7h8'],
		type: [String],
	})
	backupCodes: string[];
}

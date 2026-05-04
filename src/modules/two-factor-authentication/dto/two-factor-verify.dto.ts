import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class TwoFactorVerifyDto {
	@ApiProperty({
		description:
			'6-digit TOTP token from the authenticator app, or a backup code (format XXXX-XXXX). Used by verify/disable/backup-codes endpoints so both shapes must be accepted.',
		example: '123456',
		minLength: 6,
		maxLength: 20,
		type: String,
	})
	@IsString()
	@Length(6, 20)
	token: string;
}

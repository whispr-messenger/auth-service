import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class TwoFactorSetupDto {
	@ApiProperty({
		description: 'TOTP secret for setting up two-factor authentication',
		example: 'JBSWY3DPEHPK3PXP',
		type: String,
	})
	@IsString()
	secret: string;

	@ApiProperty({
		description: '6-digit verification token to confirm TOTP setup',
		example: '123456',
		minLength: 6,
		maxLength: 6,
		type: String,
	})
	@IsString()
	@Length(6, 6)
	token: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class TwoFactorSetupDto {
	@ApiProperty({
		description: '6-digit TOTP token from authenticator app',
		example: '123456',
		minLength: 6,
		maxLength: 6,
		type: String,
	})
	@IsString()
	@Length(6, 6)
	@Matches(/^\d{6}$/, { message: 'token must be exactly 6 digits' })
	token: string;
}

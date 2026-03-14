import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class TwoFactorVerifyDto {
	@ApiProperty({
		description: '6-digit TOTP token from authenticator app',
		example: '123456',
		minLength: 6,
		maxLength: 6,
		type: String,
	})
	@IsString()
	@Length(6, 6)
	token: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class TwoFactorSetupDto {
	@ApiProperty({
		description: 'TOTP secret returned by the setup endpoint',
		example: 'JBSWY3DPEHPK3PXP',
		type: String,
	})
	@IsString()
	secret: string;

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

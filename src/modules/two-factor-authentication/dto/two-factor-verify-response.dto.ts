import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorVerifyResponseDto {
	@ApiProperty({
		description: 'Whether the submitted TOTP token is valid for the authenticated user',
		example: true,
	})
	valid: boolean;
}

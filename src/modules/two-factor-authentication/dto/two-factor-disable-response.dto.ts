import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorDisableResponseDto {
	@ApiProperty({
		description: 'Confirms that 2FA has been disabled for the authenticated user',
		example: true,
	})
	disabled: boolean;
}

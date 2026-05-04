import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorStatusResponseDto {
	@ApiProperty({
		description: 'Whether 2FA is currently enabled on the authenticated user account',
		example: true,
	})
	enabled: boolean;
}

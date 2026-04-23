import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenResponseDto {
	@ApiProperty({
		description: 'Newly issued JWT access token',
		example: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...',
	})
	accessToken: string;

	@ApiProperty({
		description: 'Newly issued JWT refresh token (replaces the one used in the request)',
		example: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...',
	})
	refreshToken: string;

	@ApiProperty({
		description: 'ID of the authenticated user',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	userId: string;

	@ApiProperty({
		description: 'ID of the device bound to the returned tokens',
		example: '550e8400-e29b-41d4-a716-446655440001',
	})
	deviceId: string;
}

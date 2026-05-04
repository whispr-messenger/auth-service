import { ApiProperty } from '@nestjs/swagger';

export class ScanLoginResponseDto {
	@ApiProperty({
		description: 'JWT access token for the newly authenticated session',
		example: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...',
	})
	accessToken: string;

	@ApiProperty({
		description: 'JWT refresh token for obtaining new access tokens',
		example: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...',
	})
	refreshToken: string;

	@ApiProperty({
		description: 'ID of the authenticated user',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	userId: string;

	@ApiProperty({
		description: 'ID of the device that completed the QR login (the scanning device)',
		example: '550e8400-e29b-41d4-a716-446655440001',
	})
	deviceId: string;
}

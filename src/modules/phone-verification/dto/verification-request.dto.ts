import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsPhoneNumber, IsString } from 'class-validator';

export class VerificationRequestDto {
	@ApiProperty({
		description: 'Phone number in E.164 format',
		example: '+33612345678',
	})
	@IsPhoneNumber()
	phoneNumber: string;

	@ApiPropertyOptional({
		description:
			'Client-generated stable UUID identifying the device requesting the OTP. When provided, the OTP is bound to this device and can only be confirmed/consumed by the same deviceId (WHISPR-762).',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsOptional()
	@IsString()
	deviceId?: string;
}

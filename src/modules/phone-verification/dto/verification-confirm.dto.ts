import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, Length } from 'class-validator';

export class VerificationConfirmDto {
	@ApiProperty({
		description: 'UUID of the verification request',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID()
	verificationId: string;

	@ApiProperty({
		description: '6-digit verification code sent by SMS',
		example: '123456',
	})
	@IsString()
	@Length(6, 6)
	code: string;
}

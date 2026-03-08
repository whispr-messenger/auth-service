import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber } from 'class-validator';

export class VerificationRequestDto {
	@ApiProperty({
		description: 'Phone number in E.164 format',
		example: '+33612345678',
	})
	@IsPhoneNumber()
	phoneNumber: string;
}

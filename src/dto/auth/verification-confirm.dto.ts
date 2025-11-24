import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length } from 'class-validator';

export class VerificationConfirmDto {
  @ApiProperty({
    description: 'Verification ID (UUID) for the verification flow',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @IsUUID()
  verificationId: string;

  @ApiProperty({
    description: '6-digit verification code sent to the phone',
    example: '123456',
    minLength: 6,
    maxLength: 6,
    type: String,
  })
  @IsString()
  @Length(6, 6)
  code: string;
}

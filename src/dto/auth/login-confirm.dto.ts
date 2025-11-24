import { IsString, IsNotEmpty, Length, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginConfirmDto {
  @ApiProperty({
    description: 'Verification ID (UUID v4) for the login flow',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @IsNotEmpty()
  @IsUUID(4, { message: 'Verification ID must be a valid UUID' })
  verificationId: string;

  @ApiProperty({
    description: '6-digit verification code sent to the user',
    example: '123456',
    minLength: 6,
    maxLength: 6,
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  @Transform(({ value }) => value?.trim())
  code: string;
}

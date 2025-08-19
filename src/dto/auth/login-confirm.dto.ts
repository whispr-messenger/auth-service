import { IsString, IsNotEmpty, Length, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginConfirmDto {
  @IsNotEmpty()
  @IsUUID(4, { message: 'Verification ID must be a valid UUID' })
  verificationId: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  @Transform(({ value }) => value?.trim())
  code: string;
}

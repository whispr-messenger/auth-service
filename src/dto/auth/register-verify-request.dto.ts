import { IsPhoneNumber, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterVerifyRequestDto {
  @IsNotEmpty()
  @IsPhoneNumber(undefined, { message: 'Phone number must be valid' })
  @Transform(({ value }) => value?.trim())
  phoneNumber: string;
}

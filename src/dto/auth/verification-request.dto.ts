import { IsNotEmpty, IsPhoneNumber } from 'class-validator';

export class VerificationRequestDto {
  @IsPhoneNumber()
  @IsNotEmpty()
  phoneNumber: string;
}

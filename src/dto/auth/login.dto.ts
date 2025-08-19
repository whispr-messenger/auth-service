import { IsString, IsUUID, IsOptional } from 'class-validator';

export class LoginDto {
  @IsUUID()
  verificationId: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @IsString()
  publicKey?: string;
}

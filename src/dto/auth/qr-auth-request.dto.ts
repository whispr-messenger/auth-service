import { IsString, IsNotEmpty } from 'class-validator';

export class QrAuthRequestDto {
  @IsNotEmpty()
  @IsString()
  deviceName: string;

  @IsNotEmpty()
  @IsString()
  deviceType: string;

  @IsNotEmpty()
  @IsString()
  deviceFingerprint: string;

  @IsNotEmpty()
  @IsString()
  publicKey: string;
}

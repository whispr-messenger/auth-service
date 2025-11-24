import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class QrAuthRequestDto {
  @ApiProperty({
    description: 'Human-readable name of the device requesting QR auth',
    example: 'Gonzalo iPhone',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  deviceName: string;

  @ApiProperty({
    description: 'Device type (desktop, mobile, etc.)',
    example: 'mobile',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  deviceType: string;

  @ApiProperty({
    description: 'Device fingerprint to uniquely identify the client instance',
    example: 'a1b2c3d4e5f6',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  deviceFingerprint: string;

  @ApiProperty({
    description: 'Client public key used to verify signatures (PEM or base64)',
    example: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  publicKey: string;
}

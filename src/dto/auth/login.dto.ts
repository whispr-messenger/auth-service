import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Verification ID (UUID) used to complete login',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @IsUUID()
  verificationId: string;

  @ApiProperty({
    description: 'Optional human-readable device name',
    example: 'Gonzalo iPhone',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiProperty({
    description: 'Optional device type (mobile, desktop, etc.)',
    example: 'mobile',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiProperty({
    description: 'Optional client public key (PEM/base64) for registering a device',
    example: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  publicKey?: string;
}

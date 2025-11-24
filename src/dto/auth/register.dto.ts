import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Verification ID (UUID) obtained from the verify step',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @IsUUID()
  verificationId: string;

  @ApiProperty({
    description: "User's first name",
    example: 'Gonzalo',
    type: String,
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    description: "User's last name",
    example: 'Lopez',
    type: String,
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    description: 'Optional human-readable device name to register with the account',
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
    description: 'Optional client public key (PEM/base64) to register for push/crypto operations',
    example: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  publicKey?: string;
}

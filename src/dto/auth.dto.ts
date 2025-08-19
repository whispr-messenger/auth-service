import {
  IsString,
  IsPhoneNumber,
  IsUUID,
  IsOptional,
  Length,
} from 'class-validator';

export class VerificationRequestDto {
  @IsPhoneNumber()
  phoneNumber: string;
}

export class VerificationConfirmDto {
  @IsUUID()
  verificationId: string;

  @IsString()
  @Length(6, 6)
  code: string;
}

export class RegisterDto {
  @IsUUID()
  verificationId: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

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

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class ScanLoginDto {
  @IsString()
  challenge: string;

  @IsUUID()
  authenticatedDeviceId: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  deviceType?: string;
}

export class TwoFactorSetupDto {
  @IsString()
  secret: string;

  @IsString()
  @Length(6, 6)
  token: string;
}

export class TwoFactorVerifyDto {
  @IsString()
  @Length(6, 6)
  token: string;
}

export class DeviceDto {
  @IsString()
  deviceName: string;

  @IsString()
  deviceType: string;

  @IsString()
  publicKey: string;

  @IsOptional()
  @IsString()
  fcmToken?: string;
}

export class TwoFactorSetupResponseDto {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  message: string;
}

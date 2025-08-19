import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class QrAuthConfirmDto {
  @IsNotEmpty()
  @IsUUID(4, { message: 'Session ID must be a valid UUID' })
  sessionId: string;

  @IsNotEmpty()
  @IsString()
  signature: string;
}

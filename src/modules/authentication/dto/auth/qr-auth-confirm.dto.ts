import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class QrAuthConfirmDto {
	@ApiProperty({
		description: 'Session ID (UUID v4) for the QR auth session',
		example: '550e8400-e29b-41d4-a716-446655440000',
		type: String,
	})
	@IsNotEmpty()
	@IsUUID(4, { message: 'Session ID must be a valid UUID' })
	sessionId: string;

	@ApiProperty({
		description: 'Signature produced by the client to prove possession of the private key',
		example: 'MEUCIQD...base64-signature...',
		type: String,
	})
	@IsNotEmpty()
	@IsString()
	signature: string;
}

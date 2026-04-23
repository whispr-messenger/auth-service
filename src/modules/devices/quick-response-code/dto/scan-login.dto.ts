import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, MaxLength, MinLength } from 'class-validator';

export class ScanLoginDto {
	@ApiProperty({
		description: 'Challenge string to be signed by the client for scan-login',
		example: 'random-challenge-string',
		type: String,
	})
	@IsString()
	@MinLength(1)
	@MaxLength(4096)
	challenge: string;

	@ApiProperty({
		description: 'Authenticated device UUID (v4) that initiated the scan',
		example: '550e8400-e29b-41d4-a716-446655440000',
		type: String,
	})
	@IsUUID()
	authenticatedDeviceId: string;

	@ApiProperty({
		description: 'Optional human-readable device name',
		example: 'Gonzalo iPhone',
		required: false,
		type: String,
	})
	@IsOptional()
	@IsString()
	@MaxLength(100)
	deviceName?: string;

	@ApiProperty({
		description: 'Optional device type (e.g., mobile, desktop)',
		example: 'mobile',
		required: false,
		type: String,
	})
	@IsOptional()
	@IsString()
	@MaxLength(20)
	deviceType?: string;
}

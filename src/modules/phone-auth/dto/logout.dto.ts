import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class LogoutDto {
	@ApiPropertyOptional({
		description: 'ID of the device to log out',
		example: '550e8400-e29b-41d4-a716-446655440001',
	})
	@IsString()
	@IsOptional()
	deviceId?: string;

	@ApiPropertyOptional({
		description: 'ID of the user to log out',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsString()
	@IsOptional()
	userId?: string;
}

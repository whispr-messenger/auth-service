import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class LogoutDto {
	@ApiPropertyOptional({
		description:
			'Optional ID of the device to log out. If omitted, the device bound to the current access token is used. When provided, the device must belong to the authenticated user otherwise the request is rejected with 403.',
		example: '550e8400-e29b-41d4-a716-446655440001',
	})
	@IsString()
	@IsNotEmpty()
	@IsOptional()
	deviceId?: string;
}

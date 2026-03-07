import { IsUUID, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SignalKeyBundleDto } from './signal-keys.dto';
import { DeviceInfo } from '../interfaces/device-info.interface';

export class LoginDto implements DeviceInfo {
	@ApiProperty({
		description: 'UUID of the SMS verification',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID()
	verificationId: string;

	@ApiPropertyOptional({ description: 'Name of the device', example: 'iPhone 15 Pro' })
	@IsOptional()
	@IsString()
	deviceName?: string;

	@ApiPropertyOptional({ description: 'Type of the device', example: 'ios' })
	@IsOptional()
	@IsString()
	deviceType?: string;

	@ApiPropertyOptional({ description: 'Device model', example: 'iPhone 15 Pro' })
	@IsOptional()
	@IsString()
	model?: string;

	@ApiPropertyOptional({ description: 'Operating system version', example: 'iOS 17.2' })
	@IsOptional()
	@IsString()
	osVersion?: string;

	@ApiPropertyOptional({ description: 'Application version', example: '1.0.0' })
	@IsOptional()
	@IsString()
	appVersion?: string;

	@ApiPropertyOptional({
		description: 'Firebase Cloud Messaging token for push notifications',
		example: 'fMI-qkJ...',
	})
	@IsOptional()
	@IsString()
	fcmToken?: string;

	@ApiPropertyOptional({ description: 'Apple Push Notification Service token', example: 'a1b2c3d4...' })
	@IsOptional()
	@IsString()
	apnsToken?: string;

	@ApiPropertyOptional({ description: 'Signal Protocol key bundle for E2EE', type: SignalKeyBundleDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => SignalKeyBundleDto)
	signalKeyBundle?: SignalKeyBundleDto;
}

import { IsUUID, IsString, IsOptional, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SignalKeyBundleDto } from './signal-keys.dto';
import { DeviceInfo } from '../interfaces/device-info.interface';

export class BaseAuthDto implements DeviceInfo {
	@ApiProperty({
		description: 'UUID of the SMS verification',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID()
	verificationId: string;

	@ApiPropertyOptional({
		description: 'Client-generated stable UUID identifying the device',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsOptional()
	@IsString()
	@MaxLength(128)
	deviceId?: string;

	@ApiPropertyOptional({ description: 'Name of the device', example: 'iPhone 15 Pro' })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	deviceName?: string;

	@ApiPropertyOptional({ description: 'Type of the device', example: 'ios' })
	@IsOptional()
	@IsString()
	@MaxLength(20)
	deviceType?: string;

	@ApiPropertyOptional({ description: 'Device model', example: 'iPhone 15 Pro' })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	model?: string;

	@ApiPropertyOptional({ description: 'Operating system version', example: 'iOS 17.2' })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	osVersion?: string;

	@ApiPropertyOptional({ description: 'Application version', example: '1.0.0' })
	@IsOptional()
	@IsString()
	@MaxLength(20)
	appVersion?: string;

	@ApiPropertyOptional({
		description: 'Firebase Cloud Messaging token for push notifications',
		example: 'fMI-qkJ...',
	})
	@IsOptional()
	@IsString()
	@MaxLength(255)
	fcmToken?: string;

	@ApiPropertyOptional({ description: 'Apple Push Notification Service token', example: 'a1b2c3d4...' })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	apnsToken?: string;

	@ApiPropertyOptional({ description: 'Signal Protocol key bundle for E2EE', type: SignalKeyBundleDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => SignalKeyBundleDto)
	signalKeyBundle?: SignalKeyBundleDto;
}

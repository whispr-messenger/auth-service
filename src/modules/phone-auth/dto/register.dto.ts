import { IsUUID, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignalKeyBundleDto } from './signal-keys.dto';
import { DeviceInfo } from '../interfaces/device-info.interface';

export class RegisterDto implements DeviceInfo {
	@IsUUID()
	verificationId: string;

	@IsOptional()
	@IsString()
	deviceName?: string;

	@IsOptional()
	@IsString()
	deviceType?: string;

	@IsOptional()
	@ValidateNested()
	@Type(() => SignalKeyBundleDto)
	signalKeyBundle?: SignalKeyBundleDto;
}

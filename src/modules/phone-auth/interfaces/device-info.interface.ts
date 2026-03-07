import { SignalKeyBundleDto } from '../dto/signal-keys.dto';

export interface DeviceInfo {
	deviceName?: string;
	deviceType?: string;
	model?: string;
	osVersion?: string;
	appVersion?: string;
	fcmToken?: string;
	apnsToken?: string;
	signalKeyBundle?: SignalKeyBundleDto;
}

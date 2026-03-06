import { SignalKeyBundleDto } from '../dto/signal-keys.dto';

export interface DeviceInfo {
	deviceName?: string;
	deviceType?: string;
	signalKeyBundle?: SignalKeyBundleDto;
}

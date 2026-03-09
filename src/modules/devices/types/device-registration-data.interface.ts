export interface DeviceRegistrationData {
	userId: string;
	deviceName: string;
	deviceType: string;
	publicKey: string;
	ipAddress?: string;
	model?: string;
	osVersion?: string;
	appVersion?: string;
	fcmToken?: string;
	apnsToken?: string;
	deviceFingerprint: string;
}

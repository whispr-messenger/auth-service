export const USER_REGISTERED_PATTERN = 'user.registered';

export interface UserRegisteredEvent {
	userId: string;
	phoneNumber: string;
	timestamp: string;
}

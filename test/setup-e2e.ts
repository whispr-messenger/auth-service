// import crypto from 'node:crypto';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USERNAME = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test';
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_LOGGING = 'false';
process.env.JWT_PRIVATE_KEY = 'test-private-key';
process.env.JWT_PUBLIC_KEY = 'test-public-key';
process.env.JWT_ACCESS_TOKEN_EXPIRY = '1h';
process.env.JWT_REFRESH_TOKEN_EXPIRY = '7d';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.SMS_PROVIDER = 'mock';
process.env.BCRYPT_ROUNDS = '4';

// Mock @keyv/redis (replaced cache-manager-redis-store)
// The app constructs a new KeyvRedis(...) and uses it as a store.
// Provide a mock constructor that returns an object with cache-like methods.
jest.mock('@keyv/redis', () => {
	const mockCtor = jest.fn().mockImplementation(() => ({
		get: jest.fn(),
		set: jest.fn(),
		delete: jest.fn(),
		clear: jest.fn(),
	}));
	// Ensure ES module default import works: export { default: mockCtor }
	return { __esModule: true, default: mockCtor };
});

// Mock SmsService
jest.mock('../src/modules/phone-verification/services/sms/sms.service', () => ({
	SmsService: jest.fn().mockImplementation(() => ({
		sendSms: jest.fn().mockResolvedValue(true),
	})),
}));

// Mock NotificationService - this service might not exist anymore
// jest.mock('../src/services/notification.service', () => ({
//     NotificationService: jest.fn().mockImplementation(() => ({
//         sendPushNotification: jest.fn().mockResolvedValue(true),
//     })),
// }))

// Mock TypeORM for e2e tests
jest.mock('typeorm', () => ({
	...jest.requireActual('typeorm'),
	DataSource: jest.fn().mockImplementation(() => ({
		initialize: jest.fn().mockResolvedValue(undefined),
		destroy: jest.fn().mockResolvedValue(undefined),
		isInitialized: true,
	})),
}));

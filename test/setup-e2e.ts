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

// Mock @keyv/redis (still used by src/modules/app/cache.ts for CACHE_MANAGER store)
// Using { virtual: true } because @keyv/redis is not installed as a dependency.
jest.mock(
	'@keyv/redis',
	() => {
		const mockCtor = jest.fn().mockImplementation(() => ({
			get: jest.fn().mockResolvedValue(undefined),
			set: jest.fn().mockResolvedValue(undefined),
			delete: jest.fn().mockResolvedValue(undefined),
			clear: jest.fn().mockResolvedValue(undefined),
		}));
		return { __esModule: true, default: mockCtor };
	},
	{ virtual: true }
);

// Mock ioredis to avoid real Redis connections during e2e tests.
jest.mock('ioredis', () => {
	const mockRedisInstance = {
		get: jest.fn().mockResolvedValue(null),
		set: jest.fn().mockResolvedValue('OK'),
		setex: jest.fn().mockResolvedValue('OK'),
		del: jest.fn().mockResolvedValue(1),
		keys: jest.fn().mockResolvedValue([]),
		ping: jest.fn().mockResolvedValue('PONG'),
		quit: jest.fn().mockResolvedValue('OK'),
		on: jest.fn(),
		status: 'ready',
	};
	const mockCtor = jest.fn().mockImplementation(() => mockRedisInstance);
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
		query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
	})),
}));

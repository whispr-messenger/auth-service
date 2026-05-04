import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Write EC key files to a temp directory so validateJwtKeys can read them
const TEST_PRIVATE_KEY = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIAbziHa/xFA+np4yxov/eARnnTYTOxY/ukqGhSOkfMoboAoGCCqGSM49
AwEHoUQDQgAEIDUdceFHvmbx6lUNwciNRmyJqpAakLzZzdPgcgDVf10YHfiaprI0
fir7QKxkq7dr1AlUUpYdbkOmYmfXnqk1Ag==
-----END EC PRIVATE KEY-----`;

const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEIDUdceFHvmbx6lUNwciNRmyJqpAa
kLzZzdPgcgDVf10YHfiaprI0fir7QKxkq7dr1AlUUpYdbkOmYmfXnqk1Ag==
-----END PUBLIC KEY-----`;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whispr-test-'));
const privateKeyFile = path.join(tmpDir, 'jwt_private_key');
const publicKeyFile = path.join(tmpDir, 'jwt_public_key');
fs.writeFileSync(privateKeyFile, TEST_PRIVATE_KEY);
fs.writeFileSync(publicKeyFile, TEST_PUBLIC_KEY);

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
process.env.JWT_PRIVATE_KEY_FILE = privateKeyFile;
process.env.JWT_PUBLIC_KEY_FILE = publicKeyFile;
process.env.JWT_ACCESS_TOKEN_EXPIRY = '1h';
process.env.JWT_REFRESH_TOKEN_EXPIRY = '7d';
process.env.JWT_ISSUER = 'whispr-auth-service-test';
process.env.JWT_AUDIENCE = 'whispr-test-audience';
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
// Kept intentionally generous (WHISPR-1000) so that new code paths calling
// rarer ioredis methods don't crash with "redis.foo is not a function"
// during CI. Extend this list rather than fall back to real Redis.
jest.mock('ioredis', () => {
	const mockRedisInstance = {
		// Basic key/value
		get: jest.fn().mockResolvedValue(null),
		set: jest.fn().mockResolvedValue('OK'),
		setex: jest.fn().mockResolvedValue('OK'),
		del: jest.fn().mockResolvedValue(1),
		exists: jest.fn().mockResolvedValue(0),
		keys: jest.fn().mockResolvedValue([]),
		mget: jest.fn().mockResolvedValue([]),
		// Counters & TTL
		incr: jest.fn().mockResolvedValue(1),
		decr: jest.fn().mockResolvedValue(0),
		expire: jest.fn().mockResolvedValue(1),
		ttl: jest.fn().mockResolvedValue(-1),
		// Hashes
		hget: jest.fn().mockResolvedValue(null),
		hset: jest.fn().mockResolvedValue(1),
		hdel: jest.fn().mockResolvedValue(1),
		hgetall: jest.fn().mockResolvedValue({}),
		// Lists
		lpush: jest.fn().mockResolvedValue(1),
		rpush: jest.fn().mockResolvedValue(1),
		lrange: jest.fn().mockResolvedValue([]),
		// Sets
		sadd: jest.fn().mockResolvedValue(1),
		srem: jest.fn().mockResolvedValue(1),
		smembers: jest.fn().mockResolvedValue([]),
		// Pub/Sub (retained for legacy paths even though Streams is preferred)
		publish: jest.fn().mockResolvedValue(1),
		subscribe: jest.fn().mockResolvedValue(1),
		unsubscribe: jest.fn().mockResolvedValue(1),
		// Streams (WHISPR-952/953)
		xadd: jest.fn().mockResolvedValue('1-0'),
		xreadgroup: jest.fn().mockResolvedValue(null),
		xack: jest.fn().mockResolvedValue(1),
		xgroup: jest.fn().mockResolvedValue('OK'),
		xlen: jest.fn().mockResolvedValue(0),
		// Connection / admin
		select: jest.fn().mockResolvedValue('OK'),
		info: jest.fn().mockResolvedValue(''),
		ping: jest.fn().mockResolvedValue('PONG'),
		quit: jest.fn().mockResolvedValue('OK'),
		disconnect: jest.fn(),
		on: jest.fn(),
		off: jest.fn(),
		status: 'ready',
	};
	const mockCtor = jest.fn().mockImplementation(() => mockRedisInstance);
	return { __esModule: true, default: mockCtor };
});

// Mock @nest-lab/throttler-storage-redis : évite l'erreur instanceof ioredis_1.default
// quand ioredis est mocké avant que le module ne soit chargé (setupFilesAfterEnv).
jest.mock('@nest-lab/throttler-storage-redis', () => {
	const ThrottlerStorageRedisService = jest.fn().mockImplementation(() => ({
		increment: jest.fn().mockResolvedValue({
			totalHits: 1,
			timeToExpire: 60000,
			isBlocked: false,
			timeToBlockExpire: 0,
		}),
		onModuleDestroy: jest.fn(),
	}));
	return { ThrottlerStorageRedisService };
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

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'sqlite';
process.env.DB_DATABASE = ':memory:';
process.env.DB_SYNCHRONIZE = 'true';
process.env.JWT_PRIVATE_KEY = 'test-private-key';
process.env.JWT_PUBLIC_KEY = 'test-public-key';
process.env.JWT_ACCESS_TOKEN_EXPIRY = '1h';
process.env.JWT_REFRESH_TOKEN_EXPIRY = '7d';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.SMS_PROVIDER = 'mock';
process.env.BCRYPT_ROUNDS = '4';

// Mock cache-manager-redis-store
jest.mock('cache-manager-redis-store', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    reset: jest.fn(),
  })),
}));

// Mock SmsService
jest.mock('../src/services/sms.service', () => ({
  SmsService: jest.fn().mockImplementation(() => ({
    sendSms: jest.fn().mockResolvedValue(true),
  })),
}));

// Mock NotificationService
jest.mock('../src/services/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendPushNotification: jest.fn().mockResolvedValue(true),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Type } from '@nestjs/common';
import { AppModule } from '../../src/modules/app/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserAuth } from '../../src/modules/common/entities/user-auth.entity';
import { Device } from '../../src/modules/devices/entities/device.entity';
import { PreKey } from '../../src/modules/signal/entities/prekey.entity';
import { SignedPreKey } from '../../src/modules/signal/entities/signed-prekey.entity';
import { IdentityKey } from '../../src/modules/signal/entities/identity-key.entity';
import { BackupCode } from '../../src/modules/two-factor-authentication/entities/backup-code.entity';
import { LoginHistory } from '../../src/modules/phone-auth/entities/login-history.entity';
import { CacheService } from '../../src/modules/cache';
import { RedisConfig } from '../../src/config/redis.config';
import { DeviceRepository } from '../../src/modules/devices/repositories/device.repository';
import { PreKeyRepository } from '../../src/modules/signal/repositories/prekey.repository';
import { SignedPreKeyRepository } from '../../src/modules/signal/repositories/signed-prekey.repository';
import { IdentityKeyRepository } from '../../src/modules/signal/repositories/identity-key.repository';

/** Creates a generic TypeORM repository mock with all standard methods. */
export function makeMockRepository() {
	return {
		find: jest.fn().mockResolvedValue([]),
		findOne: jest.fn().mockResolvedValue(null),
		save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
		create: jest.fn().mockImplementation((data: any) => data),
		delete: jest.fn().mockResolvedValue({ affected: 0 }),
		update: jest.fn().mockResolvedValue({ affected: 0 }),
		count: jest.fn().mockResolvedValue(0),
	};
}

export function makeMockCacheService() {
	// In-memory counter store so incr/expire behave predictably across calls
	// within a single test. Each test clears mocks, which resets the closure.
	let counter = 0;
	return {
		get: jest.fn().mockResolvedValue(null),
		set: jest.fn().mockResolvedValue(undefined),
		del: jest.fn().mockResolvedValue(undefined),
		delMany: jest.fn().mockResolvedValue(undefined),
		exists: jest.fn().mockResolvedValue(false),
		expire: jest.fn().mockResolvedValue(undefined),
		keys: jest.fn().mockResolvedValue([]),
		incr: jest.fn().mockImplementation(() => Promise.resolve(++counter)),
		decr: jest.fn().mockImplementation(() => Promise.resolve(--counter)),
		pipeline: jest.fn().mockResolvedValue([]),
	};
}

export function makeMockRedisConfig() {
	return {
		health: { isHealthy: true, lastError: null },
		getClient: jest.fn(),
		onModuleDestroy: jest.fn(),
	};
}

export interface ProviderOverride {
	provide: any;
	useValue: any;
}

export interface GuardOverride {
	guard: Type<any>;
	useValue: any;
}

export interface CreateTestModuleOptions {
	providers?: ProviderOverride[];
	guards?: GuardOverride[];
}

/**
 * Creates a TestingModule with all common provider overrides pre-configured.
 *
 * Default overrides include all entity repositories (UserAuth, Device, PreKey,
 * SignedPreKey, IdentityKey, BackupCode, LoginHistory), custom repositories
 * (DeviceRepository, PreKeyRepository, SignedPreKeyRepository, IdentityKeyRepository),
 * RedisConfig, and CacheService.
 *
 * Pass `providers` to replace any default or add new provider overrides.
 * Pass `guards` to override specific guards.
 */
export async function createTestModule(options?: CreateTestModuleOptions): Promise<TestingModule> {
	const genericRepo = makeMockRepository();
	const cacheService = makeMockCacheService();
	const redisConfig = makeMockRedisConfig();

	const defaultProviders: ProviderOverride[] = [
		{ provide: getRepositoryToken(UserAuth), useValue: genericRepo },
		{ provide: getRepositoryToken(Device), useValue: genericRepo },
		{ provide: getRepositoryToken(PreKey), useValue: genericRepo },
		{ provide: getRepositoryToken(SignedPreKey), useValue: genericRepo },
		{ provide: getRepositoryToken(IdentityKey), useValue: genericRepo },
		{ provide: getRepositoryToken(BackupCode), useValue: genericRepo },
		{ provide: getRepositoryToken(LoginHistory), useValue: genericRepo },
		{ provide: RedisConfig, useValue: redisConfig },
		{ provide: CacheService, useValue: cacheService },
		{ provide: DeviceRepository, useValue: genericRepo },
		{ provide: PreKeyRepository, useValue: genericRepo },
		{ provide: SignedPreKeyRepository, useValue: genericRepo },
		{ provide: IdentityKeyRepository, useValue: genericRepo },
	];

	// Merge: custom overrides replace matching defaults, new ones are appended
	const customProviders = options?.providers ?? [];
	const customTokens = new Set(customProviders.map((p) => p.provide));
	const mergedProviders = [
		...defaultProviders.filter((p) => !customTokens.has(p.provide)),
		...customProviders,
	];

	let builder = Test.createTestingModule({ imports: [AppModule] });

	for (const { provide, useValue } of mergedProviders) {
		builder = builder.overrideProvider(provide).useValue(useValue);
	}

	for (const { guard, useValue } of options?.guards ?? []) {
		builder = builder.overrideGuard(guard).useValue(useValue);
	}

	return builder.compile();
}

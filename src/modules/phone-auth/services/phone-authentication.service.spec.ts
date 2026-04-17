import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { PhoneAuthenticationService } from './phone-authentication.service';
import { DeviceRegistrationService } from '../../devices/services/device-registration/device-registration.service';
import { DeviceActivityService } from '../../devices/services/device-activity/device-activity.service';
import { PhoneVerificationService } from '../../phone-verification/services/phone-verification/phone-verification.service';
import { TokensService } from '../../tokens/services/tokens.service';
import { UserAuthService } from '../../common/services/user-auth.service';
import { SignalKeyStorageService } from '../../signal/services/signal-key-storage.service';
import { DeviceFingerprint } from '../../devices/types/device-fingerprint.interface';

describe('PhoneAuthenticationService', () => {
	let service: PhoneAuthenticationService;

	const mockDeviceRegistrationService = {
		registerDevice: jest.fn(),
	};
	const mockDeviceActivityService = {
		updateLastActive: jest.fn(),
	};
	const mockPhoneVerificationService = {
		getConfirmedVerification: jest.fn(),
		consumeVerification: jest.fn(),
	};
	const mockTokensService = {
		generateTokenPair: jest.fn(),
		revokeAllTokensForDevice: jest.fn(),
		clearDeviceRevocation: jest.fn().mockResolvedValue(undefined),
	};
	const mockUserAuthService = {
		findByPhoneNumber: jest.fn(),
		createUser: jest.fn(),
		saveUser: jest.fn(),
	};
	const mockSignalKeyStorageService = {
		storeIdentityKey: jest.fn(),
		storeSignedPreKey: jest.fn(),
		storePreKeys: jest.fn(),
	};
	const mockRedisClient = {
		emit: jest.fn().mockReturnValue(of(undefined)),
	};

	const fingerprint: DeviceFingerprint = {
		ipAddress: '127.0.0.1',
		userAgent: 'test-agent',
		timestamp: Date.now(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PhoneAuthenticationService,
				{ provide: DeviceRegistrationService, useValue: mockDeviceRegistrationService },
				{ provide: DeviceActivityService, useValue: mockDeviceActivityService },
				{ provide: PhoneVerificationService, useValue: mockPhoneVerificationService },
				{ provide: TokensService, useValue: mockTokensService },
				{ provide: UserAuthService, useValue: mockUserAuthService },
				{ provide: SignalKeyStorageService, useValue: mockSignalKeyStorageService },
				{ provide: 'REDIS_CLIENT', useValue: mockRedisClient },
			],
		}).compile();

		service = module.get<PhoneAuthenticationService>(PhoneAuthenticationService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('handleDeviceRegistration (deviceId forwarding)', () => {
		it('should forward deviceId as deviceFingerprint when registering a device', async () => {
			const deviceId = 'stable-client-uuid';
			const registeredDevice = { id: 'device-db-id' };

			mockPhoneVerificationService.getConfirmedVerification.mockResolvedValue({
				phoneNumber: '+33600000001',
				purpose: 'login',
			});
			mockUserAuthService.findByPhoneNumber.mockResolvedValue({
				id: 'user-1',
				phoneNumber: '+33600000001',
				lastAuthenticatedAt: new Date(),
			});
			mockDeviceRegistrationService.registerDevice.mockResolvedValue(registeredDevice);
			mockSignalKeyStorageService.storeIdentityKey.mockResolvedValue(undefined);
			mockSignalKeyStorageService.storeSignedPreKey.mockResolvedValue(undefined);
			mockSignalKeyStorageService.storePreKeys.mockResolvedValue(undefined);
			mockUserAuthService.saveUser.mockResolvedValue({ id: 'user-1' });
			mockPhoneVerificationService.consumeVerification.mockResolvedValue(undefined);
			mockTokensService.generateTokenPair.mockResolvedValue({
				accessToken: 'token-a',
				refreshToken: 'refresh-a',
				userId: 'user-1',
				deviceId: 'device-db-id',
			});

			const dto = {
				verificationId: 'ver-1',
				deviceId,
				deviceName: 'iPhone 15',
				deviceType: 'ios',
				signalKeyBundle: {
					identityKey: 'ik',
					signedPreKey: { keyId: 1, publicKey: 'spk', signature: 'sig' },
					preKeys: [],
				},
			};

			await service.login(dto as any, fingerprint);

			expect(mockDeviceRegistrationService.registerDevice).toHaveBeenCalledWith(
				expect.objectContaining({ deviceFingerprint: deviceId })
			);
		});
	});

	describe('handleDeviceRegistration (server-side UUID fallback)', () => {
		it('should generate a server-side UUID as deviceFingerprint when deviceId is absent', async () => {
			const registeredDevice = { id: 'device-db-id' };

			mockPhoneVerificationService.getConfirmedVerification.mockResolvedValue({
				phoneNumber: '+33600000001',
				purpose: 'login',
			});
			mockUserAuthService.findByPhoneNumber.mockResolvedValue({
				id: 'user-1',
				phoneNumber: '+33600000001',
				lastAuthenticatedAt: new Date(),
			});
			mockDeviceRegistrationService.registerDevice.mockResolvedValue(registeredDevice);
			mockSignalKeyStorageService.storeIdentityKey.mockResolvedValue(undefined);
			mockSignalKeyStorageService.storeSignedPreKey.mockResolvedValue(undefined);
			mockSignalKeyStorageService.storePreKeys.mockResolvedValue(undefined);
			mockUserAuthService.saveUser.mockResolvedValue({ id: 'user-1' });
			mockPhoneVerificationService.consumeVerification.mockResolvedValue(undefined);
			mockTokensService.generateTokenPair.mockResolvedValue({
				accessToken: 'token-a',
				refreshToken: 'refresh-a',
				userId: 'user-1',
				deviceId: 'device-db-id',
			});

			const dto = {
				verificationId: 'ver-1',
				// no deviceId
				deviceName: 'iPhone 15',
				deviceType: 'ios',
				signalKeyBundle: {
					identityKey: 'ik',
					signedPreKey: { keyId: 1, publicKey: 'spk', signature: 'sig' },
					preKeys: [],
				},
			};

			await service.login(dto as any, fingerprint);

			const call = mockDeviceRegistrationService.registerDevice.mock.calls[0][0];
			expect(call.deviceFingerprint).toBeDefined();
			expect(typeof call.deviceFingerprint).toBe('string');
			expect(call.deviceFingerprint).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
			);
		});
	});

	describe('handleDeviceRegistration (web session path)', () => {
		it('should return a unique UUID for each web session when no signalKeyBundle is provided', async () => {
			mockPhoneVerificationService.getConfirmedVerification.mockResolvedValue({
				phoneNumber: '+33600000001',
				purpose: 'login',
			});
			mockUserAuthService.findByPhoneNumber.mockResolvedValue({
				id: 'user-1',
				phoneNumber: '+33600000001',
				lastAuthenticatedAt: new Date(),
			});
			mockUserAuthService.saveUser.mockResolvedValue({ id: 'user-1' });
			mockPhoneVerificationService.consumeVerification.mockResolvedValue(undefined);
			mockTokensService.generateTokenPair
				.mockResolvedValueOnce({
					accessToken: 'token-a',
					refreshToken: 'refresh-a',
					userId: 'user-1',
					deviceId: 'device-a',
				})
				.mockResolvedValueOnce({
					accessToken: 'token-b',
					refreshToken: 'refresh-b',
					userId: 'user-1',
					deviceId: 'device-b',
				});

			const dto = { verificationId: 'ver-1' };

			await service.login(dto as any, fingerprint);
			await service.login(dto as any, fingerprint);

			const [call1, call2] = mockTokensService.generateTokenPair.mock.calls;
			const deviceId1: string = call1[1];
			const deviceId2: string = call2[1];

			expect(deviceId1).not.toBe('web-session');
			expect(deviceId2).not.toBe('web-session');
			expect(deviceId1).not.toBe(deviceId2);
			expect(deviceId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
		});
	});

	describe('logout', () => {
		it('should revoke tokens and update device activity for a registered device', async () => {
			mockTokensService.revokeAllTokensForDevice.mockResolvedValue(undefined);
			mockDeviceActivityService.updateLastActive.mockResolvedValue(undefined);

			await service.logout('user-1', 'device-uuid-123');

			expect(mockTokensService.revokeAllTokensForDevice).toHaveBeenCalledWith('device-uuid-123');
			expect(mockDeviceActivityService.updateLastActive).toHaveBeenCalledWith('device-uuid-123');
		});

		it('should silently ignore NotFoundException from updateLastActive for web session device IDs', async () => {
			mockTokensService.revokeAllTokensForDevice.mockResolvedValue(undefined);
			mockDeviceActivityService.updateLastActive.mockRejectedValue(
				new NotFoundException('Device not found')
			);

			await expect(service.logout('user-1', 'web-session-uuid')).resolves.toBeUndefined();
			expect(mockTokensService.revokeAllTokensForDevice).toHaveBeenCalledWith('web-session-uuid');
		});

		it('should re-throw non-NotFoundException errors from updateLastActive', async () => {
			mockTokensService.revokeAllTokensForDevice.mockResolvedValue(undefined);
			const unexpectedError = new Error('DB connection lost');
			mockDeviceActivityService.updateLastActive.mockRejectedValue(unexpectedError);

			await expect(service.logout('user-1', 'device-uuid-123')).rejects.toThrow('DB connection lost');
		});
	});

	describe('login', () => {
		it('should throw BadRequestException if user is not found', async () => {
			mockPhoneVerificationService.getConfirmedVerification.mockResolvedValue({
				phoneNumber: '+33600000001',
				purpose: 'login',
			});
			mockUserAuthService.findByPhoneNumber.mockResolvedValue(null);

			await expect(service.login({ verificationId: 'ver-1' } as any, fingerprint)).rejects.toThrow(
				BadRequestException
			);
		});
	});

	describe('register', () => {
		it('should throw ConflictException if phone number already exists', async () => {
			mockPhoneVerificationService.getConfirmedVerification.mockResolvedValue({
				phoneNumber: '+33600000001',
				purpose: 'registration',
			});
			mockUserAuthService.findByPhoneNumber.mockResolvedValue({ id: 'existing-user' });

			await expect(service.register({ verificationId: 'ver-1' } as any, fingerprint)).rejects.toThrow(
				ConflictException
			);
		});

		it('should log before and after emitting user.registered event', async () => {
			const savedUser = { id: 'user-123', phoneNumber: '+33600000001' };
			mockPhoneVerificationService.getConfirmedVerification.mockResolvedValue({
				phoneNumber: '+33600000001',
				purpose: 'registration',
			});
			mockUserAuthService.findByPhoneNumber.mockResolvedValue(null);
			mockUserAuthService.createUser.mockReturnValue(savedUser);
			mockUserAuthService.saveUser.mockResolvedValue(savedUser);
			mockDeviceRegistrationService.registerDevice.mockResolvedValue({ id: 'device-1' });
			mockTokensService.generateTokenPair.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

			const logSpy = jest.spyOn(service['logger'], 'log');

			await service.register({ verificationId: 'ver-1' } as any, fingerprint);

			expect(logSpy).toHaveBeenCalledWith(
				expect.stringContaining('Emitting user.registered for userId=user-123')
			);
			expect(logSpy).toHaveBeenCalledWith(
				expect.stringContaining('user.registered emitted successfully for userId=user-123')
			);
			expect(mockRedisClient.emit).toHaveBeenCalledWith(
				'user.registered',
				expect.objectContaining({ userId: 'user-123' })
			);
		});

		it('should log error when emit observable fails', async () => {
			const savedUser = { id: 'user-123', phoneNumber: '+33600000001' };
			mockPhoneVerificationService.getConfirmedVerification.mockResolvedValue({
				phoneNumber: '+33600000001',
				purpose: 'registration',
			});
			mockUserAuthService.findByPhoneNumber.mockResolvedValue(null);
			mockUserAuthService.createUser.mockReturnValue(savedUser);
			mockUserAuthService.saveUser.mockResolvedValue(savedUser);
			mockDeviceRegistrationService.registerDevice.mockResolvedValue({ id: 'device-1' });
			mockTokensService.generateTokenPair.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
			mockRedisClient.emit.mockReturnValue(throwError(() => new Error('Transport error')));

			const errorSpy = jest.spyOn(service['logger'], 'error');
			const logSpy = jest.spyOn(service['logger'], 'log');

			const result = await service.register({ verificationId: 'ver-1' } as any, fingerprint);

			expect(result).toBeDefined();
			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'Failed to emit user.registered for userId=user-123: Transport error'
				),
				expect.any(String)
			);
			expect(logSpy).not.toHaveBeenCalledWith(
				expect.stringContaining('user.registered emitted successfully for userId=user-123')
			);
		});
	});
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { DeviceService } from './device.service';
import { Device } from '../entities/device.entity';

describe('DeviceService', () => {
  let service: DeviceService;
  let deviceRepository: jest.Mocked<Repository<Device>>;
  let cacheManager: jest.Mocked<Cache>;
  let jwtService: jest.Mocked<JwtService>;

  const mockDevice = {
    id: 'device-id',
    userId: 'user-id',
    deviceName: 'Test Device',
    deviceType: 'mobile',
    deviceFingerprint: 'test-fingerprint',
    publicKey: 'test-public-key',
    lastActive: new Date(),
    isVerified: true,
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceService,
        {
          provide: getRepositoryToken(Device),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DeviceService>(DeviceService);
    deviceRepository = module.get(getRepositoryToken(Device));
    cacheManager = module.get(CACHE_MANAGER);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateQRChallenge', () => {
    it('should generate QR challenge successfully', async () => {
      const authenticatedDeviceId = 'device-id';
      const challenge = 'signed-jwt-token';

      deviceRepository.findOne.mockResolvedValue(mockDevice as Device);
      jwtService.sign.mockReturnValue(challenge);
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.generateQRChallenge(authenticatedDeviceId);

      expect(deviceRepository.findOne).toHaveBeenCalledWith({
        where: { id: authenticatedDeviceId },
      });
      expect(jwtService.sign).toHaveBeenCalled();
      expect(cacheManager.set).toHaveBeenCalled();
      expect(result).toBe(challenge);
    });

    it('should throw BadRequestException if device not found', async () => {
      deviceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.generateQRChallenge('invalid-device-id')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateQRChallenge', () => {
    it('should validate QR challenge successfully', async () => {
      const challenge = 'valid-jwt-token';
      const authenticatedDeviceId = 'device-id';
      const challengeId = 'challenge-id';
      const challengeData = {
        userId: 'user-id',
        deviceId: 'device-id',
        publicKey: 'public-key',
        expiresAt: Date.now() + 300000,
      };

      jwtService.verify.mockReturnValue({
        challengeId,
        deviceId: authenticatedDeviceId,
        userId: 'user-id',
      });
      cacheManager.get.mockResolvedValue(JSON.stringify(challengeData));
      cacheManager.del.mockResolvedValue(undefined);

      const result = await service.validateQRChallenge(
        challenge,
        authenticatedDeviceId
      );

      expect(jwtService.verify).toHaveBeenCalledWith(challenge, {
        algorithms: ['ES256'],
      });
      expect(cacheManager.get).toHaveBeenCalledWith(
        `qr_challenge:${challengeId}`
      );
      expect(cacheManager.del).toHaveBeenCalledWith(
        `qr_challenge:${challengeId}`
      );
      expect(result).toEqual(challengeData);
    });

    it('should throw ForbiddenException if device ID mismatch', async () => {
      const challenge = 'valid-jwt-token';
      const authenticatedDeviceId = 'device-id';
      const challengeId = 'challenge-id';

      jwtService.verify.mockReturnValue({
        challengeId,
        deviceId: 'different-device-id',
        userId: 'user-id',
      });

      await expect(
        service.validateQRChallenge(challenge, authenticatedDeviceId)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if challenge expired', async () => {
      const challenge = 'valid-jwt-token';
      const authenticatedDeviceId = 'device-id';
      const challengeId = 'challenge-id';

      jwtService.verify.mockReturnValue({
        challengeId,
        deviceId: authenticatedDeviceId,
        userId: 'user-id',
      });
      cacheManager.get.mockResolvedValue(null);

      await expect(
        service.validateQRChallenge(challenge, authenticatedDeviceId)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if challenge data expired', async () => {
      const challenge = 'valid-jwt-token';
      const authenticatedDeviceId = 'device-id';
      const challengeId = 'challenge-id';
      const expiredChallengeData = {
        userId: 'user-id',
        deviceId: 'device-id',
        publicKey: 'public-key',
        expiresAt: Date.now() - 1000, // Expired
      };

      jwtService.verify.mockReturnValue({
        challengeId,
        deviceId: authenticatedDeviceId,
        userId: 'user-id',
      });
      cacheManager.get.mockResolvedValue(JSON.stringify(expiredChallengeData));
      cacheManager.del.mockResolvedValue(undefined);

      await expect(
        service.validateQRChallenge(challenge, authenticatedDeviceId)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('registerDevice', () => {
    it('should register device successfully', async () => {
      const deviceData = {
        userId: 'user-id',
        deviceName: 'iPhone 13',
        deviceType: 'mobile',
        publicKey: 'public-key',
        ipAddress: '127.0.0.1',
      };

      const newDevice = { ...mockDevice, ...deviceData };
      deviceRepository.create.mockReturnValue(newDevice as Device);
      deviceRepository.save.mockResolvedValue(newDevice as Device);

      const result = await service.registerDevice(deviceData);

      expect(deviceRepository.create).toHaveBeenCalled();
      expect(deviceRepository.save).toHaveBeenCalled();
      expect(result).toEqual(newDevice);
    });
  });

  describe('getUserDevices', () => {
    it('should return user devices', async () => {
      const userId = 'user-id';
      const devices = [mockDevice];

      deviceRepository.find.mockResolvedValue(devices as Device[]);

      const result = await service.getUserDevices(userId);

      expect(deviceRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { lastActive: 'DESC' },
      });
      expect(result).toEqual(devices);
    });
  });

  describe('revokeDevice', () => {
    it('should revoke device successfully', async () => {
      const userId = 'user-id';
      const deviceId = 'device-id';

      deviceRepository.findOne.mockResolvedValue(mockDevice as Device);
      deviceRepository.remove.mockResolvedValue(mockDevice as Device);

      await service.revokeDevice(userId, deviceId);

      expect(deviceRepository.findOne).toHaveBeenCalledWith({
        where: { id: deviceId, userId },
      });
      expect(deviceRepository.remove).toHaveBeenCalledWith(mockDevice);
    });

    it('should throw BadRequestException if device not found', async () => {
      const userId = 'user-id';
      const deviceId = 'invalid-device-id';

      deviceRepository.findOne.mockResolvedValue(null);

      await expect(service.revokeDevice(userId, deviceId)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});

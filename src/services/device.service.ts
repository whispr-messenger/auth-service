import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { Device } from '../entities/device.entity';
import { v4 as uuidv4 } from 'uuid';

interface DeviceRegistrationData {
  userId: string;
  deviceName: string;
  deviceType: string;
  publicKey: string;
  ipAddress?: string;
  fcmToken?: string;
}

interface QRChallengeData {
  userId: string;
  deviceId: string;
  publicKey: string;
  expiresAt: number;
}

@Injectable()
export class DeviceService {
  private readonly QR_CHALLENGE_TTL = 5 * 60;

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly jwtService: JwtService,
  ) {}

  async registerDevice(data: DeviceRegistrationData): Promise<Device> {
    const existingDevice = await this.deviceRepository.findOne({
      where: {
        userId: data.userId,
        deviceName: data.deviceName,
        deviceType: data.deviceType,
      },
    });

    if (existingDevice) {
      existingDevice.publicKey = data.publicKey;
      existingDevice.ipAddress = data.ipAddress || '';
      existingDevice.fcmToken = data.fcmToken || '';
      existingDevice.lastActive = new Date();
      existingDevice.isVerified = true;
      return this.deviceRepository.save(existingDevice);
    }

    const device = this.deviceRepository.create({
      userId: data.userId,
      deviceName: data.deviceName,
      deviceType: data.deviceType,
      publicKey: data.publicKey,
      ipAddress: data.ipAddress,
      fcmToken: data.fcmToken,
      isVerified: true,
      lastActive: new Date(),
    });

    return this.deviceRepository.save(device);
  }

  async getUserDevices(userId: string): Promise<Device[]> {
    return this.deviceRepository.find({
      where: { userId },
      order: { lastActive: 'DESC' },
    });
  }

  async getDevice(deviceId: string): Promise<Device> {
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId },
    });
    if (!device) {
      throw new NotFoundException('Appareil non trouvé');
    }
    return device;
  }

  async updateLastActive(deviceId: string): Promise<void> {
    await this.deviceRepository.update(
      { id: deviceId },
      { lastActive: new Date() },
    );
  }

  async revokeDevice(userId: string, deviceId: string): Promise<void> {
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId, userId },
    });

    if (!device) {
      throw new NotFoundException('Appareil non trouvé');
    }

    await this.deviceRepository.remove(device);
  }

  async generateQRChallenge(authenticatedDeviceId: string): Promise<string> {
    const device = await this.getDevice(authenticatedDeviceId);

    const challengeId = uuidv4();
    const challengeData: QRChallengeData = {
      userId: device.userId,
      deviceId: device.id,
      publicKey: device.publicKey,
      expiresAt: Date.now() + this.QR_CHALLENGE_TTL * 1000,
    };

    const challenge = this.jwtService.sign(
      {
        challengeId,
        deviceId: device.id,
        userId: device.userId,
        exp: Math.floor(challengeData.expiresAt / 1000),
      },
      { algorithm: 'ES256' },
    );

    await this.cacheManager.set(
      `qr_challenge:${challengeId}`,
      JSON.stringify(challengeData),
      this.QR_CHALLENGE_TTL * 1000,
    );

    return challenge;
  }

  async validateQRChallenge(
    challenge: string,
    authenticatedDeviceId: string,
  ): Promise<QRChallengeData> {
    try {
      const decoded = this.jwtService.verify(challenge, {
        algorithms: ['ES256'],
      });

      if (decoded.deviceId !== authenticatedDeviceId) {
        throw new ForbiddenException('Appareil non autorisé pour ce challenge');
      }

      const challengeData = await this.cacheManager.get<string>(
        `qr_challenge:${decoded.challengeId}`,
      );
      if (!challengeData) {
        throw new BadRequestException('Challenge QR expiré ou invalide');
      }

      const data: QRChallengeData = JSON.parse(challengeData);

      if (data.expiresAt < Date.now()) {
        await this.cacheManager.del(`qr_challenge:${decoded.challengeId}`);
        throw new BadRequestException('Challenge QR expiré');
      }

      await this.cacheManager.del(`qr_challenge:${decoded.challengeId}`);

      return data;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Challenge QR invalide');
    }
  }

  async updateFCMToken(deviceId: string, fcmToken: string): Promise<void> {
    await this.deviceRepository.update(
      { id: deviceId },
      { fcmToken, lastActive: new Date() },
    );
  }

  async getDevicesByUserId(userId: string): Promise<Device[]> {
    return this.deviceRepository.find({
      where: { userId, isVerified: true },
      order: { lastActive: 'DESC' },
    });
  }

  async verifyDevice(deviceId: string): Promise<void> {
    await this.deviceRepository.update({ id: deviceId }, { isVerified: true });
  }

  async getDeviceStats(
    userId: string,
  ): Promise<{ total: number; active: number }> {
    const total = await this.deviceRepository.count({
      where: { userId, isVerified: true },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const active = await this.deviceRepository.count({
      where: {
        userId,
        isVerified: true,
        lastActive: { $gte: thirtyDaysAgo } as any,
      },
    });

    return { total, active };
  }
}

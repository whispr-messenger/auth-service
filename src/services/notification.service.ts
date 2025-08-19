import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../entities/device.entity';
import { UserAuth } from '../entities/user-auth.entity';
import { SmsService } from './sms.service';

interface NotificationData {
  userId: string;
  deviceName: string;
  deviceType: string;
  ipAddress?: string;
  location?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(UserAuth)
    private readonly userAuthRepository: Repository<UserAuth>,
    private readonly smsService: SmsService,
  ) {}

  async notifyNewDeviceLogin(data: NotificationData): Promise<void> {
    try {
      const user = await this.userAuthRepository.findOne({
        where: { id: data.userId },
      });

      if (!user) {
        this.logger.warn(`User not found for notification: ${data.userId}`);
        return;
      }

      await this.smsService.sendSecurityAlert(user.phoneNumber, 'new_device');

      this.logger.log(
        `New device login notification sent to ${user.phoneNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send new device notification: ${error.message}`,
        error.stack,
      );
    }
  }

  async notifyQRLogin(userId: string): Promise<void> {
    try {
      const user = await this.userAuthRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        this.logger.warn(`User not found for QR notification: ${userId}`);
        return;
      }

      await this.smsService.sendSecurityAlert(
        user.phoneNumber,
        'suspicious_login',
      );

      this.logger.log(`QR login notification sent to ${user.phoneNumber}`);
    } catch (error) {
      this.logger.error(
        `Failed to send QR login notification: ${error.message}`,
        error.stack,
      );
    }
  }

  async notifyDeviceRevoked(userId: string): Promise<void> {
    try {
      const user = await this.userAuthRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        this.logger.warn(
          `User not found for revocation notification: ${userId}`,
        );
        return;
      }

      await this.smsService.sendSecurityAlert(
        user.phoneNumber,
        'suspicious_login',
      );

      this.logger.log(
        `Device revocation notification sent to ${user.phoneNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send device revocation notification: ${error.message}`,
        error.stack,
      );
    }
  }

  async notify2FAStatusChange(userId: string): Promise<void> {
    try {
      const user = await this.userAuthRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        this.logger.warn(`User not found for 2FA notification: ${userId}`);
        return;
      }

      await this.smsService.sendSecurityAlert(
        user.phoneNumber,
        'password_change',
      );

      this.logger.log(
        `2FA status change notification sent to ${user.phoneNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send 2FA status notification: ${error.message}`,
        error.stack,
      );
    }
  }

  async notifyPasswordReset(phoneNumber: string): Promise<void> {
    try {
      await this.smsService.sendSecurityAlert(phoneNumber, 'password_change');

      this.logger.log(`Password reset notification sent to ${phoneNumber}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset notification: ${error.message}`,
        error.stack,
      );
    }
  }
}

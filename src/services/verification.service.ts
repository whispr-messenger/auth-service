import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { parsePhoneNumber } from 'libphonenumber-js';
import { VerificationCode } from '../interfaces/verification.interface';
import { SmsService } from './sms.service';

@Injectable()
export class VerificationService {
  private readonly VERIFICATION_TTL = 15 * 60;
  private readonly MAX_ATTEMPTS = 5;
  private readonly RATE_LIMIT_TTL = 60 * 60;
  private readonly MAX_REQUESTS_PER_HOUR = 5;
  private readonly BCRYPT_ROUNDS = 10;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly smsService: SmsService
  ) {}

  async requestVerification(
    phoneNumber: string,
    purpose: 'registration' | 'login' | 'recovery'
  ): Promise<string> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    await this.checkRateLimit(normalizedPhone);

    const verificationId = uuidv4();
    const code = this.generateCode();
    const hashedCode = await bcrypt.hash(code, this.BCRYPT_ROUNDS);

    const verificationData: VerificationCode = {
      phoneNumber: normalizedPhone,
      hashedCode,
      purpose,
      attempts: 0,
      expiresAt: Date.now() + this.VERIFICATION_TTL * 1000,
    };

    await this.cacheManager.set(
      `verification:${verificationId}`,
      JSON.stringify(verificationData),
      this.VERIFICATION_TTL * 1000
    );

    await this.incrementRateLimit(normalizedPhone);

    // Send SMS in production, log in development
    try {
      await this.smsService.sendVerificationCode(
        normalizedPhone,
        code,
        purpose
      );
    } catch (error) {
      // If SMS fails, still return the verification ID but log the error
      console.error('Failed to send SMS:', error);
      console.log(`Verification code for ${normalizedPhone}: ${code}`);
    }

    return verificationId;
  }

  async verifyCode(
    verificationId: string,
    code: string
  ): Promise<VerificationCode> {
    const key = `verification:${verificationId}`;
    const data = await this.cacheManager.get<string>(key);

    if (!data) {
      throw new BadRequestException('Code de vérification invalide ou expiré');
    }

    const verificationData: VerificationCode = JSON.parse(data);

    if (verificationData.attempts >= this.MAX_ATTEMPTS) {
      await this.cacheManager.del(key);
      throw new HttpException(
        'Trop de tentatives de vérification',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const isValid = await bcrypt.compare(code, verificationData.hashedCode);

    if (!isValid) {
      verificationData.attempts++;
      await this.cacheManager.set(
        key,
        JSON.stringify(verificationData),
        Math.ceil(verificationData.expiresAt - Date.now())
      );
      throw new BadRequestException('Code de vérification incorrect');
    }

    return verificationData;
  }

  async consumeVerification(verificationId: string): Promise<void> {
    await this.cacheManager.del(`verification:${verificationId}`);
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    try {
      const parsed = parsePhoneNumber(phoneNumber);
      if (!parsed || !parsed.isValid()) {
        throw new BadRequestException('Numéro de téléphone invalide');
      }
      return parsed.format('E.164');
    } catch (error) {
      throw new BadRequestException('Numéro de téléphone invalide');
    }
  }

  private async checkRateLimit(phoneNumber: string): Promise<void> {
    const key = `rate_limit:${phoneNumber}`;
    const count = await this.cacheManager.get<string>(key);

    if (count && parseInt(count) >= this.MAX_REQUESTS_PER_HOUR) {
      throw new HttpException(
        'Trop de demandes de codes de vérification',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  private async incrementRateLimit(phoneNumber: string): Promise<void> {
    const key = `rate_limit:${phoneNumber}`;
    let current = (await this.cacheManager.get<number>(key)) || 0;
    current++;

    await this.cacheManager.set(key, current, this.RATE_LIMIT_TTL * 1000);
  }
}

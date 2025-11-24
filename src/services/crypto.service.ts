import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface EncryptedData {
  encryptedData: string;
  iv: string;
  tag: string;
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_LENGTH = 32; // 256 bits
  private readonly IV_LENGTH = 16; // 128 bits
  private readonly TAG_LENGTH = 16; // 128 bits
  private readonly BCRYPT_ROUNDS = 12;

  /**
   * Generate a cryptographically secure random key
   */
  generateSecretKey(): string {
    return crypto.randomBytes(this.KEY_LENGTH).toString('hex');
  }

  /**
   * Generate RSA key pair for device authentication
   */
  generateRSAKeyPair(): KeyPair {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { publicKey, privateKey };
  }

  /**
   * Generate ECDH key pair for Signal protocol
   */
  generateECDHKeyPair(): KeyPair {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { publicKey, privateKey };
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(data: string, key: string): EncryptedData {
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipher(this.ALGORITHM, keyBuffer);
      cipher.setAAD(Buffer.from('auth-service', 'utf8'));

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();

      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
      };
    } catch (error) {
      this.logger.error('Encryption failed:', error.message);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encryptedData: EncryptedData, key: string): string {
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');

      const decipher = crypto.createDecipher(this.ALGORITHM, keyBuffer);
      decipher.setAuthTag(tag);
      decipher.setAAD(Buffer.from('auth-service', 'utf8'));

      let decrypted = decipher.update(
        encryptedData.encryptedData,
        'hex',
        'utf8'
      );
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed:', error.message);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate secure random string
   */
  generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate UUID v4
   */
  generateUUID(): string {
    return uuidv4();
  }

  /**
   * Create HMAC signature
   */
  createHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  verifyHMAC(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.createHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Sign data with RSA private key
   */
  signWithRSA(data: string, privateKey: string): string {
    try {
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(data);
      return sign.sign(privateKey, 'base64');
    } catch (error) {
      this.logger.error('RSA signing failed:', error.message);
      throw new Error('RSA signing failed');
    }
  }

  /**
   * Verify RSA signature
   */
  verifyRSASignature(
    data: string,
    signature: string,
    publicKey: string
  ): boolean {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(data);
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      this.logger.error('RSA verification failed:', error.message);
      return false;
    }
  }

  /**
   * Derive key using PBKDF2
   */
  deriveKey(
    password: string,
    salt: string,
    iterations: number = 100000
  ): string {
    return crypto
      .pbkdf2Sync(password, salt, iterations, this.KEY_LENGTH, 'sha256')
      .toString('hex');
  }

  /**
   * Generate salt for key derivation
   */
  generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Create SHA-256 hash
   */
  createSHA256Hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate device fingerprint
   */
  generateDeviceFingerprint(deviceInfo: {
    deviceName: string;
    deviceType: string;
    model?: string;
    osVersion?: string;
    appVersion?: string;
  }): string {
    const fingerprintData = [
      deviceInfo.deviceName,
      deviceInfo.deviceType,
      deviceInfo.model || '',
      deviceInfo.osVersion || '',
      deviceInfo.appVersion || '',
      Date.now().toString(),
    ].join('|');

    return this.createSHA256Hash(fingerprintData);
  }

  /**
   * Generate backup codes for 2FA
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }

    return codes;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /**
   * Generate QR code data for authentication
   */
  generateQRCodeData(sessionId: string, deviceInfo: any): string {
    const qrData = {
      sessionId,
      timestamp: Date.now(),
      deviceInfo,
      nonce: this.generateRandomString(16),
    };

    return Buffer.from(JSON.stringify(qrData)).toString('base64');
  }

  /**
   * Parse and validate QR code data
   */
  parseQRCodeData(qrCodeData: string): {
    sessionId: string;
    timestamp: number;
    deviceInfo: any;
    nonce: string;
  } | null {
    try {
      const decoded = Buffer.from(qrCodeData, 'base64').toString('utf8');
      const data = JSON.parse(decoded);

      // Validate required fields
      if (
        !data.sessionId ||
        !data.timestamp ||
        !data.deviceInfo ||
        !data.nonce
      ) {
        return null;
      }

      // Check if QR code is not too old (5 minutes)
      const maxAge = 5 * 60 * 1000; // 5 minutes
      if (Date.now() - data.timestamp > maxAge) {
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error('QR code parsing failed:', error.message);
      return null;
    }
  }
}

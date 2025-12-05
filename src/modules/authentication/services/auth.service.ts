import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAuth } from '../../two-factor-authentication/user-auth.entity';
import { RegisterDto, LoginDto } from '../dto/auth.dto';
import { DevicesService } from 'src/modules/devices/devices.service';
import { DeviceFingerprint } from 'src/modules/devices/device-fingerprint.interface';
import { TokenPair } from 'src/modules/tokens/types/token-pair.interface';
import { PhoneVerificationService } from 'src/modules/phone-verification/services/phone-verification/phone-verification.service';
import { TokensService } from 'src/modules/tokens/services/tokens.service';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(UserAuth)
        private readonly userAuthRepository: Repository<UserAuth>,
        private readonly verificationService: PhoneVerificationService,
        private readonly tokenService: TokensService,
        private readonly deviceService: DevicesService
    ) {}

    async register(dto: RegisterDto, fingerprint: DeviceFingerprint): Promise<TokenPair> {
        const verificationData = await this.verificationService.verifyCode(dto.verificationId, '');

        if (verificationData.purpose !== 'registration') {
            throw new BadRequestException("Code de vérification invalide pour l'inscription");
        }

        const existingUser = await this.userAuthRepository.findOne({
            where: { phoneNumber: verificationData.phoneNumber },
        });

        if (existingUser) {
            throw new ConflictException('Un compte existe déjà avec ce numéro de téléphone');
        }

        const user = this.userAuthRepository.create({
            phoneNumber: verificationData.phoneNumber,
            twoFactorEnabled: false,
            lastAuthenticatedAt: new Date(),
        });

        const savedUser = await this.userAuthRepository.save(user);

        let deviceId: string;

        if (dto.deviceName && dto.deviceType && dto.publicKey) {
            const device = await this.deviceService.registerDevice({
                userId: savedUser.id,
                deviceName: dto.deviceName,
                deviceType: dto.deviceType,
                publicKey: dto.publicKey,
                ipAddress: fingerprint.ipAddress,
            });
            deviceId = device.id;
        } else {
            deviceId = 'web-session';
        }

        await this.verificationService.consumeVerification(dto.verificationId);

        return this.tokenService.generateTokenPair(savedUser.id, deviceId, fingerprint);
    }

    async login(dto: LoginDto, fingerprint: DeviceFingerprint): Promise<TokenPair> {
        const verificationData = await this.verificationService.verifyCode(dto.verificationId, '');

        if (verificationData.purpose !== 'login') {
            throw new BadRequestException('Code de vérification invalide pour la connexion');
        }

        const user = await this.userAuthRepository.findOne({
            where: { phoneNumber: verificationData.phoneNumber },
        });

        if (!user) {
            throw new BadRequestException('Utilisateur non trouvé');
        }

        let deviceId: string;
        if (dto.deviceName && dto.deviceType && dto.publicKey) {
            const device = await this.deviceService.registerDevice({
                userId: user.id,
                deviceName: dto.deviceName,
                deviceType: dto.deviceType,
                publicKey: dto.publicKey,
                ipAddress: fingerprint.ipAddress,
            });
            deviceId = device.id;
        } else {
            deviceId = 'web-session';
        }

        user.lastAuthenticatedAt = new Date();
        await this.userAuthRepository.save(user);

        await this.verificationService.consumeVerification(dto.verificationId);

        return this.tokenService.generateTokenPair(user.id, deviceId, fingerprint);
    }

    async logout(userId: string, deviceId: string): Promise<void> {
        await this.tokenService.revokeAllTokensForDevice(deviceId);

        if (deviceId !== 'web-session') {
            await this.deviceService.updateLastActive(deviceId);
        }
    }
}

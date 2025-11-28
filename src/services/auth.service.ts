import {
    Injectable,
    BadRequestException,
    ConflictException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserAuth } from '../entities/user-auth.entity'
import { Device } from '../entities/device.entity'
import { VerificationService } from './verification.service'
import { TokenService } from './token.service'
import { TwoFactorService } from './two-factor.service'
import { DeviceService } from './device.service'
import {
    VerificationRequestDto,
    VerificationConfirmDto,
    RegisterDto,
    LoginDto,
    RefreshTokenDto,
    ScanLoginDto,
} from '../dto/auth.dto'
import {
    TokenPair,
    DeviceFingerprint,
} from '../interfaces/verification.interface'

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(UserAuth)
        private readonly userAuthRepository: Repository<UserAuth>,
        private readonly verificationService: VerificationService,
        private readonly tokenService: TokenService,
        private readonly twoFactorService: TwoFactorService,
        private readonly deviceService: DeviceService
    ) {}

    async requestRegistrationVerification(
        dto: VerificationRequestDto
    ): Promise<{ verificationId: string }> {
        const existingUser = await this.userAuthRepository.findOne({
            where: { phoneNumber: dto.phoneNumber },
        })

        if (existingUser) {
            throw new ConflictException(
                'An account with this phone number already exists.'
            )
        }

        const verificationId =
            await this.verificationService.requestVerification(
                dto.phoneNumber,
                'registration'
            )

        return { verificationId }
    }

    async confirmRegistrationVerification(
        dto: VerificationConfirmDto
    ): Promise<{ verified: boolean }> {
        await this.verificationService.verifyCode(dto.verificationId, dto.code)
        return { verified: true }
    }

    async register(
        dto: RegisterDto,
        fingerprint: DeviceFingerprint
    ): Promise<TokenPair> {
        const verificationData = await this.verificationService.verifyCode(
            dto.verificationId,
            ''
        )

        if (verificationData.purpose !== 'registration') {
            throw new BadRequestException(
                "Code de vérification invalide pour l'inscription"
            )
        }

        const existingUser = await this.userAuthRepository.findOne({
            where: { phoneNumber: verificationData.phoneNumber },
        })

        if (existingUser) {
            throw new ConflictException(
                'Un compte existe déjà avec ce numéro de téléphone'
            )
        }

        const user = this.userAuthRepository.create({
            phoneNumber: verificationData.phoneNumber,
            twoFactorEnabled: false,
            lastAuthenticatedAt: new Date(),
        })

        const savedUser = await this.userAuthRepository.save(user)

        let deviceId: string
        if (dto.deviceName && dto.deviceType && dto.publicKey) {
            const device = await this.deviceService.registerDevice({
                userId: savedUser.id,
                deviceName: dto.deviceName,
                deviceType: dto.deviceType,
                publicKey: dto.publicKey,
                ipAddress: fingerprint.ipAddress,
            })
            deviceId = device.id
        } else {
            deviceId = 'web-session'
        }

        await this.verificationService.consumeVerification(dto.verificationId)

        return this.tokenService.generateTokenPair(
            savedUser.id,
            deviceId,
            fingerprint
        )
    }

    async requestLoginVerification(
        dto: VerificationRequestDto
    ): Promise<{ verificationId: string }> {
        const user = await this.userAuthRepository.findOne({
            where: { phoneNumber: dto.phoneNumber },
        })

        if (!user) {
            throw new BadRequestException(
                'Aucun compte trouvé avec ce numéro de téléphone'
            )
        }

        const verificationId =
            await this.verificationService.requestVerification(
                dto.phoneNumber,
                'login'
            )

        return { verificationId }
    }

    async confirmLoginVerification(
        dto: VerificationConfirmDto
    ): Promise<{ verified: boolean; requires2FA: boolean }> {
        const verificationData = await this.verificationService.verifyCode(
            dto.verificationId,
            dto.code
        )

        const user = await this.userAuthRepository.findOne({
            where: { phoneNumber: verificationData.phoneNumber },
        })

        if (!user) {
            throw new BadRequestException('Utilisateur non trouvé')
        }

        return {
            verified: true,
            requires2FA: user.twoFactorEnabled,
        }
    }

    async login(
        dto: LoginDto,
        fingerprint: DeviceFingerprint
    ): Promise<TokenPair> {
        const verificationData = await this.verificationService.verifyCode(
            dto.verificationId,
            ''
        )

        if (verificationData.purpose !== 'login') {
            throw new BadRequestException(
                'Code de vérification invalide pour la connexion'
            )
        }

        const user = await this.userAuthRepository.findOne({
            where: { phoneNumber: verificationData.phoneNumber },
        })

        if (!user) {
            throw new BadRequestException('Utilisateur non trouvé')
        }

        let deviceId: string
        if (dto.deviceName && dto.deviceType && dto.publicKey) {
            const device = await this.deviceService.registerDevice({
                userId: user.id,
                deviceName: dto.deviceName,
                deviceType: dto.deviceType,
                publicKey: dto.publicKey,
                ipAddress: fingerprint.ipAddress,
            })
            deviceId = device.id
        } else {
            deviceId = 'web-session'
        }

        user.lastAuthenticatedAt = new Date()
        await this.userAuthRepository.save(user)

        await this.verificationService.consumeVerification(dto.verificationId)

        return this.tokenService.generateTokenPair(
            user.id,
            deviceId,
            fingerprint
        )
    }

    async refreshToken(
        dto: RefreshTokenDto,
        fingerprint: DeviceFingerprint
    ): Promise<TokenPair> {
        return this.tokenService.refreshAccessToken(
            dto.refreshToken,
            fingerprint
        )
    }

    async logout(userId: string, deviceId: string): Promise<void> {
        await this.tokenService.revokeAllTokensForDevice(deviceId)

        if (deviceId !== 'web-session') {
            await this.deviceService.updateLastActive(deviceId)
        }
    }

    async scanLogin(
        dto: ScanLoginDto,
        fingerprint: DeviceFingerprint
    ): Promise<TokenPair> {
        const challengeData = await this.deviceService.validateQRChallenge(
            dto.challenge,
            dto.authenticatedDeviceId
        )

        let deviceId: string
        if (dto.deviceName && dto.deviceType) {
            const device = await this.deviceService.registerDevice({
                userId: challengeData.userId,
                deviceName: dto.deviceName,
                deviceType: dto.deviceType,
                publicKey: challengeData.publicKey,
                ipAddress: fingerprint.ipAddress,
            })
            deviceId = device.id
        } else {
            deviceId = 'web-session'
        }

        const user = await this.userAuthRepository.findOne({
            where: { id: challengeData.userId },
        })
        if (user) {
            user.lastAuthenticatedAt = new Date()
            await this.userAuthRepository.save(user)
        }

        return this.tokenService.generateTokenPair(
            challengeData.userId,
            deviceId,
            fingerprint
        )
    }

    async getUserDevices(userId: string): Promise<Device[]> {
        return this.deviceService.getUserDevices(userId)
    }

    async revokeDevice(userId: string, deviceId: string): Promise<void> {
        await this.deviceService.revokeDevice(userId, deviceId)
        await this.tokenService.revokeAllTokensForDevice(deviceId)
    }
}

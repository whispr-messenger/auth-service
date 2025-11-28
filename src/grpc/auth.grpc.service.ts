import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserAuth } from '../entities/user-auth.entity'
import { AuthService } from '../services/auth.service'
import { TokenService } from '../services/token.service'
import { DeviceService } from '../services/device.service'
import { TwoFactorService } from '../services/two-factor.service'
import { VerificationService } from '../services/verification.service'

// gRPC interfaces
interface GrpcCall<T = any> {
    request: T
}

type GrpcCallback<T = any> = (error: any, response: T) => void

interface ValidateTokenRequest {
    token: string
}

interface RefreshTokenRequest {
    refresh_token: string
    device_id: string
}

interface LoginRequest {
    phone_number: string
    verification_id: string
    device_info: any
}

interface GetUserInfoRequest {
    user_id: string
}

interface CheckPermissionRequest {
    user_id: string
    resource: string
    action: string
    service_name: string
}

interface RegisterDeviceRequest {
    user_id: string
    device_name: string
    device_type: string
    public_key: string
    ip_address: string
}

interface RevokeDeviceRequest {
    user_id: string
    device_id: string
}

interface VerifyTwoFactorRequest {
    user_id: string
    code: string
}

interface GenerateQRCodeRequest {
    device_id: string
}

interface ValidateQRCodeRequest {
    challenge_id: string
    device_info: any
}

@Injectable()
export class AuthGrpcService {
    constructor(
        @InjectRepository(UserAuth)
        private readonly userAuthRepository: Repository<UserAuth>,
        private readonly authService: AuthService,
        private readonly tokenService: TokenService,
        private readonly deviceService: DeviceService,
        private readonly twoFactorService: TwoFactorService,
        private readonly verificationService: VerificationService
    ) {}

    async validateToken(
        call: GrpcCall<ValidateTokenRequest>,
        callback: GrpcCallback
    ) {
        try {
            const { token } = call.request

            const payload = this.tokenService.validateToken(token)

            if (!payload) {
                return callback(null, {
                    valid: false,
                    error: 'Invalid token',
                })
            }

            const userInfo = await this.userAuthRepository.findOne({
                where: { id: payload.sub },
            })
            if (!userInfo) {
                return callback(null, {
                    valid: false,
                    error: 'User not found',
                })
            }

            callback(null, {
                valid: true,
                user_id: payload.sub,
                expires_at: payload.exp,
                error: null,
            })
        } catch (error) {
            callback(null, {
                valid: false,
                error: error.message,
            })
        }
    }

    async refreshToken(
        call: GrpcCall<RefreshTokenRequest>,
        callback: GrpcCallback
    ) {
        try {
            const { refresh_token } = call.request

            const result = await this.tokenService.refreshAccessToken(
                refresh_token,
                {
                    userAgent: 'grpc-client',
                    ipAddress: '127.0.0.1',
                    deviceType: 'server',
                    timestamp: Date.now(),
                }
            )

            callback(null, {
                success: true,
                access_token: result.accessToken,
                refresh_token: result.refreshToken,
                expires_at: Math.floor(Date.now() / 1000) + 3600,
                error: null,
            })
        } catch (error) {
            callback(null, {
                success: false,
                error: error.message,
            })
        }
    }

    async login(call: GrpcCall<LoginRequest>, callback: GrpcCallback) {
        try {
            const { phone_number, verification_id, device_info } = call.request

            const loginDto = {
                phoneNumber: phone_number,
                verificationId: verification_id,
            }

            const tokens = await this.authService.login(loginDto, device_info)

            callback(null, {
                success: true,
                access_token: tokens.accessToken,
                refresh_token: tokens.refreshToken,
                expires_at: Math.floor(Date.now() / 1000) + 3600,
                error: null,
            })
        } catch (error) {
            callback(null, {
                success: false,
                error: error.message,
            })
        }
    }

    async getUserInfo(
        call: GrpcCall<GetUserInfoRequest>,
        callback: GrpcCallback
    ) {
        try {
            const { user_id } = call.request

            const user = await this.userAuthRepository.findOne({
                where: { id: user_id },
            })
            if (!user) {
                return callback(null, {
                    success: false,
                    error: 'User not found',
                })
            }

            callback(null, {
                success: true,
                user: {
                    id: user.id,
                    phone_number: user.phoneNumber,
                    roles: [],
                    created_at: user.createdAt.getTime(),
                },
                error: null,
            })
        } catch (error) {
            callback(null, {
                success: false,
                error: error.message,
            })
        }
    }

    async getUserProfile(
        call: GrpcCall<GetUserInfoRequest>,
        callback: GrpcCallback
    ) {
        try {
            const { user_id } = call.request

            const user = await this.userAuthRepository.findOne({
                where: { id: user_id },
            })
            if (!user) {
                return callback(null, {
                    success: false,
                    error: 'User not found',
                })
            }

            callback(null, {
                success: true,
                profile: {
                    id: user.id,
                    phone_number: user.phoneNumber,
                    roles: [],
                    two_factor_enabled: user.twoFactorEnabled,
                    created_at: user.createdAt.getTime(),
                },
                error: null,
            })
        } catch (error) {
            callback(null, {
                success: false,
                error: error.message,
            })
        }
    }

    async checkPermission(
        call: GrpcCall<CheckPermissionRequest>,
        callback: GrpcCallback
    ) {
        try {
            const { user_id, resource, action } = call.request

            const user = await this.userAuthRepository.findOne({
                where: { id: user_id },
            })
            if (!user) {
                return callback(null, {
                    has_permission: false,
                    error: 'User not found',
                })
            }

            const hasPermission = this.checkUserPermission([], resource, action)

            callback(null, {
                has_permission: hasPermission,
                message: hasPermission
                    ? 'Permission granted'
                    : 'Permission denied',
                error: null,
            })
        } catch (error) {
            callback(null, {
                has_permission: false,
                error: error.message,
            })
        }
    }

    async registerDevice(
        call: GrpcCall<RegisterDeviceRequest>,
        callback: GrpcCallback
    ) {
        try {
            const {
                user_id,
                device_name,
                device_type,
                public_key,
                ip_address,
            } = call.request

            const device = await this.deviceService.registerDevice({
                userId: user_id,
                deviceName: device_name,
                deviceType: device_type,
                publicKey: public_key,
                ipAddress: ip_address,
            })

            callback(null, {
                success: true,
                device: {
                    id: device.id,
                    user_id: device.userId,
                    name: device.deviceName,
                    type: device.deviceType,
                    user_agent: device.model || '',
                    is_verified: device.isVerified,
                    last_seen: device.lastActive
                        ? device.lastActive.getTime()
                        : null,
                    registered_at: device.createdAt.getTime(),
                },
                error: null,
            })
        } catch (error) {
            callback(null, {
                success: false,
                error: error.message,
            })
        }
    }

    async revokeDevice(
        call: GrpcCall<RevokeDeviceRequest>,
        callback: GrpcCallback
    ) {
        try {
            const { user_id, device_id } = call.request

            await this.deviceService.revokeDevice(user_id, device_id)

            callback(null, {
                success: true,
                error: null,
            })
        } catch (error) {
            callback(null, {
                success: false,
                error: error.message,
            })
        }
    }

    async getUserDevices(
        call: GrpcCall<GetUserInfoRequest>,
        callback: GrpcCallback
    ) {
        try {
            const { user_id } = call.request

            const devices = await this.deviceService.getUserDevices(user_id)

            callback(null, {
                success: true,
                devices: devices.map((device) => ({
                    id: device.id,
                    user_id: device.userId,
                    name: device.deviceName,
                    type: device.deviceType,
                    user_agent: device.model || '',
                    is_active: device.isActive,
                    last_seen: device.lastActive
                        ? device.lastActive.getTime()
                        : null,
                    registered_at: device.createdAt.getTime(),
                })),
                error: null,
            })
        } catch (error) {
            callback(null, {
                success: false,
                error: error.message,
            })
        }
    }

    async verifyTwoFactor(
        call: GrpcCall<VerifyTwoFactorRequest>,
        callback: GrpcCallback
    ) {
        try {
            const { user_id, code } = call.request

            const isValid = await this.twoFactorService.verifyTwoFactor(
                user_id,
                code
            )

            callback(null, {
                valid: isValid,
                error: null,
            })
        } catch (error) {
            callback(null, {
                valid: false,
                error: error.message,
            })
        }
    }

    async generateQRCode(
        call: GrpcCall<GenerateQRCodeRequest>,
        callback: GrpcCallback
    ) {
        try {
            const { device_id } = call.request

            const challenge =
                await this.deviceService.generateQRChallenge(device_id)

            callback(null, {
                success: true,
                qr_code_data: challenge,
                challenge_id: challenge,
                expires_at: Math.floor(Date.now() / 1000) + 300,
                error: null,
            })
        } catch (error) {
            callback(null, {
                success: false,
                error: error.message,
            })
        }
    }

    async validateQRCode(
        call: GrpcCall<ValidateQRCodeRequest>,
        callback: GrpcCallback
    ) {
        try {
            const { challenge_id, device_info } = call.request

            const result = await this.deviceService.validateQRChallenge(
                challenge_id,
                device_info
            )

            callback(null, {
                valid: true,
                success: true,
                access_token: 'mock_access_token',
                refresh_token: 'mock_refresh_token',
                device: {
                    id: result.deviceId,
                    user_id: result.userId,
                    name: 'Device Name',
                    type: 'mobile',
                    user_agent: 'Mock Agent',
                    is_active: true,
                    last_seen: Date.now(),
                    registered_at: Date.now(),
                },
                error: null,
            })
        } catch (error) {
            callback(null, {
                valid: false,
                success: false,
                error: error.message,
            })
        }
    }

    private checkUserPermission(
        roles: string[],
        resource: string,
        action: string
    ): boolean {
        const rolePermissions = {
            user: [
                'read:profile',
                'update:profile',
                'read:messages',
                'create:messages',
                'read:media',
                'upload:media',
            ],
            moderator: [
                'read:profile',
                'update:profile',
                'read:messages',
                'create:messages',
                'delete:messages',
                'read:media',
                'upload:media',
                'delete:media',
            ],
        }

        const permissionKey = `${action}:${resource}`

        return roles.some((role) => {
            const permissions = (rolePermissions as any)[role] || []
            return permissions.includes(permissionKey)
        })
    }
}

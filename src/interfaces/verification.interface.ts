export interface VerificationCode {
    phoneNumber: string
    hashedCode: string
    purpose: 'registration' | 'login' | 'recovery'
    attempts: number
    expiresAt: number
}

export interface RevokedToken {
    revokedAt: number
}

export interface JwtPayload {
    sub: string
    iat: number
    exp: number
    deviceId: string
    scope: string
    fingerprint: string
}

export interface TokenPair {
    accessToken: string
    refreshToken: string
}

export interface DeviceFingerprint {
    userAgent?: string
    ipAddress?: string
    deviceType?: string
    timestamp: number
}

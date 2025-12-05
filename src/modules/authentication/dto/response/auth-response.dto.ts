export class AuthResponseDto {
    accessToken: string
    refreshToken: string
    expiresIn: number
    tokenType: string = 'Bearer'
    user: {
        id: string
        phoneNumber: string
        firstName?: string
        lastName?: string
        twoFactorEnabled: boolean
    }
    device: {
        id: string
        deviceName: string
        deviceType: string
        isVerified: boolean
    }
}

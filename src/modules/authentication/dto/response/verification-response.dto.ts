export class VerificationResponseDto {
    verificationId: string
    expiresAt: Date
    attemptsRemaining: number
    message: string
}

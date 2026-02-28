# System Features

The Authentication Service (auth-service) provides a robust set of features for user identity management, multi-device synchronization, and end-to-end security.

## Core Authentication
- **Phone Number Verification**: Registration and login using SMS-based verification (integration with Twilio/Vonage).
- **Stateless JWT**: Issuance and validation of Access and Refresh tokens using ECDSA (P-256) signing.
- **Session Management**: Full control over active sessions with automatic token rotation and revocation.

## Security & 2FA
- **Two-Factor Authentication (2FA)**: Support for TOTP (Google Authenticator, etc.) with QR code setup.
- **Backup Codes**: Generation and management of emergency recovery codes for 2FA.
- **Brute Force Protection**: Rate limiting and account lockout mechanisms.
- **Audit Logs**: Comprehensive history of login attempts and security events.

## Multi-Device Management
- **Device Registration**: Automatic fingerprinting and registration of new devices (iOS, Android, Web).
- **Remote Logout**: Ability for users to view and revoke access for any of their active devices.
- **QR Code Login**: Quick authentication on a new device by scanning a challenge from an already authenticated device.

## End-to-End Encryption (Signal Protocol)
- **Identity Keys**: Management of long-term identity keys for cryptographic verification.
- **PreKeys System**: Storage and distribution of PreKeys and Signed PreKeys to enable asynchronous session establishment.
- **Multi-Device Sync**: Cryptographic synchronization of conversation states across all user devices.

---

**Technical details:**
- [Database Schema](../reference/database-schema.md)
- [System Architecture](../explanation/system-design.md)

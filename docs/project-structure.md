# Structure du projet

```
src/
├── config/           # Configuration (Redis, JWT)
├── decorators/       # Décorateurs custom
├── interceptors/     # Intercepteurs (logging)
├── modules/
│   ├── phone-verification/  # OTP par SMS
│   ├── phone-auth/          # Login/register
│   ├── tokens/              # JWT management
│   ├── devices/             # Device management
│   │   └── quick-response-code/  # QR Code
│   ├── two-factor-authentication/  # 2FA
│   ├── signal/              # Signal Protocol
│   ├── jwks/                # Clés publiques
│   ├── cache/               # Cache Redis
│   └── health/              # Health checks
├── migrations/       # Migrations TypeORM
└── main.ts           # Point d'entrée
```

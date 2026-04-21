# Authentification à deux facteurs (2FA)

## Flux d'activation

```
User ──▶ GET /auth/2fa/setup ──▶ QR Code TOTP
                                      │
User ──▶ POST /auth/2fa/verify ──▶ Code TOTP
                                      │
                                 2FA activé
```

## Flux de login avec 2FA

```
Login normal ──▶ Token temporaire ──▶ POST /auth/2fa/validate
                                            │
                                      Code TOTP valide?
                                       oui  │  non
                                       ┌────┼────┐
                                       │         │
                                   JWT tokens   Rejeté
```

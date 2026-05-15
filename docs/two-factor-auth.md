# Authentification à deux facteurs (2FA)

## Endpoints

```
POST /auth/v1/2fa/setup         — Générer le secret TOTP
POST /auth/v1/2fa/enable        — Activer le 2FA
POST /auth/v1/2fa/verify        — Vérifier un code TOTP
POST /auth/v1/2fa/disable       — Désactiver le 2FA
POST /auth/v1/2fa/backup-codes  — Générer des codes de secours
GET  /auth/v1/2fa/status        — Statut du 2FA
```

## Flux d'activation

```
User ──▶ POST /auth/v1/2fa/setup ──▶ QR Code TOTP
                                          │
User ──▶ POST /auth/v1/2fa/enable ──▶ Code TOTP
                                          │
                                     2FA activé
```

## Flux de login avec 2FA

```
Login normal ──▶ Token temporaire ──▶ POST /auth/v1/2fa/verify
                                            │
                                      Code TOTP valide?
                                       oui  │  non
                                       ┌────┼────┐
                                       │         │
                                   JWT tokens   Rejeté
```

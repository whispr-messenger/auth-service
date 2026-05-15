# Codes d'erreur

## Authentification

| Code HTTP | Message | Description |
|-----------|---------|-------------|
| 400 | Invalid phone number | Numéro de téléphone invalide |
| 400 | Code already confirmed | Code déjà utilisé |
| 401 | Unauthorized | Token manquant ou invalide |
| 403 | 2FA required | Authentification 2FA nécessaire |
| 429 | Too many requests | Rate limit atteint |

## Tokens

| Code HTTP | Message | Description |
|-----------|---------|-------------|
| 401 | Token expired | Access token expiré |
| 401 | Token revoked | Token révoqué |
| 400 | Invalid refresh token | Refresh token invalide |

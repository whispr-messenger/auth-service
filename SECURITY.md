# Sécurité

## Signaler une vulnérabilité

Si vous découvrez une faille de sécurité, ne créez pas d'issue publique. Contactez l'équipe directement.

## Mesures en place

- Tokens JWT signés avec des clés EC P-256
- Refresh tokens avec rotation automatique
- Rate limiting sur les endpoints sensibles
- Validation stricte des entrées
- Hashage des codes de vérification
- 2FA TOTP disponible
- Gestion des devices avec fingerprinting

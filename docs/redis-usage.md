# Utilisation Redis

## Clés stockées

| Pattern | Usage | TTL |
|---------|-------|-----|
| `rate:phone:{number}` | Rate limit vérification | 5min |
| `token:revoked:{jti}` | Tokens révoqués | 7 jours |
| `session:{userId}` | Sessions actives | 24h |
| `2fa:temp:{userId}` | Token temporaire 2FA | 5min |

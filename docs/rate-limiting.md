# Rate Limiting

## Endpoints protégés

```
POST /auth/phone/verify  ──▶ 3 req / 5min (par numéro)
POST /auth/phone/confirm ──▶ 5 tentatives / code
POST /auth/tokens/refresh──▶ 10 req / min
```

## Stockage

Les compteurs de rate limit sont stockés dans Redis avec un TTL automatique.

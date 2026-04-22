# Rate Limiting

## Endpoints protégés

```
POST /auth/v1/verify/*           ──▶ Limité par numéro de téléphone
POST /auth/v1/tokens/refresh     ──▶ Limité par utilisateur
POST /auth/v1/login              ──▶ Limité par IP
```

Les seuils exacts sont configurés via le module Throttler de NestJS.

## Stockage

Les compteurs de rate limit sont stockés dans Redis avec un TTL automatique.

# Communication inter-services

## Services qui dépendent de l'auth-service

```
auth-service (JWKS endpoint)
     │
     ├──▶ messaging-service (vérif tokens)
     ├──▶ user-service (vérif tokens)
     ├──▶ notification-service (vérif tokens)
     ├──▶ scheduling-service (vérif tokens)
     └──▶ media-service (vérif tokens)
```

Tous les services récupèrent les clés publiques via `GET /auth/.well-known/jwks.json`.

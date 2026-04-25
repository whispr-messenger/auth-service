# Cycle de vie des tokens

## Types

| Token | Durée | Stockage |
|-------|-------|----------|
| Access token | 15 min | Client side |
| Refresh token | 7 jours | Client + DB |

## Rotation

```
Access expiré ──▶ POST /auth/v1/tokens/refresh
                       │
                 ┌─────▼──────┐
                 │ Ancien     │
                 │ refresh    │──▶ Révoqué
                 │ token      │
                 └─────┬──────┘
                       │
                 ┌─────▼──────┐
                 │ Nouveau    │
                 │ access +   │
                 │ refresh    │
                 └────────────┘
```

La rotation automatique empêche la réutilisation d'un ancien refresh token.

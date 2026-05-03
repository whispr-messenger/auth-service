# Architecture JWT

## Flux de vérification

```
Client ──▶ Requête + Bearer token
                │
          ┌─────▼──────┐
          │ Extraction  │
          │ du token    │
          └─────┬──────┘
                │
          ┌─────▼──────┐
          │ Vérif       │
          │ signature   │
          │ (EC P-256)  │
          └─────┬──────┘
                │
          ┌─────▼──────┐
          │ Vérif       │
          │ expiration  │
          └─────┬──────┘
                │
          ┌─────▼──────┐
          │ Vérif       │
          │ révocation  │
          │ (Redis)     │
          └─────┬──────┘
                │
          Token valide
```

# Health Checks

## Endpoint

```
GET /health
```

## Composants vérifiés

| Composant | Vérification |
|-----------|-------------|
| PostgreSQL | Connexion active |
| Redis | Ping répondu |

## Réponse

```json
{
  "status": "ok",
  "database": "up",
  "redis": "up"
}
```

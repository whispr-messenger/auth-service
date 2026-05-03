# Health Checks

## Endpoints

```
GET /auth/v1/health        - Health check principal
GET /auth/v1/health/ready  - Readiness probe (K8s)
GET /auth/v1/health/live   - Liveness probe (K8s)
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

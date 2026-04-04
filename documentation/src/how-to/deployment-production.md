# Production Deployment Guide

The production reference environment for `auth-service` is Kubernetes with ArgoCD. The files under `docker/prod/` are useful for local image validation, but they are not the source of truth for production orchestration.

## Kubernetes Production

Production deployments should follow these rules:

- `DB_SYNCHRONIZE=false`
- `DB_MIGRATIONS_RUN=false` on the application pod
- run `npm run migration:run` from a dedicated migration job or deployment step before serving traffic
- use Kubernetes-managed secrets for JWT keys and external credentials

### JWT Key Generation

Generate your own ECDSA P-256 keypair for production:

```bash
openssl ecparam -genkey -name prime256v1 -noout -out private-key.pem
openssl ec -in private-key.pem -pubout -out public-key.pem
```

## Database

- Schema changes are managed by TypeORM migrations in `src/modules/app/migrations/`.
- Do not rely on ad hoc SQL files to create auth-service tables in production.
- Use `npm run migration:run` to apply pending migrations.
- Never enable `synchronize: true` in production.
- Implement regular `pg_dump` backups.

## Redis

- Use Redis Sentinel for high availability.
- Ensure `REDIS_PASSWORD` is strong and unique.

## Infrastructure

- Ensure Istio `PeerAuthentication` is set to `STRICT`.
- Assign at least 1 vCPU and 2 GiB RAM per replica on critical environments.

## Monitoring

- Monitor `/auth/v1/health/ready`.
- Expose `:3001/metrics` when metrics are enabled.
- Ship application logs to a centralized log platform.

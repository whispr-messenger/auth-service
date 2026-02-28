# Production Deployment Guide

This guide describes how to deploy the Authentication Service in a production-like environment using Docker Compose.

## 🐳 Docker Deployment

The production setup uses a optimized `Dockerfile` and a hardened `compose.yml`.

### 1. Build the Image
```bash
just up prod
```
This command uses `docker/prod/compose.yml` to build and launch the containers.

### 2. Environment Configuration
Ensure your `.env` file in `docker/prod/` is properly configured. Key variables:
- `NODE_ENV=production`
- `DB_SYNCHRONIZE=false`
- `DB_MIGRATIONS_RUN=true`
- `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` (ECDSA P-256)

### 3. JWT Key Generation (Mandatory)
For production, you **must** generate your own keys. Do not use the defaults.
```bash
# Generate private key
openssl ecparam -genkey -name prime256v1 -noout -out private-key.pem

# Generate public key
openssl ec -in private-key.pem -pubout -out public-key.pem
```

## 🔒 Security Best Practices

### Database
- **Migrations**: Always use `npm run migration:run`. Never use `synchronize: true`.
- **Backups**: Implement a regular `pg_dump` schedule.

### Redis
- Use **Redis Sentinel** for high availability.
- Ensure `REDIS_PASSWORD` is strong and unique.

### Infrastructure (Kubernetes/Istio)
While Docker Compose is used for standalone deployments, the primary production environment is Kubernetes with Istio:
- **mTLS**: Ensure Istio `PeerAuthentication` is set to `STRICT`.
- **Resources**: Assign at least 1vCPU and 2GB RAM per replica.

## 📊 Monitoring

- **Health Checks**: Monitor `/auth/v1/health/ready`.
- **Metrics**: Prometheus metrics are available at `:3001/metrics` (if enabled).
- **Logs**: Use a log aggregator (Loki, ELK) to collect JSON logs from the container.

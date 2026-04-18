# Authentication Service

<!-- [![Quality Gate Status](https://sonarqube.whispr.epitech-msc2026.me/api/project_badges/measure?project=whispr-messenger_auth-service_11813afb-b949-4baf-aa3f-7d12c436cb56&metric=alert_status&token=sqb_447aebc169925a474766cc3247a75fd2b838eeb6)](https://sonarqube.whispr.epitech-msc2026.me/dashboard?id=whispr-messenger_auth-service_11813afb-b949-4baf-aa3f-7d12c436cb56) -->

[![App Status](https://argocd.whispr.epitech.beer/api/badge?name=auth-service&revision=true&showAppName=true)](https://argocd.whispr.epitech.beer/applications/auth-service)

---

- [Documentation](https://whispr-messenger.github.io/auth-service/)
- [Swagger UI](https://whispr.epitech.beer/auth/swagger)
- [ArgoCD UI](https://argocd.whispr.epitech.beer)
- [SonarQube](https://sonarqube.whispr.epitech.beer)

## Table of Contents

- [Description](#description)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Deployment](#deployment)

## Description

This Microservice is responsible for all authentication tasks in the Whispr Messenger system. It handles phone-based authentication, JWT token management, device registration, two-factor authentication (2FA), Signal Protocol key management, and JWKS endpoint exposure for inter-service token verification.

## Tech Stack

- **Runtime** : Node.js 22+
- **Framework** : NestJS + TypeScript
- **Base de données** : PostgreSQL avec TypeORM
- **Cache** : Redis
- **Authentification** : JWT (access + refresh tokens) avec rotation automatique
- **Vérification SMS** : Intégration fournisseur SMS pour OTP
- **Protocole Signal** : Gestion des pre-keys et signed pre-keys
- **Documentation API** : Swagger / OpenAPI
- **CI/CD** : GitHub Actions + ArgoCD
- **Qualité** : ESLint, Prettier, Husky hooks

## Installation

The repository uses `just` a custom recipe runner (like `make` in C lang) to provide useful scripts.

Once you have `just` and `docker` installed in your computer you can start the development server with:

```sh
just up dev
```

## Architecture

```
┌──────────────┐      ┌──────────────┐
│  Mobile App  │─────▶│ Auth Service │
└──────────────┘      └──────┬───────┘
                             │
                 ┌───────────┼───────────┐
                 │           │           │
           ┌─────▼───┐ ┌────▼────┐ ┌────▼────┐
           │ PostgreSQL│ │  Redis  │ │  JWKS   │
           └──────────┘ └─────────┘ └─────────┘
```

### Modules

| Module | Rôle |
|--------|------|
| `phone-verification` | Envoi et validation des codes OTP par SMS |
| `phone-auth` | Login/register via numéro de téléphone |
| `tokens` | Gestion des JWT (access, refresh, révocation) |
| `devices` | Enregistrement et suivi des appareils |
| `two-factor-authentication` | 2FA TOTP |
| `signal` | Gestion des clés Signal Protocol |
| `jwks` | Exposition des clés publiques pour les autres services |

## Configuration

Variables d'environnement principales :

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL |
| `REDIS_HOST` | Hôte Redis |
| `REDIS_PORT` | Port Redis |
| `JWT_SECRET` | Secret pour signer les tokens |
| `SMS_PROVIDER_API_KEY` | Clé API du fournisseur SMS |
| `NODE_ENV` | Environnement (development, production) |

## Testing

```bash
# Tests unitaires
npm test

# Tests e2e
npm run test:e2e

# Couverture
npm run test:cov
```

## Deployment

Le service est déployé via ArgoCD sur un cluster GKE. Le pipeline CI/CD est géré par GitHub Actions.

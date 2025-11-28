# Whispr Messenger - Authentication Microservice

[![Quality Gate Status](https://sonarqube.whispr.epitech-msc2026.me/api/project_badges/measure?project=whispr-messenger_auth-service_11813afb-b949-4baf-aa3f-7d12c436cb56&metric=alert_status&token=sqb_447aebc169925a474766cc3247a75fd2b838eeb6)](https://sonarqube.whispr.epitech-msc2026.me/dashboard?id=whispr-messenger_auth-service_11813afb-b949-4baf-aa3f-7d12c436cb56)

## Description

Microservice d'authentification développé par DALM1 équipe Whispr. Ce service fournit une solution complète d'authentification sécurisée avec support 2FA, gestion multi-appareils et chiffrement Signal Protocol.

## Architecture

### Technologies
- **Framework**: NestJS avec TypeScript
- **Base de données**: PostgreSQL avec TypeORM
- **Cache**: Redis
- **Authentification**: JWT avec clés EC256
- **Chiffrement**: Signal Protocol pour la communication sécurisée
- **Tests**: Jest pour les tests unitaires et d'intégration

### Services Core
- **AuthService**: Gestion de l'authentification et autorisation
- **TokenService**: Génération et validation des tokens JWT
- **VerificationService**: Codes SMS et vérifications de sécurité
- **DeviceService**: Gestion des appareils et liaison multi-devices
- **CryptoService**: Chiffrement Signal Protocol

## Fonctionnalités

### Authentification
- Inscription et connexion sécurisées
- Authentification à deux facteurs (2FA) avec TOTP
- Codes de sauvegarde pour récupération de compte
- Historique des connexions

### Sécurité
- Chiffrement bcrypt pour les mots de passe
- JWT avec révocation de tokens
- Rate limiting par endpoint
- Protection contre les attaques par brute force
- Validation stricte des données d'entrée

### Multi-appareils
- Liaison d'appareils par QR code
- Gestion des clés cryptographiques par appareil
- Synchronisation sécurisée entre appareils
- Limite configurable d'appareils par utilisateur

## Installation

### Prérequis
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Configuration
```bash
# Copier le fichier d'environnement
cp .env.example .env

# Installer les dépendances
npm install

# Configurer la base de données
npm run migration:run
```

### Variables d'environnement
Configurer les variables suivantes dans le fichier `.env`:
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`
- `SMS_API_KEY`, `SMS_API_SECRET`, `SMS_FROM_NUMBER`

## Utilisation

### Développement
```bash
# Mode développement avec rechargement automatique
npm run start:dev

# Tests unitaires
npm run test

# Tests d'intégration
npm run test:e2e

# Couverture de tests
npm run test:cov
```

### Production
```bash
# Build de l'application
npm run build

# Démarrage en production
npm run start:prod

# Avec PM2 (recommandé)
pm2 start ecosystem.config.js --env production
```

## API Endpoints

### Authentification
- `POST /auth/register` - Inscription d'un nouvel utilisateur
- `POST /auth/login` - Connexion utilisateur
- `POST /auth/refresh` - Renouvellement du token d'accès
- `POST /auth/logout` - Déconnexion et révocation des tokens

### Vérification
- `POST /verification/send-sms` - Envoi de code SMS
- `POST /verification/verify-sms` - Vérification du code SMS
- `POST /verification/send-email` - Envoi de code par email
- `POST /verification/verify-email` - Vérification du code email

### 2FA
- `POST /auth/2fa/setup` - Configuration de l'authentification 2FA
- `POST /auth/2fa/verify` - Vérification du code 2FA
- `POST /auth/2fa/disable` - Désactivation de la 2FA
- `GET /auth/2fa/backup-codes` - Génération de codes de sauvegarde

### Appareils
- `GET /devices` - Liste des appareils de l'utilisateur
- `POST /devices/link` - Liaison d'un nouvel appareil
- `DELETE /devices/:id` - Suppression d'un appareil
- `POST /devices/qr-auth` - Authentification par QR code

## Tests

Le projet inclut une suite complète de tests:
- **Tests unitaires**: 36 tests couvrant tous les services
- **Tests d'intégration**: Validation des endpoints API
- **Couverture**: Plus de 90% de couverture de code

Voir le rapport détaillé dans `TEST_REPORT.md`.

## Déploiement

### Docker
```bash
# Build de l'image
docker build -t auth-service .

# Démarrage avec Docker Compose
docker-compose up -d
```

### Production
Consulter le guide détaillé dans `PRODUCTION.md` pour:
- Configuration des variables d'environnement
- Génération des clés JWT
- Configuration du reverse proxy
- Monitoring et maintenance

## Monitoring

### Health Check
- `GET /health` - Vérification de l'état du service
- `GET /health/db` - État de la base de données
- `GET /health/redis` - État du cache Redis

### Métriques
- Endpoint Prometheus: `/metrics`
- Logs structurés avec rotation automatique
- Alertes configurables pour les erreurs critiques

## Sécurité

### Bonnes pratiques implémentées
- Chiffrement des mots de passe avec bcrypt (14 rounds)
- Tokens JWT avec expiration courte
- Rate limiting agressif sur les endpoints sensibles
- Validation stricte des entrées utilisateur
- Headers de sécurité (CORS, CSP, HSTS)
- Audit trail complet des actions utilisateur

### Conformité
- RGPD: Gestion des données personnelles
- OWASP: Protection contre les vulnérabilités communes
- Signal Protocol: Chiffrement bout-en-bout

## Développement

### Structure du projet
```
src/
├── controllers/     # Contrôleurs REST API
├── services/        # Logique métier
├── entities/        # Modèles de données TypeORM
├── dto/            # Objets de transfert de données
├── guards/         # Guards d'authentification
├── interceptors/   # Intercepteurs de requêtes
└── pipes/          # Pipes de validation
```

### Standards de code
- ESLint et Prettier configurés
- Conventions de nommage strictes
- Documentation JSDoc obligatoire
- Tests unitaires pour chaque service

## Support

Pour toute question ou problème:
1. Consulter la documentation technique dans `/documentation`
2. Vérifier les logs d'application
3. Contacter l'équipe de développement Whispr via Teams ou Discord (.env)

## Licence

Ce projet est développé pour l'équipe Whispr. Tous droits réservés.

---

**Développé par DALM1 équipe Whispr**

Version: 1.0.0
Dernière mise à jour - 19/08/2025

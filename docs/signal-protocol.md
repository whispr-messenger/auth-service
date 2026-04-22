# Signal Protocol

## Vue d'ensemble

Le service gère les clés du protocole Signal pour le chiffrement de bout en bout des messages.

## Endpoints

```
POST /auth/v1/signal/keys/signed-prekey    — Upload signed pre-key
POST /auth/v1/signal/keys/prekeys          — Upload one-time pre-keys
GET  /auth/v1/signal/keys/recommendations  — Recommandations de renouvellement
GET  /auth/v1/signal/keys/:userId/devices/:deviceId        — Fetch pre-keys d'un user
GET  /auth/v1/signal/keys/:userId/devices/:deviceId/status — Statut des clés
DELETE /auth/v1/signal/keys/device/:deviceId — Supprimer les clés d'un device
DELETE /auth/v1/signal/keys                 — Supprimer toutes ses clés
```

## Health

```
GET  /auth/v1/signal/health        — Statut du module Signal
POST /auth/v1/signal/health/cleanup — Nettoyage des clés expirées
```

## Flux d'échange de clés

```
User A ──▶ Upload pre-keys ──▶ Auth Service
                                     │
User B ──▶ Fetch pre-keys  ──▶ Auth Service
                                     │
                              Établissement
                              session E2E
```

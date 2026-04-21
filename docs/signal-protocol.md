# Signal Protocol

## Vue d'ensemble

Le service gère les clés du protocole Signal pour le chiffrement de bout en bout des messages.

## Clés gérées

- **Identity Key** — Clé d'identité de l'appareil
- **Signed Pre-Key** — Pré-clé signée (rotation régulière)
- **One-Time Pre-Keys** — Clés à usage unique

## Flux d'échange de clés

```
User A ──▶ Upload pre-keys ──▶ Auth Service
                                     │
User B ──▶ Fetch pre-keys  ──▶ Auth Service
                                     │
                              Établissement
                              session E2E
```

# Gestion des appareils

## Vue d'ensemble

Chaque utilisateur peut avoir plusieurs appareils enregistrés.

## Flux d'enregistrement

```
Login ──▶ Device fingerprint ──▶ Enregistrement
                                       │
                                 ┌─────▼─────┐
                                 │ Device ID  │
                                 │ + metadata │
                                 └───────────┘
```

## QR Code

Les appareils secondaires peuvent être liés via un QR code scanné depuis l'appareil principal.

## Endpoints

```
GET    /auth/v1/device              — Lister ses appareils
DELETE /auth/v1/device/:deviceId    — Supprimer un appareil
POST   /auth/v1/qr-code/challenge/:deviceId — Générer un challenge QR
POST   /auth/v1/qr-code/scan       — Scanner et lier l'appareil
```

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

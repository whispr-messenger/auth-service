# Schéma base de données

## Tables principales

```
┌───────────────┐     ┌──────────────┐
│    users      │────▶│   devices    │
│               │     │              │
│ - id          │     │ - id         │
│ - phone       │     │ - userId     │
│ - createdAt   │     │ - fingerprint│
└───────────────┘     │ - lastActive │
                      └──────────────┘

┌───────────────┐     ┌──────────────┐
│  signal_keys  │     │  totp_secrets│
│               │     │              │
│ - userId      │     │ - userId     │
│ - deviceId    │     │ - secret     │
│ - preKey      │     │ - enabled    │
│ - signedPreKey│     └──────────────┘
└───────────────┘
```

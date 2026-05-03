# Pipeline CI

## Étapes

```
Push ──▶ ESLint ──▶ Prettier ──▶ Tests Unit ──▶ Build ──▶ SonarCloud
                                                    │
                                              Tests E2E
                                              (Docker)
```

## GitHub Actions

Les workflows sont dans `.github/workflows/`.

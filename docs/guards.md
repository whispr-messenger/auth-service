# Guards

## JwtAuthGuard

Vérifie le token JWT sur les routes protégées.

```
Requête ──▶ JwtAuthGuard ──▶ Token valide?
                               oui │ non
                              ┌────┼────┐
                              │        │
                          Controller  401
```

## @Public()

Le décorateur `@Public()` bypass le guard pour les routes publiques (health, JWKS).

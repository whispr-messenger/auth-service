# Stratégie de test

## Pyramide de tests

```
         ┌───────┐
         │  E2E  │  (peu, lents)
         ├───────┤
         │ Integ │  (moyen)
         ├───────┤
         │ Unit  │  (beaucoup, rapides)
         └───────┘
```

## Couverture

Objectif : > 80% de couverture.

## Outils

- Jest pour les tests unitaires
- Supertest pour les tests E2E

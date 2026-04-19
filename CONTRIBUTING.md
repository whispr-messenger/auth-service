# Contribuer au Auth Service

## Prérequis

- Node.js 22+
- Docker
- `just` (task runner)

## Lancer le projet

```bash
just up dev
```

## Conventions de commit

On utilise les conventional commits :

- `feat(scope):` pour les nouvelles fonctionnalités
- `fix(scope):` pour les corrections de bugs
- `docs(scope):` pour la documentation
- `test(scope):` pour les tests
- `refactor(scope):` pour le refactoring

## Lancer les tests

```bash
npm test
npm run test:e2e
```

## Créer une branche

Format : `WHISPR-XXX-description-courte`

## Ouvrir une PR

- Base : `main`
- Titre clair et concis
- Description avec résumé et plan de test

## Qualité de code

- ESLint + Prettier (hooks Husky automatiques)
- SonarQube vérifie la qualité à chaque PR

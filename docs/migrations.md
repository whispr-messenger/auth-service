# Migrations base de données

## Commandes

```bash
# Générer une migration
npm run migration:generate src/migrations/<NomMigration>

# Exécuter les migrations
npm run migration:run

# Annuler la dernière migration
npm run migration:revert
```

## ORM

TypeORM est utilisé pour gérer les migrations et les entités.

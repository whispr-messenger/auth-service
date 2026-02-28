# Database Migrations

This guide explains how to manage schema changes using TypeORM migrations.

## How it Works

In the development environment, migrations are configured to run **automatically** on startup. The `DB_MIGRATIONS_RUN=true` environment variable controls this behavior.

## Creating a New Migration

When you modify an entity in `src/modules/authentication/entities/`, you need to generate a migration:

1. Ensure the service is running: `just up dev`.
2. Generate the migration file:
   ```bash
   just shell
   npm run migration:generate -- src/modules/app/migrations/NameOfYourMigration
   ```
3. A new file will be created in `src/modules/app/migrations/`. Review it to ensure it does exactly what you expect.

## Running Migrations Manually

If you need to run or revert migrations manually:

```bash
# Run pending migrations
npm run migration:run

# Revert the last applied migration
npm run migration:revert
```

## Best Practices

- **Never modify an existing migration file** once it has been committed. Create a new one instead.
- **Check for data loss**: Always review the generated SQL, especially if you are dropping columns or changing types.
- **Production**: In production, `DB_SYNCHRONIZE` is always set to `false`, and migrations are the only way to update the schema.

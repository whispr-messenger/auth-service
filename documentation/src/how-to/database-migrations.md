# Database Migrations

This guide explains how to manage schema changes using TypeORM migrations.

## How it Works

In development, migrations can run automatically on startup with `DB_MIGRATIONS_RUN=true`.

In production, keep `DB_MIGRATIONS_RUN=false` on the application pod and execute migrations from a dedicated job or deployment step before the new version serves traffic.

## Creating a New Migration

When you modify an entity, generate a migration:

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
- **Production**: `DB_SYNCHRONIZE` must stay `false`, and migrations are the only supported way to update the schema.
- **Bootstrap**: migrations should be self-sufficient on a fresh PostgreSQL database. If a migration depends on an extension such as `pgcrypto`, install it from a migration rather than an external SQL script.

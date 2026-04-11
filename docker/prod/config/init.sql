-- Production schema bootstrap is managed by TypeORM migrations.
-- Do not define auth-service tables, indexes, or triggers in this file.
--
-- If you provision a brand-new PostgreSQL instance manually, keep this file
-- limited to database-level prerequisites that are safe to run before:
--   npm run migration:run
--
-- Current migration prerequisites:
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION auth_user;

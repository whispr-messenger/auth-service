-- Test database initialization
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO test;
GRANT ALL ON SCHEMA public TO public;

-- Create application schema
CREATE SCHEMA IF NOT EXISTS auth;
GRANT ALL ON SCHEMA auth TO test;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

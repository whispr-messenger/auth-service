-- Script d'initialisation PostgreSQL pour dev container

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Créer la base de données de test
CREATE DATABASE whispr_auth_test OWNER dev_user;

-- Permissions
GRANT ALL PRIVILEGES ON DATABASE whispr_auth_dev TO dev_user;
GRANT ALL PRIVILEGES ON DATABASE whispr_auth_test TO dev_user;

-- Se connecter à la DB dev
\c whispr_auth_dev;

-- Créer le schéma et les permissions
GRANT CREATE ON SCHEMA public TO dev_user;
GRANT USAGE ON SCHEMA public TO dev_user;

---
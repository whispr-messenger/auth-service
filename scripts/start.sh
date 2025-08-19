#!/bin/bash

# Script de démarrage du microservice d'authentification

set -e

echo "⚡️ Démarrage du microservice d'authentification"

# Vérifier que les variables d'environnement sont définies
if [ ! -f .env ]; then
    echo "Fichier .env manquant. Copiez .env.example vers .env et configurez les variables."
    exit 1
fi

# Vérifier que Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo "Docker n'est pas en cours d'exécution. Veuillez démarrer Docker."
    exit 1
fi

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo " Installation des dépendances..."
    npm install
fi

# Construire l'application
echo " Construction de l'application..."
npm run build

# Démarrer PostgreSQL et Redis
echo " Démarrage de PostgreSQL et Redis..."
docker-compose up -d postgres redis

# Attendre que les services soient prêts
echo " Attente que les services soient prêts..."
sleep 10

# Vérifier la connexion à PostgreSQL
echo " Vérification de la connexion à PostgreSQL..."
until docker-compose exec postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "En attente de PostgreSQL..."
    sleep 2
done

# Vérifier la connexion à Redis
echo " Vérification de la connexion à Redis..."
until docker-compose exec redis redis-cli ping > /dev/null 2>&1; do
    echo "En attente de Redis..."
    sleep 2
done

echo " Services de base de données prêts!"

echo "⚡️ Démarrage du microservice d'authentification"
npm run start:dev

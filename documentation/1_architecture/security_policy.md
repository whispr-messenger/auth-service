# Politique de Sécurité - Service d'Authentification 

## 1. Introduction

### 1.1 Objectif du Document
Cette politique de sécurité définit les mesures techniques et pratiques à implémenter pour protéger le service d'authentification (Identity Service) de l'application Whispr dans le cadre de notre projet de fin d'études.

### 1.2 Contexte et Importance
Le service d'authentification constitue la première ligne de défense de notre application. Il gère les informations d'identification des utilisateurs, les sessions, et les clés cryptographiques pour le chiffrement de bout en bout.

### 1.3 Principes Fondamentaux
- **Défense en profondeur**: Multiples couches de sécurité
- **Moindre privilège**: Accès limité au minimum nécessaire
- **Sécurité par conception**: Considérations de sécurité intégrées dès la conception
- **Transparence**: Documentation claire des mesures de sécurité
- **Mise en œuvre réaliste**: Implémentation adaptée à nos contraintes de projet

## 2. Gestion des Identités et des Accès

### 2.1 Authentification des Utilisateurs

#### 2.1.1 Vérification du Numéro de Téléphone
- Codes de vérification à 6 chiffres générés aléatoirement
- Validité limitée à 15 minutes
- Maximum de 5 tentatives avant blocage temporaire
- Envoi via un service SMS externe (Twilio ou équivalent)

#### 2.1.2 Authentification à Deux Facteurs (2FA)
- Implémentation du standard TOTP (RFC 6238)
- Utilisation de l'algorithme HMAC-SHA1 avec une longueur de 6 chiffres
- Intervalle de 30 secondes avec tolérance de ±1 intervalle
- Possibilité de générer jusqu'à 10 codes de secours

#### 2.1.3 Authentification Multi-Appareils
- Mécanisme de scan QR pour appairer les appareils
- Vérification croisée nécessitant un appareil déjà authentifié
- Challenge cryptographique à courte durée de vie (5 minutes)
- Possibilité de révoquer les appareils à distance

### 2.2 Gestion des Sessions

#### 2.2.1 Tokens d'Authentification
- Architecture basée sur JWT (JSON Web Tokens)
- Tokens d'accès de courte durée (1 heure)
- Tokens de rafraîchissement de longue durée (30 jours)
- Signature avec algorithme ES256 (ECDSA avec P-256 et SHA-256)
- Inclusion du fingerprint de l'appareil dans les claims du token

#### 2.2.2 Révocation et Invalidation
- Stockage des tokens révoqués dans une liste noire Redis
- Révocation en cascade des tokens enfants
- Invalidation automatique en cas de changement de mot de passe
- Possibilité de mettre fin à toutes les sessions à distance

## 3. Chiffrement et Protection des Données

### 3.1 Chiffrement au Repos

#### 3.1.1 Données Sensibles dans PostgreSQL
- Chiffrement des colonnes sensibles avec AES-256-GCM:
  - Secrets TOTP (twoFactorSecret)
  - Clés privées (privateKeyEncrypted)
- Utilisation d'un module de chiffrement Node.js standard (crypto)
- Stockage des clés de chiffrement dans des variables d'environnement

#### 3.1.2 Données Temporaires dans Redis
- Hachage des codes de vérification avec bcrypt (facteur de coût 10)
- TTL strict sur toutes les données temporaires sensibles
- Aucun stockage en clair des codes de sécurité

### 3.2 Chiffrement en Transit

#### 3.2.1 Communications Externes
- TLS 1.3 configuré pour toutes les communications API
- Certificats auto-signés pour le développement, certificats Let's Encrypt pour production
- Configuration des suites de chiffrement sécurisées
- HSTS pour forcer HTTPS

#### 3.2.2 Communications Inter-Services
- TLS pour les communications gRPC entre services
- Authentification des services via tokens ou certificats
- Validation des requêtes inter-services

### 3.3 Chiffrement de Bout en Bout (E2E)

#### 3.3.1 Implémentation du Protocole Signal
- Double Ratchet Algorithm pour la confidentialité persistante
- Courbes elliptiques X25519 pour l'échange de clés Diffie-Hellman
- Triple DHE pour l'établissement des sessions
- HMAC-SHA256 pour l'authentification des messages

#### 3.3.2 Gestion des Clés Cryptographiques
- Génération de 100 prekeys par utilisateur
- Rotation obligatoire des clés d'identité tous les 6 mois
- Destruction sécurisée des clés expirées
- Vérification des empreintes cryptographiques entre appareils

## 4. Protection Contre les Menaces

### 4.1 Contrôle des Accès et Rate Limiting

#### 4.1.1 Limitation de Débit (Rate Limiting)
- Implémentation du module @nestjs/throttler pour le rate limiting
- Limitation par IP: maximum 30 requêtes/minute sur les endpoints d'authentification
- Limitation par utilisateur: maximum 10 tentatives de vérification/heure
- Limitation par téléphone: maximum 5 envois de SMS/heure
- Délai progressif après échecs d'authentification répétés

#### 4.1.2 Détection des Comportements Anormaux
- Journalisation des tentatives d'authentification
- Alerte simple pour les tentatives répétées échouées
- Vérification basique de l'origine des connexions

### 4.2 Protection Contre les Attaques Courantes

#### 4.2.1 Injection et XSS
- Validation des entrées avec class-validator dans NestJS
- Utilisation de TypeORM avec requêtes paramétrées
- Configuration des headers de sécurité:
  - Content-Security-Policy
  - X-XSS-Protection
  - X-Content-Type-Options
- Échappement des données dans les réponses API

#### 4.2.2 CSRF et Clickjacking
- Implémentation de protection CSRF pour les opérations sensibles
- Configuration du header X-Frame-Options
- Validation de l'origine des requêtes

#### 4.2.3 Attaques par Déni de Service
- Configuration des timeouts appropriés
- Gestion des erreurs pour éviter les crashs
- Documentation des stratégies de scaling

### 4.3 Sécurité Mobile

#### 4.3.1 Stockage Sécurisé sur Appareil
- Recommandations d'utilisation du Keystore/Keychain pour le stockage des tokens
- Chiffrement des données sensibles stockées localement
- Nettoyage des données sensibles lors de la déconnexion

#### 4.3.2 Communication Sécurisée
- Implémentation du certificate pinning basique
- Vérification des signatures TLS
- Prévention des captures d'écran sur les écrans sensibles dans l'application mobile

## 5. Gestion des Secrets

### 5.1 Sécurisation des Secrets d'Application

#### 5.1.1 Stockage des Secrets
- Utilisation des variables d'environnement pour les secrets
- Configuration via dotenv (.env) avec différents fichiers par environnement
- Exclusion stricte des fichiers .env du versionnement Git
- Pas de secrets en dur dans le code (vérification via revues de code)

#### 5.1.2 Rotation des Secrets
- Procédure documentée pour la rotation des clés JWT
- Procédure documentée pour la rotation des API keys des services tiers
- Conservation des clés précédentes pendant une période de transition

### 5.2 Gestion des Clés de Chiffrement

#### 5.2.1 Hiérarchie des Clés
- Architecture à deux niveaux:
  - Clés maîtres (Key Encryption Keys, KEK)
  - Clés de chiffrement des données (Data Encryption Keys, DEK)
- Dérivation de clés avec HKDF pour les usages spécifiques

#### 5.2.2 Protection des Clés Maîtres
- Clés maîtres stockées de manière sécurisée dans des variables d'environnement
- Séparation des clés pour différents environnements (dev, test, prod)
- Accès limité aux clés maîtres
- Documentation du processus de gestion des clés

## 6. Détection et Réponse aux Incidents

### 6.1 Journalisation et Surveillance

#### 6.1.1 Journalisation Sécurisée
- Journalisation structurée des événements de sécurité:
  - Tentatives d'authentification (réussies et échouées)
  - Création et révocation d'appareils
  - Modification des paramètres de sécurité
- Format de journalisation JSON via NestJS Logger
- Horodatage précis en UTC
- Masquage des données sensibles dans les logs

#### 6.1.2 Surveillance et Alertes
- Logs consolidés dans une solution simple (par exemple ELK Stack basique)
- Alertes configurées pour les modèles suspects:
  - Hausse des échecs d'authentification
  - Tentatives d'authentification depuis des localisations inhabituelles
  - Activités inhabituelles sur les comptes
- Dashboard basique pour visualiser les activités de sécurité

### 6.2 Gestion des Incidents

#### 6.2.1 Classification des Incidents
- Niveaux de gravité définis:
  - Critique: Compromission potentielle des données utilisateur
  - Élevé: Violation de contrôle d'accès
  - Moyen: Tentatives répétées d'accès non autorisé
  - Faible: Anomalies mineures

#### 6.2.2 Procédures de Réponse
- Documentation des étapes à suivre en cas d'incident
- Liste des personnes à contacter (membres du projet)
- Instructions pour la collecte de preuves
- Procédure pour limiter l'impact (ex: désactivation temporaire de fonctionnalités)

## 7. Sécurité du Développement

### 7.1 Pratiques de Développement Sécurisé

#### 7.1.1 Recommandations de Sécurité
- Application des principes OWASP Top 10 dans le développement
- Utilisation des fonctionnalités de sécurité de NestJS
- Documentation des décisions de sécurité dans le code
- Revues de code avec attention particulière aux questions de sécurité

#### 7.1.2 Revue de Code et Tests
- Revue de sécurité pour les composants critiques
- Tests unitaires pour les fonctionnalités de sécurité
- Analyse statique de code avec ESLint et les règles de sécurité
- Tests manuels des fonctionnalités sensibles

### 7.2 Gestion des Dépendances

#### 7.2.1 Contrôle des Dépendances
- Évaluation des dépendances avant intégration
- Analyse des vulnérabilités avec npm audit
- Utilisation de versions spécifiques des dépendances
- Documentation des dépendances utilisées et de leur objectif

#### 7.2.2 Mise à Jour des Dépendances
- Vérification régulière des mises à jour de sécurité
- Tests de régression après les mises à jour
- Documentation du processus de mise à jour

## 8. Standards de Sécurité

### 8.1 Normes et Bonnes Pratiques

#### 8.1.1 Conformité aux Standards
- Alignement sur les standards pertinents:
  - OWASP Top 10
  - Bonnes pratiques NestJS
  - Recommandations de sécurité pour Node.js
- Documentation des choix de sécurité et de leur justification

#### 8.1.2 Protection des Données Personnelles
- Principes RGPD appliqués comme bonne pratique
- Minimisation des données collectées
- Processus documenté de suppression des données

### 8.2 Tests de Sécurité

#### 8.2.1 Tests Manuels
- Tests d'application des contrôles de sécurité
- Vérification des erreurs et failles évidentes
- Tests des limites et des cas d'erreur
- Test des fonctionnalités d'authentification et d'autorisation

#### 8.2.2 Outils d'Analyse
- Utilisation d'outils open-source pour l'analyse de sécurité
- Vérification des vulnérabilités connues dans les dépendances
- Analyse statique de code avec les règles de sécurité configurées

## 9. Sauvegarde et Récupération

### 9.1 Sauvegarde et Récupération

#### 9.1.1 Stratégie de Sauvegarde
- Sauvegardes régulières de la base de données PostgreSQL
- Utilisation de pg_dump avec chiffrement des fichiers de sauvegarde
- Conservation des sauvegardes pendant au moins 7 jours
- Documentation du processus de sauvegarde

#### 9.1.2 Plan de Récupération
- Procédure documentée de restauration de la base de données
- Tests de restauration effectués pendant la phase de développement
- Documentation des dépendances entre services pour la récupération

### 9.2 Déploiement Sécurisé

#### 9.2.1 Procédure de Déploiement
- Environnements séparés (développement, test, production)
- Validation des configurations avant déploiement
- Scripts automatisés pour éviter les erreurs manuelles
- Capacité de revenir à la version précédente

## 10. Documentation

### 10.1 Documentation de Sécurité

#### 10.1.1 Documentation Technique
- Architecture de sécurité documentée
- Guide d'implémentation des fonctionnalités de sécurité
- Documentation du modèle de menaces
- Diagrammes de flux de données avec contrôles de sécurité

#### 10.1.2 Documentation Utilisateur
- Guide d'utilisation des fonctionnalités de sécurité
- Bonnes pratiques pour les utilisateurs
- Procédure pour signaler des problèmes de sécurité

---

## Annexes

### A. Matrice des Risques et Contrôles

| Risque | Probabilité | Impact | Mesures de Contrôle |
|--------|-------------|--------|---------------------|
| Compromission des clés Signal | Faible | Critique | Rotation des clés, stockage sécurisé |
| Attaque par force brute | Moyenne | Élevé | Rate limiting, détection des anomalies |
| Vol de token d'authentification | Moyenne | Élevé | Courte durée de vie, révocation |
| Injection SQL | Faible | Critique | ORM, requêtes paramétrées |
| Fuite de données sensibles | Faible | Critique | Chiffrement, masquage des logs |

### B. Références

- OWASP Authentication Cheat Sheet
- NIST Special Publication 800-63B: Digital Identity Guidelines
- Signal Protocol Specification
- NestJS Security Best Practices
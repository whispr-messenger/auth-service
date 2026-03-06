# Plan de Migration des Modules NestJS

> **Objectif** : Remplacer les modules actuels dans `src/modules/` par la version améliorée depuis `import/`

**Date de création** : 2026-03-06
**Durée estimée totale** : 11-15 heures

---

## 📊 Analyse comparative

### Avantages de la nouvelle version

- **+217% de couverture de tests** : 19 fichiers de tests vs 6 actuellement
- **Architecture modulaire améliorée** :
  - Séparation claire entre PhoneAuth, Signal, et autres modules
  - Nouveau module `CommonModule` pour le code partagé
  - Nouveau module `SignalModule` dédié au chiffrement E2E
- **Patterns avancés** :
  - Repository pattern avec repositories customisés
  - Strategy pattern pour les canaux de vérification
  - Transactions pour la cohérence des données
- **Services spécialisés** :
  - `DevicesService` divisé en 5 services spécialisés
  - Meilleure séparation des responsabilités (SRP)
- **Qualité du code** :
  - Documentation JSDoc complète
  - Messages en anglais (internationalisation)
  - Logging structuré

### Mapping des changements structurels

| Ancien (src/modules/)                              | Nouveau (import/)                                  | Type              |
|---------------------------------------------------|---------------------------------------------------|-------------------|
| `authentication/auth.module.ts`                   | `phone-auth/phone-authentication.module.ts`       | Renommage + Split |
| `authentication/entities/identity-key.entity.ts`  | `signal/entities/identity-key.entity.ts`         | Déplacement       |
| `authentication/entities/prekey.entity.ts`        | `signal/entities/prekey.entity.ts`               | Déplacement       |
| `authentication/entities/signed-prekey.entity.ts` | `signal/entities/signed-prekey.entity.ts`        | Déplacement       |
| `authentication/entities/login-history.entity.ts` | `phone-auth/entities/login-history.entity.ts`    | Déplacement       |
| `two-factor-authentication/user-auth.entity.ts`   | `common/entities/user-auth.entity.ts`            | Déplacement       |
| `devices/devices.service.ts`                      | `devices/services/*.service.ts` (5 services)     | Refactorisation   |
| `phone-verification/` (incomplet)                 | `phone-verification/` (complet avec strategies)  | Amélioration      |

### Graphe de dépendances

```
CommonModule (base, pas de dépendances)
    ↓
TokensModule (dépend indirectement de CommonModule)
    ↓
PhoneVerificationModule → CommonModule
    ↓
DevicesModule → TokensModule, CommonModule
    ↓
SignalModule → DevicesModule, TokensModule
    ↓
TwoFactorAuthenticationModule → TokensModule, CommonModule
    ↓
PhoneAuthenticationModule → CommonModule, DevicesModule, PhoneVerificationModule, TokensModule, TwoFactorAuthenticationModule
    ↓
AuthModule (racine) → tous les modules ci-dessus
```

---

## 🔄 Méthodologie Ralph Wiggum Loop

Cette migration utilise la **méthodologie Ralph Wiggum Loop**, une approche agentic où chaque tâche est exécutée par un agent frais dans un contexte neuf.

### Principe du Ralph Loop

```
┌─────────────────────────────────────────┐
│  1. Nouvel Agent (contexte vide)        │
│  2. Lit MIGRATION_PLAN.md depuis disque │
│  3. Identifie prochaine tâche [ ]       │
│  4. Exécute la tâche                     │
│  5. Marque la tâche [x]                  │
│  6. Commit les changements               │
│  7. Exit                                 │
│  8. → Retour à l'étape 1                │
└─────────────────────────────────────────┘
```

### Avantages de cette approche

- ✅ **Contexte frais** : Pas d'accumulation de contexte, chaque agent démarre proprement
- ✅ **Focus laser** : Un agent = une tâche = un objectif clair
- ✅ **Commits granulaires** : Historique git propre et traçable
- ✅ **Résilience** : Si un agent échoue, le suivant repart de zéro sans hériter des erreurs
- ✅ **Parallélisable** : Certaines tâches indépendantes peuvent être exécutées en parallèle

### Comment ça fonctionne pour cette migration

**Pour chaque tâche** :

1. Un **nouvel agent Claude** est lancé
2. L'agent **lit** `MIGRATION_PLAN.md` depuis le filesystem
3. L'agent **identifie** la première checkbox `- [ ]` non cochée
4. L'agent **exécute** cette tâche unique
5. L'agent **met à jour** le plan : `- [ ]` → `- [x]`
6. L'agent **commit** : `git add . && git commit -m "task: description"`
7. L'agent se **termine**
8. Le cycle **recommence** avec un nouvel agent pour la tâche suivante

### Instructions pour l'agent

**En tant qu'agent Ralph Wiggum, tu dois** :

1. 🔍 **LIRE** : Ouvrir et lire `/home/glopez/Development/Epitech/whispr-messenger/auth-service/MIGRATION_PLAN.md`
2. 🎯 **IDENTIFIER** : Trouver la première checkbox `- [ ]` non cochée dans l'ordre du document
3. ✅ **EXÉCUTER** : Accomplir cette tâche unique et seulement celle-ci
4. 📝 **MARQUER** : Remplacer `- [ ]` par `- [x]` pour cette tâche dans le plan
5. 💾 **COMMIT** : Créer un commit avec un message descriptif
   ```bash
   git add .
   git commit -m "task: [description courte de la tâche]"
   ```
6. 🚪 **EXIT** : Terminer immédiatement après le commit

**⚠️ IMPORTANT** :
- **UNE SEULE TÂCHE** par agent
- **NE PAS** essayer de faire plusieurs tâches à la suite
- **NE PAS** passer à la phase suivante tant que toutes les tâches de la phase actuelle ne sont pas terminées
- **TOUJOURS** lire le plan depuis le disque (ne jamais se fier à la mémoire)
- **SI BLOQUÉ** : Commit l'état actuel et ajouter une note dans "📌 Notes de Migration"

### Suivi de progression

Le plan `MIGRATION_PLAN.md` sert de **source de vérité unique** :
- ✅ `- [x]` = Tâche complétée
- ⬜ `- [ ]` = Tâche à faire

Pour voir la progression :
```bash
# Nombre de tâches complétées
grep -c "\- \[x\]" MIGRATION_PLAN.md

# Nombre de tâches restantes
grep -c "\- \[ \]" MIGRATION_PLAN.md

# Voir les tâches non complétées
grep "\- \[ \]" MIGRATION_PLAN.md
```

### Exemple de cycle complet

```
Agent #1:
  - Lit le plan
  - Trouve: "- [ ] Créer le dossier src/modules/common/"
  - Exécute: mkdir -p src/modules/common/
  - Marque: "- [x] Créer le dossier src/modules/common/"
  - Commit: git commit -m "task: create common module directory"
  - Exit

Agent #2 (contexte neuf):
  - Lit le plan
  - Trouve: "- [ ] Créer le dossier src/modules/common/entities/"
  - Exécute: mkdir -p src/modules/common/entities/
  - Marque: "- [x] Créer le dossier src/modules/common/entities/"
  - Commit: git commit -m "task: create common entities directory"
  - Exit

... et ainsi de suite jusqu'à completion
```

---

## 🐳 Environnement de Développement

### Conteneur Docker de développement

Ce projet utilise un conteneur Docker de développement avec :
- **Volume partagé** : les changements de code sont reflétés immédiatement
- **Hot reloading** : l'application redémarre automatiquement lors des modifications
- **Accès aux endpoints** : possibilité de tester avec `curl` depuis le conteneur

### Justfile - Gestion des conteneurs

Le projet contient un `Justfile` avec des recipes pour gérer le cycle de vie des conteneurs Docker.

**Commandes principales** :
```bash
# Lister toutes les recipes disponibles
just --list

# Démarrer les conteneurs
just up

# Arrêter les conteneurs
just down

# Voir les logs
just logs

# Redémarrer les conteneurs
just restart

# Accéder au shell du conteneur
just exec

# Builder et redémarrer
just rebuild
```

### Workflow de test recommandé

1. **Démarrer l'environnement** : `just up`
2. **Vérifier les logs** : `just logs` (dans un autre terminal)
3. **Effectuer les changements** de code (hot reload automatique)
4. **Tester avec curl** depuis le conteneur :
   ```bash
   just exec
   # Puis dans le conteneur :
   curl http://localhost:3000/health
   ```
5. **Committer régulièrement** les changements (voir section Git ci-dessous)

### Bonnes pratiques Git pour la migration

⚠️ **IMPORTANT** : Toute la migration doit se faire sur la branche actuelle :
- **Branche** : `WHISPR-287-transfer-nestjs-modules-from-modulith-repo`
- **NE PAS** créer de nouvelle branche
- **NE PAS** merger vers main pendant la migration

**Stratégie de commits** :
- ✅ Committer **à la fin de chaque phase** (validation OK)
- ✅ Committer **après chaque module migré** avec succès
- ✅ Committer **avant les opérations risquées** (backup naturel)
- ✅ Utiliser des messages de commit descriptifs

**Format de commit recommandé** :
```bash
# Après chaque phase/module
git add .
git commit -m "feat(migration): complete Phase X - ModuleName

- List of changes
- Tests passing: ✓
- No regressions: ✓"

# Pousser régulièrement pour sauvegarder le travail
git push origin WHISPR-287-transfer-nestjs-modules-from-modulith-repo
```

**Exemple de timeline de commits** :
1. Commit après Phase 1 : CommonModule + TokensModule
2. Commit après PhoneVerificationModule
3. Commit après DevicesModule
4. Commit après Phase 3 : SignalModule
5. Commit après Phase 4 : Auth modules
6. Commit après Phase 5 : Nettoyage
7. Commit final après Phase 6 : Validation complète

---

## Phase 1 : Modules Fondamentaux
**Durée estimée** : 1-2 heures
**Dépendances** : Aucune
**Priorité** : CRITIQUE

### ⚠️ Préparation avant de commencer

- [x] Vérifier qu'on est sur la bonne branche : `git branch --show-current`
- [x] Démarrer les conteneurs Docker : `just up`
- [ ] Vérifier que l'application démarre : `just logs`
- [ ] Ouvrir un second terminal pour les logs en temps réel : `just logs -f`

### 1.1 CommonModule

- [ ] Créer le dossier `src/modules/common/`
- [ ] Créer le dossier `src/modules/common/entities/`
- [ ] Créer le dossier `src/modules/common/services/`
- [ ] Copier `import/common/common.module.ts` → `src/modules/common/common.module.ts`
- [ ] Copier `import/common/entities/user-auth.entity.ts` → `src/modules/common/entities/user-auth.entity.ts`
- [ ] Copier `import/common/services/user-auth.service.ts` → `src/modules/common/services/user-auth.service.ts`
- [ ] Mettre à jour les imports de `UserAuth` dans `src/modules/two-factor-authentication/two-factor-authentication.module.ts`
- [ ] Mettre à jour les imports de `UserAuth` dans `src/modules/two-factor-authentication/two-factor-authentication.service.ts`
- [ ] Mettre à jour les imports de `UserAuth` dans `src/modules/authentication/auth.module.ts`
- [ ] Mettre à jour les imports de `UserAuth` dans `src/modules/authentication/services/auth.service.ts`
- [ ] Mettre à jour les imports de `UserAuth` dans `src/modules/devices/devices.module.ts`
- [ ] Mettre à jour les imports de `UserAuth` dans `src/modules/devices/devices.controller.ts`
- [ ] Rechercher tous les autres imports de `UserAuth` : `grep -r "from.*user-auth.entity" src/`
- [ ] Compiler le projet : `npm run build`
- [ ] Vérifier qu'il n'y a pas d'erreurs TypeScript
- [ ] Exécuter les tests du module common : `npm test -- common`

### 1.2 TokensModule

- [ ] Créer une sauvegarde : `cp -r src/modules/tokens src/modules/tokens.backup`
- [ ] Lire et comparer `import/tokens/tokens.module.ts` avec `src/modules/tokens/tokens.module.ts`
- [ ] Lire et comparer `import/tokens/services/tokens.service.ts` avec `src/modules/tokens/services/tokens.service.ts`
- [ ] Lire et comparer `import/tokens/guards/jwt-auth.guard.ts` avec la version actuelle
- [ ] Identifier les différences dans les interfaces/types
- [ ] Décider si on remplace complètement ou on merge les améliorations
- [ ] Si remplacement : copier `import/tokens/` → `src/modules/tokens/` (écraser)
- [ ] Si merge : appliquer les améliorations manuellement
- [ ] Mettre à jour les imports de `TokensModule` dans `src/modules/authentication/auth.module.ts`
- [ ] Mettre à jour les imports de `TokensModule` dans `src/modules/devices/devices.module.ts`
- [ ] Mettre à jour les imports de `JwtAuthGuard` partout où il est utilisé
- [ ] Rechercher tous les imports : `grep -r "from.*tokens" src/modules/`
- [ ] Compiler le projet : `npm run build`
- [ ] Vérifier qu'il n'y a pas d'erreurs TypeScript
- [ ] Exécuter les tests du module tokens : `npm test -- tokens`
- [ ] Tester manuellement un endpoint protégé par JWT

#### Validation Phase 1

- [ ] ✅ Le projet compile sans erreur
- [ ] ✅ Tous les tests de CommonModule passent
- [ ] ✅ Tous les tests de TokensModule passent
- [ ] ✅ Les endpoints protégés par JWT fonctionnent
- [ ] ✅ Aucune régression détectée

#### 🔄 Commit Phase 1

- [ ] Ajouter tous les changements : `git add .`
- [ ] Créer le commit :
  ```bash
  git commit -m "feat(migration): complete Phase 1 - CommonModule & TokensModule

  - Add CommonModule with shared UserAuth entity
  - Update TokensModule with improved guards
  - Update all imports to use CommonModule
  - Tests passing: ✓
  - No regressions: ✓"
  ```
- [ ] Pousser les changements : `git push origin WHISPR-287-transfer-nestjs-modules-from-modulith-repo`

---

## Phase 2 : Modules Intermédiaires
**Durée estimée** : 2-3 heures
**Dépendances** : CommonModule, TokensModule
**Priorité** : HAUTE

### 2.1 PhoneVerificationModule

- [ ] Créer une sauvegarde : `cp -r src/modules/phone-verification src/modules/phone-verification.backup`
- [ ] Lister les entities actuelles : `ls src/modules/phone-verification/`
- [ ] Lister les entities nouvelles : `ls import/phone-verification/`
- [ ] Comparer les structures d'entities pour identifier les changements de schéma
- [ ] Créer une migration si nécessaire pour préserver les données
- [ ] Supprimer le contenu de `src/modules/phone-verification/`
- [ ] Copier tout `import/phone-verification/` → `src/modules/phone-verification/`
- [ ] Vérifier que l'import de `CommonModule` est correct dans `phone-verification.module.ts`
- [ ] Mettre à jour les imports dans `src/modules/authentication/auth.module.ts`
- [ ] Mettre à jour les imports dans `src/modules/app/app.module.ts`
- [ ] Rechercher tous les imports : `grep -r "from.*phone-verification" src/modules/`
- [ ] Compiler le projet : `npm run build`
- [ ] Vérifier qu'il n'y a pas d'erreurs TypeScript
- [ ] Exécuter la migration si créée : `npm run migration:run`
- [ ] Exécuter les tests : `npm test -- phone-verification`
- [ ] Tester l'endpoint de demande de vérification : `POST /phone-verification/request`
- [ ] Tester l'endpoint de confirmation : `POST /phone-verification/confirm`
- [ ] Vérifier que les codes SMS sont générés correctement
- [ ] Vérifier que les rate limits fonctionnent

### 2.2 DevicesModule

- [ ] Créer une sauvegarde : `cp -r src/modules/devices src/modules/devices.backup`
- [ ] Lister les fichiers actuels : `find src/modules/devices -type f`
- [ ] Lister les nouveaux fichiers : `find import/devices -type f`
- [ ] Comparer l'entity `Device` entre ancien et nouveau
- [ ] Créer une migration si l'entity a changé
- [ ] Supprimer le contenu de `src/modules/devices/`
- [ ] Copier tout `import/devices/` → `src/modules/devices/`
- [ ] Vérifier les imports de `TokensModule` dans `devices.module.ts`
- [ ] Vérifier les imports de `CommonModule` (UserAuth) dans `devices.module.ts`
- [ ] Mettre à jour les imports dans les controllers qui utilisent `DevicesService`
- [ ] Mettre à jour les imports dans `src/modules/authentication/auth.module.ts`
- [ ] Mettre à jour les imports dans `src/modules/app/app.module.ts`
- [ ] Rechercher tous les imports : `grep -r "from.*devices" src/modules/`
- [ ] Compiler le projet : `npm run build`
- [ ] Vérifier qu'il n'y a pas d'erreurs TypeScript
- [ ] Exécuter la migration si créée : `npm run migration:run`
- [ ] Exécuter les tests : `npm test -- devices`
- [ ] Tester l'enregistrement d'un device : `POST /devices/register`
- [ ] Tester la récupération des devices d'un user : `GET /devices`
- [ ] Tester la révocation d'un device : `DELETE /devices/:id`
- [ ] Tester le QR code flow : `POST /devices/qr/request` et `POST /devices/qr/confirm`
- [ ] Vérifier que les 5 services spécialisés fonctionnent correctement

#### Validation Phase 2

- [ ] ✅ Le projet compile sans erreur
- [ ] ✅ Tous les tests de PhoneVerificationModule passent
- [ ] ✅ Tous les tests de DevicesModule passent
- [ ] ✅ Le flow de vérification SMS fonctionne end-to-end
- [ ] ✅ Les devices peuvent être enregistrés, listés, révoqués
- [ ] ✅ Le QR code login fonctionne
- [ ] ✅ Aucune régression détectée

#### 🔄 Commit Phase 2

- [ ] Ajouter tous les changements : `git add .`
- [ ] Créer le commit :
  ```bash
  git commit -m "feat(migration): complete Phase 2 - PhoneVerification & Devices

  - Migrate PhoneVerificationModule with Strategy pattern
  - Refactor DevicesModule with 5 specialized services
  - Add repositories and improved architecture
  - Tests passing: ✓
  - SMS flow working: ✓
  - QR code login working: ✓"
  ```
- [ ] Pousser les changements : `git push origin WHISPR-287-transfer-nestjs-modules-from-modulith-repo`

---

## Phase 3 : Module Signal (Nouveau)
**Durée estimée** : 2-3 heures
**Dépendances** : DevicesModule, TokensModule
**Priorité** : HAUTE

### 3.1 Création du SignalModule

- [ ] Créer le dossier `src/modules/signal/`
- [ ] Copier tout le contenu de `import/signal/` → `src/modules/signal/`
- [ ] Vérifier que tous les fichiers sont copiés : `find src/modules/signal -type f | wc -l`

### 3.2 Migration des entities Signal

- [ ] Identifier les entities Signal dans `src/modules/authentication/entities/` :
  - [ ] Noter le chemin de `identity-key.entity.ts`
  - [ ] Noter le chemin de `prekey.entity.ts`
  - [ ] Noter le chemin de `signed-prekey.entity.ts`
- [ ] Comparer les entities Signal anciennes avec les nouvelles dans `import/signal/entities/`
- [ ] Créer une migration pour préserver les données existantes :
  - [ ] `npm run migration:generate -- -n MoveSignalEntitiesToSignalModule`
  - [ ] Vérifier que la migration ne supprime pas de tables
  - [ ] Vérifier que la migration ne perd pas de données
- [ ] Mettre à jour `src/modules/authentication/auth.module.ts` :
  - [ ] Supprimer les imports des entities Signal dans `TypeOrmModule.forFeature([])`
  - [ ] Supprimer `IdentityKey` de la liste
  - [ ] Supprimer `PreKey` de la liste
  - [ ] Supprimer `SignedPreKey` de la liste
- [ ] Supprimer les fichiers d'entities Signal de `src/modules/authentication/entities/` :
  - [ ] Supprimer `identity-key.entity.ts`
  - [ ] Supprimer `prekey.entity.ts`
  - [ ] Supprimer `signed-prekey.entity.ts`

### 3.3 Intégration du SignalModule

- [ ] Ajouter `SignalModule` dans `src/modules/app/app.module.ts`
- [ ] Vérifier que `SignalModule` importe `DevicesModule` et `TokensModule`
- [ ] Rechercher tous les anciens imports d'entities Signal : `grep -r "authentication/entities/identity-key" src/`
- [ ] Mettre à jour tous les imports trouvés pour pointer vers `signal/entities/`
- [ ] Compiler le projet : `npm run build`
- [ ] Vérifier qu'il n'y a pas d'erreurs TypeScript
- [ ] Exécuter la migration : `npm run migration:run`
- [ ] Vérifier que les données Signal existent toujours en BDD

### 3.4 Tests du SignalModule

- [ ] Exécuter les tests : `npm test -- signal`
- [ ] Tester l'upload des clés Signal : `POST /signal/keys`
- [ ] Tester la récupération d'un key bundle : `GET /signal/keys/:userId`
- [ ] Tester l'upload de prekeys : `POST /signal/keys/prekeys`
- [ ] Tester le statut des prekeys : `GET /signal/keys/prekeys/status`
- [ ] Tester la rotation des clés : `POST /signal/keys/rotate`
- [ ] Tester le health check : `GET /signal/health`
- [ ] Vérifier que les clés existantes sont toujours accessibles

#### Validation Phase 3

- [ ] ✅ Le projet compile sans erreur
- [ ] ✅ Tous les tests de SignalModule passent
- [ ] ✅ Les clés Signal peuvent être uploadées
- [ ] ✅ Les key bundles sont récupérables
- [ ] ✅ La rotation des clés fonctionne
- [ ] ✅ Les données existantes sont préservées (aucune perte)
- [ ] ✅ Le module est bien isolé
- [ ] ✅ Aucune régression détectée

#### 🔄 Commit Phase 3

- [ ] Ajouter tous les changements : `git add .`
- [ ] Créer le commit :
  ```bash
  git commit -m "feat(migration): complete Phase 3 - SignalModule

  - Extract Signal Protocol keys to dedicated module
  - Move identity-key, prekey, signed-prekey entities
  - Add SignalModule with 5 services and 3 controllers
  - Create migration to preserve existing Signal data
  - Tests passing: ✓
  - Key upload/retrieval working: ✓
  - Key rotation working: ✓"
  ```
- [ ] Pousser les changements : `git push origin WHISPR-287-transfer-nestjs-modules-from-modulith-repo`

---

## Phase 4 : Modules d'Authentification
**Durée estimée** : 3-4 heures
**Dépendances** : CommonModule, TokensModule, PhoneVerificationModule, DevicesModule
**Priorité** : CRITIQUE

### 4.1 TwoFactorAuthenticationModule

- [ ] Créer une sauvegarde : `cp -r src/modules/two-factor-authentication src/modules/two-factor-authentication.backup`
- [ ] Comparer les structures : `diff -r import/two-factor-authentication src/modules/two-factor-authentication`
- [ ] Lire `import/two-factor-authentication/two-factor-authentication.module.ts`
- [ ] Lire `src/modules/two-factor-authentication/two-factor-authentication.module.ts`
- [ ] Identifier les améliorations dans la nouvelle version
- [ ] Comparer l'entity `BackupCode`
- [ ] Décider si on remplace ou on merge
- [ ] Si remplacement : copier `import/two-factor-authentication/` → `src/modules/two-factor-authentication/`
- [ ] Si merge : appliquer les améliorations manuellement
- [ ] Mettre à jour l'import de `UserAuth` pour utiliser `CommonModule`
- [ ] Vérifier que `TokensModule` est bien importé
- [ ] Créer une migration si l'entity `BackupCode` a changé
- [ ] Compiler le projet : `npm run build`
- [ ] Exécuter la migration si créée : `npm run migration:run`
- [ ] Exécuter les tests : `npm test -- two-factor`
- [ ] Tester l'activation du 2FA : `POST /2fa/setup`
- [ ] Tester la vérification 2FA : `POST /2fa/verify`
- [ ] Tester la génération de backup codes : `POST /2fa/backup-codes`
- [ ] Tester la connexion avec 2FA activé

### 4.2 PhoneAuthenticationModule

- [ ] Créer le dossier `src/modules/phone-auth/`
- [ ] Créer les sous-dossiers nécessaires :
  - [ ] `src/modules/phone-auth/controllers/`
  - [ ] `src/modules/phone-auth/services/`
  - [ ] `src/modules/phone-auth/dto/`
  - [ ] `src/modules/phone-auth/entities/`
  - [ ] `src/modules/phone-auth/guards/`
  - [ ] `src/modules/phone-auth/config/`
  - [ ] `src/modules/phone-auth/interfaces/`
  - [ ] `src/modules/phone-auth/types/`
  - [ ] `src/modules/phone-auth/swagger/`
- [ ] Copier tout le contenu de `import/phone-auth/` → `src/modules/phone-auth/`
- [ ] Vérifier que tous les fichiers sont copiés
- [ ] Analyser l'entity `LoginHistory` pour détecter les changements
- [ ] Créer une migration pour `LoginHistory` si nécessaire
- [ ] Vérifier les imports dans `phone-authentication.module.ts` :
  - [ ] CommonModule ✓
  - [ ] DevicesModule ✓
  - [ ] PhoneVerificationModule ✓
  - [ ] TokensModule ✓
  - [ ] TwoFactorAuthenticationModule ✓
- [ ] Vérifier la configuration JWT dans `config/jwt.config.ts`
- [ ] Comparer avec l'ancienne config JWT dans `src/modules/authentication/factories/jwt.ts`
- [ ] Mettre à jour les variables d'environnement si nécessaire
- [ ] Compiler le projet : `npm run build`
- [ ] Vérifier qu'il n'y a pas d'erreurs TypeScript
- [ ] Exécuter la migration si créée : `npm run migration:run`

### 4.3 Tests PhoneAuthenticationModule

- [ ] Exécuter les tests : `npm test -- phone-auth`
- [ ] Tester l'enregistrement d'un utilisateur :
  - [ ] Demander une vérification : `POST /auth/register/request`
  - [ ] Confirmer avec le code : `POST /auth/register/confirm`
- [ ] Tester la connexion :
  - [ ] Demander une vérification : `POST /auth/login/request`
  - [ ] Confirmer avec le code : `POST /auth/login/confirm`
  - [ ] Vérifier que le JWT est retourné
- [ ] Tester la déconnexion : `POST /auth/logout`
- [ ] Tester le refresh token : `POST /auth/refresh`
- [ ] Tester l'historique de connexion : `GET /auth/login-history`
- [ ] Vérifier que les guards fonctionnent
- [ ] Vérifier que les rate limits fonctionnent

#### Validation Phase 4

- [ ] ✅ Le projet compile sans erreur
- [ ] ✅ Tous les tests de TwoFactorAuthenticationModule passent
- [ ] ✅ Tous les tests de PhoneAuthenticationModule passent
- [ ] ✅ Le flow d'enregistrement fonctionne end-to-end
- [ ] ✅ Le flow de connexion fonctionne end-to-end
- [ ] ✅ Le 2FA fonctionne correctement
- [ ] ✅ Les tokens sont correctement gérés (refresh, revoke)
- [ ] ✅ L'historique de connexion est enregistré
- [ ] ✅ Aucune régression détectée

#### 🔄 Commit Phase 4

- [ ] Ajouter tous les changements : `git add .`
- [ ] Créer le commit :
  ```bash
  git commit -m "feat(migration): complete Phase 4 - Authentication Modules

  - Migrate TwoFactorAuthenticationModule
  - Add PhoneAuthenticationModule (replaces old AuthModule)
  - Move LoginHistory entity to phone-auth
  - Update all authentication flows
  - Tests passing: ✓
  - Registration flow working: ✓
  - Login flow working: ✓
  - 2FA working: ✓"
  ```
- [ ] Pousser les changements : `git push origin WHISPR-287-transfer-nestjs-modules-from-modulith-repo`

---

## Phase 5 : Module Racine et Nettoyage
**Durée estimée** : 1 heure
**Dépendances** : Tous les modules précédents
**Priorité** : CRITIQUE

### 5.1 AuthModule (Racine)

- [ ] Copier `import/auth.module.ts` → `src/modules/auth.module.ts`
- [ ] Lire le contenu du nouveau `auth.module.ts`
- [ ] Ouvrir `src/modules/app/app.module.ts`
- [ ] Remplacer `import { AuthModule } from '../authentication/auth.module'` par `import { AuthModule } from '../auth.module'`
- [ ] Vérifier que tous les sous-modules sont importés dans `auth.module.ts` :
  - [ ] PhoneVerificationModule ✓
  - [ ] PhoneAuthenticationModule ✓
  - [ ] SignalModule ✓
  - [ ] TokensModule ✓
  - [ ] DevicesModule ✓
  - [ ] TwoFactorAuthenticationModule (si décommenté) ✓
- [ ] Supprimer les imports redondants dans `app.module.ts` si déjà dans `AuthModule`
- [ ] Compiler le projet : `npm run build`
- [ ] Vérifier qu'il n'y a pas d'erreurs TypeScript

### 5.2 Tests d'intégration globaux

- [ ] Exécuter tous les tests : `npm test`
- [ ] Vérifier que tous les tests passent
- [ ] Démarrer l'application : `npm run start:dev`
- [ ] Vérifier que l'application démarre sans erreur
- [ ] Tester tous les endpoints principaux via Swagger ou Postman

### 5.3 Nettoyage des anciens fichiers

- [ ] Supprimer l'ancien module d'authentification : `rm -rf src/modules/authentication/`
- [ ] Vérifier qu'aucun fichier n'importe depuis l'ancien chemin : `grep -r "from.*modules/authentication" src/`
- [ ] Supprimer les backups si tout fonctionne :
  - [ ] `rm -rf src/modules/tokens.backup/`
  - [ ] `rm -rf src/modules/phone-verification.backup/`
  - [ ] `rm -rf src/modules/devices.backup/`
  - [ ] `rm -rf src/modules/two-factor-authentication.backup/`
- [ ] Supprimer le dossier `import/` : `rm -rf import/`
- [ ] Compiler le projet : `npm run build`
- [ ] Exécuter tous les tests : `npm test`
- [ ] Vérifier que tout fonctionne toujours

### 5.4 Documentation

- [ ] Mettre à jour le README.md avec la nouvelle structure des modules
- [ ] Mettre à jour la documentation Swagger/OpenAPI
- [ ] Créer un fichier CHANGELOG.md ou mettre à jour l'existant
- [ ] Documenter les breaking changes s'il y en a
- [ ] Mettre à jour le `.gitignore` si nécessaire
- [ ] Mettre à jour les diagrammes d'architecture si existants

#### Validation Phase 5

- [ ] ✅ L'application démarre sans erreur
- [ ] ✅ Tous les tests passent (100%)
- [ ] ✅ Tous les endpoints sont fonctionnels
- [ ] ✅ Aucun import cassé
- [ ] ✅ Les anciens fichiers sont supprimés
- [ ] ✅ La documentation est à jour
- [ ] ✅ Aucune régression détectée

#### 🔄 Commit Phase 5

- [ ] Ajouter tous les changements : `git add .`
- [ ] Créer le commit :
  ```bash
  git commit -m "feat(migration): complete Phase 5 - Root Module & Cleanup

  - Add root AuthModule importing all sub-modules
  - Update app.module.ts to use new architecture
  - Remove old authentication module
  - Clean up backup files
  - Update documentation (README, Swagger)
  - Tests passing: ✓
  - All endpoints functional: ✓
  - Documentation updated: ✓"
  ```
- [ ] Pousser les changements : `git push origin WHISPR-287-transfer-nestjs-modules-from-modulith-repo`

---

## Phase 6 : Tests Finaux et Déploiement
**Durée estimée** : 1-2 heures

### 6.1 Tests complets

- [ ] Exécuter la suite de tests complète : `npm test`
- [ ] Exécuter les tests e2e s'ils existent : `npm run test:e2e`
- [ ] Générer le rapport de couverture : `npm run test:cov`
- [ ] Vérifier que la couverture est >= 80%
- [ ] Lire le rapport de couverture et identifier les zones non couvertes

### 6.2 Tests manuels des flows critiques

- [ ] **Flow d'enregistrement** :
  - [ ] Demander une vérification avec un numéro de téléphone
  - [ ] Recevoir le code SMS
  - [ ] Confirmer avec le code
  - [ ] Vérifier que le compte est créé
  - [ ] Vérifier que le JWT est retourné
- [ ] **Flow de connexion** :
  - [ ] Demander une vérification avec un numéro existant
  - [ ] Recevoir le code SMS
  - [ ] Confirmer avec le code
  - [ ] Vérifier que le JWT est retourné
  - [ ] Vérifier que l'historique est enregistré
- [ ] **Flow de vérification SMS** :
  - [ ] Tester avec un numéro valide
  - [ ] Tester avec un numéro invalide
  - [ ] Tester avec un code erroné
  - [ ] Tester avec un code expiré
  - [ ] Vérifier les rate limits
- [ ] **Flow d'enregistrement de device** :
  - [ ] Enregistrer un nouveau device
  - [ ] Vérifier qu'il apparaît dans la liste
  - [ ] Mettre à jour le FCM token
  - [ ] Vérifier la dernière activité
- [ ] **Flow QR code login** :
  - [ ] Créer une demande QR code
  - [ ] Scanner et confirmer depuis un autre device
  - [ ] Vérifier que la connexion fonctionne
- [ ] **Flow Signal keys** :
  - [ ] Uploader les clés Signal (identity, signed prekey, prekeys)
  - [ ] Récupérer un key bundle
  - [ ] Vérifier qu'un prekey est consommé
  - [ ] Uploader de nouveaux prekeys
  - [ ] Tester la rotation
- [ ] **Flow 2FA** :
  - [ ] Activer le 2FA sur un compte
  - [ ] Se connecter avec 2FA
  - [ ] Générer des backup codes
  - [ ] Se connecter avec un backup code
- [ ] **Flow refresh token** :
  - [ ] Obtenir un JWT
  - [ ] Attendre l'expiration (ou réduire le TTL en dev)
  - [ ] Utiliser le refresh token
  - [ ] Vérifier que le nouveau JWT fonctionne
- [ ] **Flow révocation device** :
  - [ ] Lister les devices d'un user
  - [ ] Révoquer un device
  - [ ] Vérifier qu'il n'apparaît plus dans la liste
  - [ ] Vérifier que le device révoqué ne peut plus se connecter
- [ ] **Flow déconnexion** :
  - [ ] Se connecter
  - [ ] Se déconnecter
  - [ ] Vérifier que le token est révoqué
  - [ ] Vérifier qu'on ne peut plus utiliser l'ancien JWT

### 6.3 Vérifications de sécurité

- [ ] Vérifier que les endpoints protégés nécessitent un JWT valide
- [ ] Vérifier que les rate limits sont appliqués
- [ ] Vérifier que les DTOs sont validés (class-validator)
- [ ] Vérifier qu'aucune donnée sensible n'est loggée
- [ ] Vérifier que les mots de passe/tokens ne sont pas en clair dans les logs
- [ ] Vérifier que les erreurs ne révèlent pas d'informations sensibles
- [ ] Tester avec un token expiré
- [ ] Tester avec un token invalide
- [ ] Tester avec un token d'un autre utilisateur

### 6.4 Vérifications de performance

- [ ] Vérifier les temps de réponse des endpoints critiques
- [ ] Vérifier qu'il n'y a pas de requêtes N+1
- [ ] Vérifier l'utilisation mémoire avec l'application en cours d'exécution
- [ ] Vérifier qu'il n'y a pas de memory leaks
- [ ] Profiler l'application si nécessaire

### 6.5 Git et versioning

- [ ] Vérifier qu'on est sur la bonne branche : `git branch --show-current` (doit afficher: WHISPR-287-transfer-nestjs-modules-from-modulith-repo)
- [ ] Vérifier les fichiers modifiés : `git status`
- [ ] Vérifier l'historique des commits de la migration : `git log --oneline -10`
- [ ] Ajouter tous les fichiers : `git add .`
- [ ] Vérifier les fichiers ajoutés : `git status`
- [ ] Créer un commit final récapitulatif :
  ```bash
  git commit -m "feat: import improved NestJS modules architecture

  - Add CommonModule for shared UserAuth entity
  - Split AuthModule into PhoneAuthenticationModule and SignalModule
  - Refactor DevicesModule with specialized services
  - Improve PhoneVerificationModule with Strategy pattern
  - Add 19 test files (+217% test coverage)
  - Update all module dependencies and imports

  BREAKING CHANGE: Authentication routes may have changed"
  ```
- [ ] Pousser vers le remote : `git push origin WHISPR-287-transfer-nestjs-modules-from-modulith-repo`

### 6.6 Pull Request et Review

- [ ] Créer une Pull Request sur GitHub/GitLab
- [ ] Remplir la description de la PR avec :
  - [ ] Résumé des changements
  - [ ] Liste des modules migrés
  - [ ] Breaking changes éventuels
  - [ ] Checklist de test
  - [ ] Screenshots/logs si pertinent
- [ ] Assigner des reviewers
- [ ] Attendre la review et les approbations
- [ ] Répondre aux commentaires de review
- [ ] Appliquer les changements demandés si nécessaire
- [ ] Obtenir l'approbation finale

### 6.7 Déploiement

- [ ] Merger la PR après approbation
- [ ] Déployer en environnement de staging
- [ ] Exécuter les migrations en staging : `npm run migration:run`
- [ ] Vérifier que l'application démarre en staging
- [ ] Tester les flows critiques en staging
- [ ] Surveiller les logs et les métriques en staging
- [ ] Obtenir l'approbation pour déployer en production
- [ ] Créer une sauvegarde de la base de données de production
- [ ] Déployer en production
- [ ] Exécuter les migrations en production : `npm run migration:run`
- [ ] Vérifier que l'application démarre en production
- [ ] Surveiller les logs et les métriques en production pendant 30 minutes
- [ ] Vérifier que les utilisateurs peuvent se connecter
- [ ] Vérifier les dashboards de monitoring (erreurs, latence, etc.)

#### Validation Finale

- [ ] ✅ Tous les tests passent (100%)
- [ ] ✅ Couverture de code >= 80%
- [ ] ✅ Aucune régression fonctionnelle détectée
- [ ] ✅ Aucune régression de performance détectée
- [ ] ✅ Tous les flows critiques fonctionnent
- [ ] ✅ Sécurité vérifiée (guards, rate limits, validation)
- [ ] ✅ Documentation à jour
- [ ] ✅ PR créée et revue
- [ ] ✅ Déployé en staging avec succès
- [ ] ✅ Déployé en production avec succès
- [ ] ✅ Monitoring OK en production

---

## ⚠️ Points de Vigilance et Risques

### Migrations de base de données

- ⚠️ **CRITIQUE** : Toujours créer des migrations AVANT de supprimer/déplacer des entities
- ⚠️ Ne JAMAIS supprimer de tables ou colonnes sans migration
- ⚠️ Tester les migrations sur une copie de la BDD de production
- ⚠️ Prévoir un plan de rollback pour chaque migration
- ⚠️ Faire une sauvegarde complète avant de déployer

### Breaking Changes potentiels

- ⚠️ Routes API potentiellement modifiées (vérifier les controllers)
- ⚠️ DTOs renommés ou restructurés (vérifier les clients)
- ⚠️ Guards et middlewares différents (vérifier l'authentification)
- ⚠️ Messages d'erreur changés de français vers anglais (impact sur les clients)
- ⚠️ Interfaces/types modifiés (vérifier les contrats)

### Performance

- ⚠️ Les transactions peuvent impacter les performances
- ⚠️ Les repositories customisés peuvent avoir des requêtes différentes
- ⚠️ Surveiller les requêtes N+1 avec les nouveaux services
- ⚠️ Vérifier l'utilisation mémoire (plus de services = plus d'instances)

### Compatibilité

- ⚠️ Vérifier la compatibilité avec les clients existants (mobile, web)
- ⚠️ Vérifier la compatibilité avec les autres microservices
- ⚠️ Prévoir une période de transition si les contrats API changent
- ⚠️ Communiquer les breaking changes à toute l'équipe

### Dépendances

- ⚠️ Respecter strictement l'ordre des phases (dépendances!)
- ⚠️ Ne pas passer à la phase suivante si la précédente n'est pas validée
- ⚠️ Un module mal migré peut casser tous les suivants

---

## 📝 Commandes Utiles

### Docker et Justfile

```bash
# Lister toutes les recipes disponibles
just --list

# Démarrer les conteneurs de développement
just up

# Arrêter les conteneurs
just down

# Voir les logs en temps réel
just logs

# Voir les logs d'un service spécifique
just logs <service-name>

# Redémarrer les conteneurs
just restart

# Accéder au shell du conteneur auth-service
just exec

# Builder et redémarrer les conteneurs
just rebuild

# Nettoyer les conteneurs et volumes
just clean
```

### Tests avec curl dans le conteneur

```bash
# Entrer dans le conteneur
just exec

# Tester le health check
curl http://localhost:3000/health

# Tester un endpoint de vérification
curl -X POST http://localhost:3000/phone-verification/request \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+33612345678"}'

# Tester avec un token JWT
curl -X GET http://localhost:3000/devices \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Compilation et Tests

```bash
# Compiler TypeScript
npm run build

# Lancer tous les tests
npm test

# Lancer les tests d'un module spécifique
npm test -- <module-name>

# Lancer les tests avec coverage
npm run test:cov

# Lancer les tests e2e
npm run test:e2e

# Lancer l'application en mode dev (local, sans Docker)
npm run start:dev

# Lancer l'application en mode production
npm run start:prod
```

### Migrations

```bash
# Générer une migration automatiquement
npm run migration:generate -- -n MigrationName

# Créer une migration vide
npm run migration:create -- -n MigrationName

# Exécuter les migrations
npm run migration:run

# Annuler la dernière migration
npm run migration:revert

# Afficher l'état des migrations
npm run migration:show
```

### Base de données

```bash
# Créer une sauvegarde de la BDD (PostgreSQL)
pg_dump -U username -d dbname -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Restaurer depuis une sauvegarde
pg_restore -U username -d dbname -c backup.dump

# Se connecter à la BDD
psql -U username -d dbname
```

### Git

```bash
# ⚠️ IMPORTANT: Rester sur la branche actuelle pour toute la migration
# Branche: WHISPR-287-transfer-nestjs-modules-from-modulith-repo

# Vérifier qu'on est sur la bonne branche
git branch --show-current
# Doit afficher: WHISPR-287-transfer-nestjs-modules-from-modulith-repo

# Voir les fichiers modifiés
git status

# Voir les différences
git diff

# Voir les différences d'un fichier spécifique
git diff <file-path>

# Ajouter tous les fichiers
git add .

# Ajouter des fichiers spécifiques
git add <file-path>

# Commit après chaque phase/module
git commit -m "feat(migration): descriptive message

- Change 1
- Change 2
- Tests passing: ✓"

# Pousser régulièrement vers la branche
git push origin WHISPR-287-transfer-nestjs-modules-from-modulith-repo

# Voir l'historique des commits
git log --oneline

# Créer une PR quand la migration est COMPLÈTE (Phase 6)
gh pr create --title "feat: Import improved NestJS modules architecture" --body "Description"
```

**⚠️ Stratégie de commits pour la migration** :
- Committer **après chaque phase validée** (voir sections "🔄 Commit Phase X")
- **NE PAS** créer de nouvelle branche
- **NE PAS** merger vers main pendant la migration
- Pousser régulièrement pour backup

### Recherche et Debug

```bash
# Rechercher tous les imports d'un module
grep -r "from.*module-name" src/

# Rechercher une string dans tous les fichiers
grep -r "search-string" src/

# Lister tous les fichiers d'un dossier récursivement
find src/modules/devices -type f

# Compter les fichiers de test
find src/ -name "*.spec.ts" | wc -l

# Voir les logs en temps réel
npm run start:dev | tee logs.txt
```

---

## 🔄 Plan de Rollback Rapide

En cas de problème critique, suivre ces étapes pour revenir en arrière :

### Rollback Code

```bash
# Si pas encore commité
git checkout .
git clean -fd

# Si commité mais pas poussé
git reset --hard HEAD~1

# Si poussé et mergé
git revert <commit-hash>

# Restaurer depuis les backups
cp -r src/modules/tokens.backup src/modules/tokens
cp -r src/modules/devices.backup src/modules/devices
cp -r src/modules/phone-verification.backup src/modules/phone-verification
cp -r src/modules/two-factor-authentication.backup src/modules/two-factor-authentication

# Recompiler
npm run build
```

### Rollback Base de données

```bash
# Annuler les migrations
npm run migration:revert

# Ou restaurer depuis le backup
pg_restore -U username -d dbname -c backup.dump
```

### Rollback Déploiement

```bash
# Redéployer la version précédente
git checkout <previous-version-tag>
npm install
npm run build
# Redémarrer l'application
```

---

## 📊 Métriques de Succès

### Métriques Techniques

- [ ] **Couverture de tests** : >= 80% (target: 85%)
- [ ] **Nombre de tests** : >= 19 fichiers
- [ ] **Temps de compilation** : <= 30 secondes
- [ ] **Temps de démarrage** : <= 5 secondes
- [ ] **Taille du bundle** : <= 10MB

### Métriques Fonctionnelles

- [ ] **Taux d'erreur** : < 0.1% en production
- [ ] **Temps de réponse moyen** : < 200ms
- [ ] **Temps de réponse p95** : < 500ms
- [ ] **Disponibilité** : >= 99.9%

### Métriques Business

- [ ] **Nombre d'utilisateurs impactés** : 0 (aucune régression)
- [ ] **Temps de migration total** : <= 15 heures
- [ ] **Nombre de bugs critiques post-déploiement** : 0

---

## ✅ Checklist de Validation Globale

Avant de considérer la migration comme complète, vérifier :

- [ ] **Architecture** : Tous les modules sont correctement importés et organisés
- [ ] **Tests** : 100% des tests passent
- [ ] **Coverage** : >= 80% de couverture
- [ ] **Compilation** : Aucune erreur TypeScript
- [ ] **Sécurité** : Guards, rate limits, et validations en place
- [ ] **Performance** : Aucune régression détectée
- [ ] **Documentation** : README, Swagger, et CHANGELOG à jour
- [ ] **Migration BDD** : Toutes les migrations exécutées, aucune perte de données
- [ ] **Déploiement Staging** : Testé et validé
- [ ] **Déploiement Production** : Déployé avec succès
- [ ] **Monitoring** : Aucune alerte, métriques normales
- [ ] **Rollback Plan** : Documenté et testé
- [ ] **Communication** : Équipe informée des changements

---

## 📅 Timeline

| Phase | Durée | Début prévu | Fin prévue |
|-------|-------|-------------|------------|
| Phase 1 : Modules Fondamentaux | 1-2h | __________ | __________ |
| Phase 2 : Modules Intermédiaires | 2-3h | __________ | __________ |
| Phase 3 : Module Signal | 2-3h | __________ | __________ |
| Phase 4 : Modules d'Authentification | 3-4h | __________ | __________ |
| Phase 5 : Racine et Nettoyage | 1h | __________ | __________ |
| Phase 6 : Tests et Déploiement | 1-2h | __________ | __________ |
| **TOTAL** | **11-15h** | __________ | __________ |

---

## 📌 Notes de Migration

### Observations pendant la migration

```
[Espace pour notes, observations, et problèmes rencontrés]

Date: ___________
Note:




```

### Problèmes rencontrés et solutions

```
[Documenter les problèmes et leurs solutions pour référence future]

Problème 1:
Solution:

Problème 2:
Solution:



```

### Décisions prises

```
[Documenter les décisions importantes prises pendant la migration]

Décision 1:
Justification:

Décision 2:
Justification:



```

---

**Date de début** : ___________
**Date de fin prévue** : ___________
**Date de fin réelle** : ___________
**Personne responsable** : ___________
**Statut** : ⬜ Non commencé / ⬜ En cours / ⬜ Terminé

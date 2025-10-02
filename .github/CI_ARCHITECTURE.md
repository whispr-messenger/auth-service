# 🔄 ANotre CI/CD est divisée en **7 workflows indépendants** qui se déclenchent en chaîne via des `workflow_call` events. Cette approche modulaire permet :

- ✅ **Maintenance facile** - Chaque workflow a une responsabilité unique
- ✅ **Déboggage simplifié** - Isolation des erreurs par domaine
- ✅ **Parallélisation** - Certaines étapes peuvent s'exécuter en parallèle
- ✅ **Réutilisabilité** - Les workflows peuvent être appelés individuellement
- ✅ **Performance** - Workflows plus courts et plus ciblés
- ✅ **Feedback précoce** - Analyse complète sur les PR (sauf déploiement)ture CI/CD

Cette documentation décrit l'architecture modulaire de notre pipeline CI/CD, conçue pour être maintenable, évolutive et performante.

## 📋 Vue d'ensemble

Notre CI/CD est divisée en **5 workflows indépendants** qui se déclenchent en chaîne via des `repository_dispatch` events. Cette approche modulaire permet :

- ✅ **Maintenance facile** - Chaque workflow a une responsabilité unique
- ✅ **Déboggage simplifié** - Isolation des erreurs par domaine
- ✅ **Parallélisation** - Certaines étapes peuvent s'exécuter en parallèle
- ✅ **Réutilisabilité** - Les workflows peuvent être appelés individuellement
- ✅ **Performance** - Workflows plus courts et plus ciblés

## 🏗️ Architecture

```
┌─────────────────┐
│  Main CI        │ ← Push/PR trigger
│  Pipeline       │
└─────────────────┘
          │
          ▼
┌─────────────────┐
│  Tests &        │
│  Quality        │ ← SonarQube, tests, lint
└─────────────────┘
          │
          ▼
┌─────────────────┐
│  Security       │ ← Trivy, audit, checks
│  Analysis       │
└─────────────────┘
          │
          ▼
┌─────────────────┐
│  Docker Build   │ ← Build, test, push
│  & Deploy       │
└─────────────────┘
          │
          ▼ (si main branch)
┌─────────────────┐
│  Deployment     │ ← Notifications, SBOM
│  Notification   │
└─────────────────┘

        +
┌─────────────────┐
│  Pipeline       │ ← Monitoring continu
│  Monitor        │
└─────────────────┘
```

## 📁 Workflows

Notre architecture est organisée en 3 catégories distinctes pour une maintenance optimale :

### 🚀 **Main Workflows** (`main/`)
**Déclencheur**: Événements GitHub (push/PR)

- `ci.yml` - Pipeline principal (main/develop)
- `pr-validation.yml` - Validation des pull requests

### � **Module Workflows** (`modules/`)
**Déclencheur**: `workflow_call` depuis les workflows principaux

- `tests.yml` - Tests unitaires, e2e, linting, SonarQube  
- `security.yml` - Scan Trivy, audit npm, vérifications sécuritaires
- `docker.yml` - Build Docker, attestations SBOM, push conditionnel
- `sbom-attestation.yml` - Vérification et analyse des attestations

### � **Monitoring Workflows** (`monitoring/`)
**Déclencheur**: Événements `workflow_run` et `repository_dispatch`

- `monitor.yml` - Surveillance des échecs, création d'issues automatique
- `notify.yml` - Notifications de déploiement et résumés

## �️ Local Development

### Quick Commands
Instead of custom scripts, use standard tools directly:

```bash
# Full validation before push
npm ci && npm run lint && npm run test:cov && npm run build

# Docker build and test  
docker build -t auth-service:local . && docker run --rm -p 3001:3001 auth-service:local

# SBOM generation and analysis
syft auth-service:local -o spdx-json > sbom.json && grype sbom:sbom.json

# Attestation verification (for published images)
gh attestation verify oci://ghcr.io/whispr-messenger/auth-service:latest --repo whispr-messenger/auth-service
```

See [DEVELOPMENT.md](../DEVELOPMENT.md) for detailed local development commands.

## 🔧 Configuration

### Prerequisites
1. GitHub Container Registry access
2. SonarQube/SonarCloud account  
3. Required GitHub secrets

### Secrets required
```bash
SONAR_TOKEN=your_sonar_token
SONAR_HOST_URL=https://sonarcloud.io  # or your instance
# GITHUB_TOKEN is automatically provided
```

### Local tools (optional)
```bash
# Install analysis tools for local validation
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin
```

## 🎯 Usage

### For Pull Requests
The `pr-validation.yml` workflow runs automatically and provides **comprehensive analysis**:
- ✅ **Basic validation** (lint, format, tests, build)
- ✅ **Security analysis** (Trivy, npm audit, pattern checks)
- ✅ **SBOM generation** and vulnerability scanning with Grype
- ✅ **Docker security** scanning
- ⏭️ **SonarQube** skipped (Community Edition limitation)
- 📝 **Automatic summary** comment with detailed results

**Avantages**: Feedback sécuritaire précoce, détection des vulnérabilités avant merge, validation complète sans déploiement.

### For Push to main
The complete chain executes with **additional deployment steps**:
1. **Full analysis** (same as PR + SonarQube)
2. **Docker build and push** with multi-platform support
3. **SBOM + Provenance attestations** with Sigstore
4. **Attestation verification** and compliance checks
5. **Deployment notifications** and monitoring

### Manual workflow triggers
You can trigger specific workflows manually:
```bash
# Via GitHub CLI
gh workflow run tests.yml

# Via GitHub UI: Actions tab > Select workflow > Run workflow
```

## 🔍 Monitoring et Debug

### Logs centralisés
Chaque workflow génère des logs détaillés accessibles via :
- GitHub Actions UI
- GitHub CLI : `gh run list` et `gh run view`

### Issues automatiques
Le monitor crée automatiquement des issues en cas d'échec sur `main` avec :
- Détails de l'erreur
- Liens vers les logs
- Instructions de correction

### Métriques disponibles
- Temps d'exécution par workflow
- Taux de réussite
- Coverage de code via SonarQube

## 📈 Optimisations

### Cache Strategy
- **npm dependencies** : Cache automatique via `actions/setup-node`
- **Docker layers** : Cache GitHub Actions Registry
- **SonarQube** : Cache incrémental des analyses

### Parallélisation
Les workflows s'exécutent séquentiellement par sécurité, mais certaines tâches internes sont parallélisées.

### Resource Management
- Workflows courts (~5-10 min chacun)
- Arrêt anticipé en cas d'échec
- Nettoyage automatique des artefacts

## 🛠️ Maintenance

### Mise à jour des workflows
1. Modifier le workflow concerné
2. Tester sur une branche de feature
3. Merger vers `main`

### Ajout d'un nouveau workflow
1. Créer le fichier `.github/workflows/nouveau.yml`
2. Ajouter le déclencheur dans le workflow parent
3. Mettre à jour cette documentation

### Troubleshooting

#### SonarQube Quality Gate fails
```bash
# Check configuration
cat sonar-project.properties

# Run analysis locally
npm run test:cov
npx sonar-scanner
```

#### Docker build fails
```bash
# Test locally
docker build -t auth-service:test .
docker run --rm auth-service:test
```

#### Flaky tests
```bash
# Run multiple times
npm run test -- --runInBand --detectOpenHandles
```

#### Attestation verification fails
```bash
# Check image and attestations
gh attestation verify oci://ghcr.io/whispr-messenger/auth-service:latest --repo whispr-messenger/auth-service
```

## 📚 Références

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [SonarQube Documentation](https://docs.sonarqube.org/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Repository Dispatch Events](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event)
# 🔄 Workflows Organization

This directory contains all GitHub Actions workflows organized for clarity and maintainability.

## 📁 Structure

```
workflows/
├── main/                    # Entry point workflows (triggered by events)
│   ├── ci.yml              # Main CI/CD pipeline (push to main/develop)
│   └── pr-validation.yml   # Pull Request validation
├── modules/                 # Reusable workflow modules (called by others)
│   ├── tests.yml           # Tests & Quality Analysis
│   ├── security.yml        # Security Analysis (Trivy, audit)
│   ├── docker.yml          # Docker Build & Deploy
│   └── sbom-attestation.yml # SBOM Attestation Analysis
└── monitoring/              # Monitoring & Notification workflows
    ├── monitor.yml         # Pipeline failure monitoring
    └── notify.yml          # Deployment notifications
```

## 🎯 Workflow Types

### 🚀 **Main Workflows** (`main/`)
- **Entry points** triggered by GitHub events (push, PR)
- **Orchestrate** the execution of module workflows
- **Define** deployment conditions and environment-specific logic

### 🧩 **Module Workflows** (`modules/`)
- **Reusable** workflows called by main workflows via `workflow_call`
- **Single responsibility** - each handles one aspect (tests, security, etc.)
- **Parameterized** - behavior controlled by inputs (`should_deploy`, `ref`, etc.)

### 📊 **Monitoring Workflows** (`monitoring/`)
- **Event-driven** - triggered by workflow completion events
- **Observability** - track pipeline health and notify on failures
- **Automated** - create issues, send notifications, manage workflow lifecycle

## 🔗 Dependencies

### Main CI Pipeline (`main/ci.yml`)
```mermaid
graph LR
    A[ci.yml] --> B[modules/tests.yml]
    B --> C[modules/security.yml]
    C --> D[modules/docker.yml]
    D --> E[monitoring/notify.yml]
```

### PR Validation (`main/pr-validation.yml`)
```mermaid
graph LR
    A[pr-validation.yml] --> B[modules/tests.yml]
    B --> C[modules/security.yml]
    C --> D[modules/docker.yml]
    D --> E[pr-summary]
```

## 🛠️ Usage

### Adding a new module workflow
1. Create the workflow in `modules/`
2. Add `workflow_call` trigger with required inputs
3. Reference it from main workflows using relative path

### Modifying existing workflows
- **Module changes** automatically apply to all consumers
- **Main workflows** control orchestration and deployment logic
- **Monitoring** workflows are independent and event-driven

## 📚 Documentation

For detailed architecture information, see:
- [CI_ARCHITECTURE.md](../CI_ARCHITECTURE.md) - Complete pipeline documentation
- [DEVELOPMENT.md](../../DEVELOPMENT.md) - Local development commands
- [SONARQUBE_SETUP.md](../SONARQUBE_SETUP.md) - SonarQube configuration

## 🔧 Maintenance

### File Naming Conventions
- `main/` - Descriptive names for entry points (`ci.yml`, `pr-validation.yml`)
- `modules/` - Functional names (`tests.yml`, `security.yml`, `docker.yml`)
- `monitoring/` - Action-based names (`monitor.yml`, `notify.yml`)

### Best Practices
1. **Keep modules focused** - single responsibility principle
2. **Use consistent inputs** - `ref`, `should_deploy` pattern
3. **Document changes** - update this README when adding workflows
4. **Test thoroughly** - changes to modules affect multiple consumers
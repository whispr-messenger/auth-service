# Development Guide

This guide covers common tasks and best practices when developing for the Authentication Service.

## Local Workflow

The entire service is containerized to ensure consistency across environments. The project uses a `Justfile` to wrap complex Docker commands.

### Running the Service
- **Start**: `just up dev` (starts DB, Redis, and API)
- **Stop**: `just down dev` (removes containers and volumes)
- **Logs**: `just logs dev` (follows logs from all containers)

### Executing Commands
To run commands inside the running `auth-service` container:
```bash
just shell
# inside the shell, you can run:
npm run lint
npm run format
```

## Testing

Tests are executed inside the Docker environment to ensure they run against the correct versions of dependencies.

- **All Tests**: `just test`
- **Unit Tests**: `docker compose -f docker/dev/compose.yml exec auth-service npm run test`
- **E2E Tests**: `docker compose -f docker/dev/compose.yml exec auth-service npm run test:e2e`

## Debugging

The development container exposes port `9229` for the Node.js debugger. You can attach your IDE (VS Code, WebStorm) to this port to debug the running application.

## Coding Standards

- **Linting**: We use ESLint. Run `npm run lint` to check for issues.
- **Formatting**: We use Prettier. Run `npm run format` to automatically fix formatting.
- **SWC**: We use the SWC builder for faster compilation during development.

---

**See also:** [Database Migrations](./database-migrations.md)

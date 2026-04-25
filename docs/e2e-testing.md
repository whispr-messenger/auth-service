# Tests E2E

## Setup

Les tests E2E utilisent un vrai PostgreSQL et Redis via Docker.

```bash
npm run test:e2e:docker
npm run test:e2e:docker:cleanup
```

## Structure

Les tests sont dans `test/*.e2e-spec.ts`.

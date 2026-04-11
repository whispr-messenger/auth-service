# ADR 0002: CORS Origin Whitelist via Environment Variable

## Status
Accepted

## Date
2026-04-11

## Context
The auth-service was initially configured with a permissive CORS policy:

```typescript
app.enableCors({
  origin: true,
  credentials: true,
  // ...
});
```

`origin: true` reflects **any** requesting origin in the
`Access-Control-Allow-Origin` response header, and combined with
`credentials: true` it would allow any third-party site to make authenticated
requests on behalf of a logged-in user if session cookies were ever introduced.

The primary clients of this service are:

1. A **native mobile application** (React Native) — does not use a browser
   network stack and ignores CORS entirely.
2. A **web build of the same application** (React Native Web) — runs in a
   browser and is subject to the same-origin policy, so it **does** need
   CORS to be enabled for its origin.
3. **Other microservices** — communicate server-to-server, no browser, no
   CORS needed.

There is **no API gateway** in front of the service: mobile and web clients
query auth-service directly at its public URL per environment.

The initial wildcard config was introduced to unblock the web build. However
it is too permissive for production use, would be flagged by SonarCloud as a
security smell, and becomes a CSRF vector the day a cookie-based credential
is added to the service.

## Decision
CORS is configured via a single environment variable, `CORS_ORIGINS`, holding
a comma-separated list of allowed origins. The bootstrap code parses the
variable at startup:

```typescript
const corsOrigins = configService
  .get<string>('CORS_ORIGINS', '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (corsOrigins.length > 0) {
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
  });
}
```

Rules:

- **Default (variable unset or empty)**: CORS is disabled entirely. This is
  the correct posture for the mobile + microservice-only case.
- **Variable set**: only the listed origins are allowed. Each environment
  declares its own whitelist (e.g.
  `CORS_ORIGINS=https://app-preprod.whispr.xyz,https://app.whispr.xyz`).
- `CORS_ORIGINS` is declared as an **optional** environment variable in
  `src/docker/check-env.ts` with the default documented as "CORS disabled".
- The previous unused `ENABLE_CORS` flag in `docker/prod/.env.example` has
  been removed — it was never read by any code.

## Consequences

### Advantages
- **Secure by default**: an unset variable means no cross-origin access,
  which is the correct posture for the most common deployment (mobile only).
- **No wildcard exposure**: even when CORS is enabled, only explicit origins
  are trusted, eliminating the CSRF risk that a reflected `origin: true`
  would open if cookies were introduced later.
- **Per-environment control**: preprod and prod can list different origins
  without code changes.
- **Standard pattern**: comma-separated origin lists are the convention used
  by most Node.js / NestJS CORS configurations.

### Disadvantages
- **Operational coupling**: adding a new web client host requires an
  environment variable update and a restart. This is acceptable because new
  client hosts are rare and deliberate.
- **No wildcard subdomain support** in the current implementation. If we
  ever need `*.whispr.xyz`, we will need to switch to a function-based
  `origin` callback. Not a concern today.

### Follow-ups
- Once the mobile team confirms the canonical URLs of the React Native Web
  build, add `CORS_ORIGINS` to the preprod and prod environments via the
  infrastructure repo secrets.
- Consider a future ADR if we ever need per-route CORS policies (currently
  a single global policy covers all endpoints).

## Alternatives Considered

- **Keep `origin: true` with credentials** — rejected as too permissive and
  a latent CSRF vector.
- **Hardcode the origin list in `main.ts`** — rejected because preprod and
  prod need different lists, and hardcoding forces a redeploy for each
  change.
- **Remove CORS entirely** — rejected because it would break the React
  Native Web build that the mobile team is shipping.
- **Per-request origin validation via custom middleware** — rejected as
  overkill; NestJS's built-in `enableCors` already supports an array of
  allowed origins, which is all we need.

## References
- Pull Request: [#155 — Réconcilier les branches de pré-production et de production](https://github.com/whispr-messenger/auth-service/pull/155)
- NestJS CORS docs: <https://docs.nestjs.com/security/cors>
- OWASP CSRF Prevention Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html>

# ADR 0003: API Versioning via URI Prefix

## Status
Accepted

## Date
2026-04-11

## Context
The auth-service exposes an HTTP API consumed directly by a mobile
application, without any API gateway in front. The mobile app ships as a
native binary through the App Store and Google Play, which means:

- Old versions of the app remain installed on user devices for weeks or
  months after a new version is released.
- The service must continue to serve **already-deployed** clients while also
  serving **newer** clients that may use different request/response shapes.
- Breaking changes to endpoint contracts cannot be rolled out atomically —
  the server must keep the old contract available until the install base
  has upgraded.

Without versioning, any breaking change to a controller forces an immediate
client upgrade or breaks existing installs.

A prior change in the `deploy/preprod` branch attempted to remove URI
versioning on the assumption that a future API gateway would handle
versioning at the edge. That assumption is incorrect — there is no gateway,
and there is no short-term plan to introduce one. The removal was therefore
reverted, and this ADR formalises the chosen approach.

## Decision
API versioning is enabled at the NestJS level using URI prefixing:

```typescript
app.setGlobalPrefix('auth');
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
  prefix: 'v',
});
```

As a result, every endpoint is served under `/auth/v{N}/...`. Today all
endpoints run on `v1`; new major versions of individual endpoints can opt
into `v2`, `v3`, etc. using the `@Version()` decorator without disturbing
existing routes.

Rules:

- **URI versioning**, not header-based versioning. The mobile clients build
  URLs directly and do not set custom version headers reliably across all
  platforms.
- **Prefix `v`**, so routes look like `/auth/v1/health/ready`.
- **Default version `1`**, so controllers that do not explicitly declare
  a version are served at `/auth/v1/...`.
- The Docker health-check probes `/auth/v1/health/ready` — any change to
  the versioning scheme must update the health-check script in
  `src/docker/health-check.ts`.

## Consequences

### Advantages
- **Backwards compatibility without code forks**: a new version of an
  endpoint can be added as a `v2` route side-by-side with the existing
  `v1`, and old clients continue to work unchanged.
- **Explicit contracts**: the version is visible in request logs, traces,
  and metrics, making it easy to track who is still calling which version.
- **No gateway required**: versioning lives in application code, so the
  architecture does not depend on infrastructure we do not have.
- **Standard NestJS primitive**: uses the built-in `enableVersioning` API,
  no custom middleware.

### Disadvantages
- **Every route URL embeds `/v1/`**, which is visual noise for developers
  writing new endpoints. Acceptable — it is a one-time learning curve.
- **Removing an old version is a coordinated effort**: it requires tracking
  mobile app install metrics and announcing deprecation windows before
  deleting routes.
- **Infrastructure (nginx, k8s ingress) must not strip or rewrite the
  prefix**. Any ingress rewrite that affects `/auth/v1/` is a breaking
  change.

### Follow-ups
- When introducing a `v2` endpoint, document the migration in a dedicated
  ADR or in the endpoint's OpenAPI description.
- Monitor the version distribution in access logs to know when a major
  version can be safely retired.

## Alternatives Considered

- **No versioning, rely on an API gateway** — rejected because no gateway
  exists and none is planned short-term. This was the approach attempted
  and then reverted on `deploy/preprod`.
- **Header-based versioning** (`Accept: application/vnd.whispr.v2+json`) —
  rejected because it is harder to reproduce with curl / Postman during
  development and debugging, and because the mobile clients build URLs
  dynamically while headers are set in a shared HTTP client where drift is
  easier to miss.
- **Query parameter versioning** (`?v=2`) — rejected as non-idiomatic and
  bad for caching.
- **Content negotiation via custom media types** — rejected as overkill for
  our needs and unfamiliar to the team.

## References
- Pull Request: [#155 — Réconcilier les branches de pré-production et de production](https://github.com/whispr-messenger/auth-service/pull/155)
- NestJS versioning docs: <https://docs.nestjs.com/techniques/versioning>

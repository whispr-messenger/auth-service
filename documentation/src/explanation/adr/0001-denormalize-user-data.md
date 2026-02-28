# ADR 0001: Separation of Responsibilities Between auth-service and user-service

## Status
Accepted

## Date
2025-04-11

## Context
In our microservices architecture for the Whispr application, we need to precisely define the separation of responsibilities between the authentication service (auth-service) and the user service (user-service). This decision is particularly important as it impacts:

1. User data management.
2. Multi-device authentication.
3. Service autonomy and resilience.
4. Performance of frequent authentication operations.
5. Implementation complexity of E2E encryption.

Our current architecture uses gRPC for inter-service communication and maintains distinct PostgreSQL databases for each service. We also use Redis for temporary authentication data.

## Decision
We have decided to implement **controlled denormalization** of user data between auth-service and user-service, with the following distribution:

### In auth-service (PostgreSQL)
- `users_auth` table containing:
  - `id` (same UUID as in user-service).
  - `phoneNumber` (unique identifier for authentication).
  - `twoFactorSecret` (authentication-related data).
  - `twoFactorEnabled` (flag).
  - `lastAuthenticatedAt` (timestamp).
  - Temporal information (`createdAt`, `updatedAt`).

- Tables related to devices and cryptographic keys:
  - `devices`, `prekeys`, `signed_prekeys`, `identity_keys`, `backup_codes`, `login_history`.

### In user-service (PostgreSQL)
- `users` table containing the full profile (firstName, lastName, username, etc.) and preferences.

## Consequences

### Advantages
1. **Service Autonomy**: The auth-service can operate independently for critical operations.
2. **Performance**: No need for synchronous gRPC calls for every authentication check.
3. **Enhanced Security**: Separation of sensitive authentication data from user profile data.

### Disadvantages
1. **Partial Data Duplication**: The phone number and user identifier are duplicated.
2. **Synchronization Required**: Mechanisms must be in place to maintain consistency.

## Success Metrics
- Authentication operation response time < 200ms.
- auth-service availability > 99.9%.

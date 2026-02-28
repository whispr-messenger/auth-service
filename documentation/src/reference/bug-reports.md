# Bug Reports Archive

This section tracks significant bugs and their resolutions for the Authentication Service.

## [2026-02-19] No Redis Sentinel Support and Silent Health Check Failure

### Issue
The `auth-service` lacked support for **Redis Sentinel** in its configuration, preventing high-availability deployments. Additionally, the health check mechanism was "silent," meaning it wouldn't properly report a degraded state if Redis was unreachable but the application was still running.

### Impact
- **Availability**: Redis failover was not supported.
- **Observability**: Kubernetes probes could not detect Redis connection issues, leading to traffic being routed to "zombie" instances.

### Resolution
- Integrated `ioredis` with Sentinel support.
- Updated `HealthModule` to explicitly check Redis connectivity.
- Added `REDIS_SENTINEL_NODES` and `REDIS_SENTINEL_NAME` environment variables.

---

*For more recent issues, please refer to the project's GitHub Issues.*

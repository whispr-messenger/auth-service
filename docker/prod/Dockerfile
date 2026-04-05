# Stage 1 — TypeScript compilation (runs natively on the build host to avoid QEMU SIGILL)
ARG BUILDPLATFORM=linux/amd64
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig*.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2 — Production dependencies (runs on the target platform for correct native addons)
FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./
COPY package-lock.json ./
RUN npm ci --no-audit --no-fund --omit=dev

# Stage 3 — Final image
FROM gcr.io/distroless/nodejs22-debian12 AS production

LABEL maintainer="Whisper Team" \
    service="auth-service" \
    version="1.0.0" \
    environment="production" \
    cloud.provider="gcp" \
    org.opencontainers.image.source="https://github.com/whisper/auth-service" \
    org.opencontainers.image.description="Whisper Authentication Service" \
    org.opencontainers.image.licenses="MIT" \
    security.scan="enabled" \
    optimization.level="production" \
    gcp.cloud-run="compatible" \
    gcp.gke="compatible" \
    monitoring.prometheus="enabled"

WORKDIR /app

# Use numeric UID/GID 65532 for nonroot in distroless images
COPY --from=deps    --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=builder --chown=65532:65532 /app/dist ./dist
COPY --from=builder --chown=65532:65532 /app/package*.json ./

USER 65532

ENV NODE_ENV=production

EXPOSE 3001 50051

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD ["dist/docker/health-check.js"]

CMD ["dist/docker/entrypoint.js"]

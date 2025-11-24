# Multi-stage Dockerfile optimized for GCP production deployment
# Auth Service - Whisper Microservices

# Build stage
FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Set working directory
WORKDIR /app

# Copy package files (including lockfile) and install full deps for build
COPY package*.json ./
COPY package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy tsconfig and source, then build
COPY tsconfig*.json ./
COPY src/ ./src/
RUN npm run build

# Remove devDependencies to keep only production deps
RUN npm prune --production

# Production stage
FROM gcr.io/distroless/nodejs22-debian12 AS production

# Labels for GCP and container registry
LABEL maintainer="Whisper Team" \
      service="auth-service" \
      version="1.0.0" \
      environment="production" \
      cloud.provider="gcp" \
      org.opencontainers.image.source="https://github.com/whisper/auth-service" \
      org.opencontainers.image.description="Whisper Authentication Service" \
      org.opencontainers.image.licenses="MIT"

# Set working directory
WORKDIR /app

# Copy built application and production deps from builder
# Use numeric UID/GID 65532 for nonroot in distroless images
COPY --from=builder --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=builder --chown=65532:65532 /app/dist ./dist
COPY --from=builder --chown=65532:65532 /app/package*.json ./

# Run as non-root (distroless typically maps to uid 65532)
USER 65532

# Environment variables for production
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512 --enable-source-maps" \
    PORT=3001 \
    GRPC_PORT=50051 \
    LOG_LEVEL=info \
    METRICS_ENABLED=true \
    HEALTH_CHECK_TIMEOUT=5000

# Expose ports (documentation only)
EXPOSE 3001 50051

# Health check optimized for GCP (ensure dist/health-check.js is produced by build)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD ["node", "dist/health-check.js"]

# Start the application
CMD ["dist/main.js"]

# Security and optimization metadata
LABEL security.scan="enabled" \
      optimization.level="production" \
      gcp.cloud-run="compatible" \
      gcp.gke="compatible" \
      monitoring.prometheus="enabled"

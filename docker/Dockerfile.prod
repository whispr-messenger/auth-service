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

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies with optimizations
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generate Prisma client and build application
RUN npx prisma generate && \
    npm run build && \
    npm prune --production

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

# Copy built application from builder stage
COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /app/prisma ./prisma
COPY --from=builder --chown=nonroot:nonroot /app/package*.json ./

# Create necessary directories with proper permissions
USER nonroot

# Environment variables for production
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512 --enable-source-maps" \
    PORT=3001 \
    GRPC_PORT=50051 \
    LOG_LEVEL=info \
    METRICS_ENABLED=true \
    HEALTH_CHECK_TIMEOUT=5000

# Expose ports
EXPOSE 3001 50051

# Health check optimized for GCP
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD ["node", "dist/health-check.js"]

# Start the application
CMD ["node", "dist/main.js"]

# Security and optimization metadata
LABEL security.scan="enabled" \
      optimization.level="production" \
      gcp.cloud-run="compatible" \
      gcp.gke="compatible" \
      monitoring.prometheus="enabled"

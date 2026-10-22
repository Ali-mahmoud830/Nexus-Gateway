# ============================================================
# Dockerfile — Nexus-Gateway Backend (Production)
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies for compilation)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Compile TypeScript to JavaScript in /app/dist
RUN npm run build

# Remove development dependencies to keep container slim
RUN npm prune --omit=dev

# ============================================================
# Production Runner Stage
# ============================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install security updates
RUN apk --no-cache add ca-certificates

# Create non-root system user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy node_modules and built dist from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Create log directory and assign ownership
RUN mkdir -p logs && chown -R appuser:appgroup /app

USER appuser

# Expose default port (Render/Cloud providers dynamically override with $PORT)
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT:-4000}/api/v1/health || exit 1

# Start production server
CMD ["node", "dist/server.js"]

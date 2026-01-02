# Multi-stage build: First build trade-engine
FROM node:20-alpine AS trade-engine-builder
WORKDIR /build
COPY trade-engine/package*.json ./
COPY trade-engine/tsconfig.json ./
COPY trade-engine/src ./src
COPY shared ./shared
RUN npm install && npm run build

# Main build stage
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies (including dev for TypeScript)
COPY telegram-bot/package*.json ./
RUN npm install && npm cache clean --force

# Copy TypeScript config
COPY telegram-bot/tsconfig.json ./

# Copy source code
COPY telegram-bot/src ./src

# Copy shared libraries
COPY shared ./shared

# Copy compiled trade-engine dist from builder stage
COPY --from=trade-engine-builder /build/dist ./trade-engine/dist

# Build TypeScript
RUN npm run build
RUN ls -la && ls -la dist/ 2>&1 || echo "dist not found after build"

# Remove dev dependencies (but keep dist folder)
RUN npm prune --production

# Create logs directory
RUN mkdir -p /app/logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node healthcheck.js || exit 1

# Start application
CMD ["node", "dist/src/index.js"]


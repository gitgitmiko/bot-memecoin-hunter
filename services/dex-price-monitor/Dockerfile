FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies (including dev for TypeScript)
COPY dex-price-monitor/package*.json ./
RUN npm install && npm cache clean --force

# Copy TypeScript config
COPY dex-price-monitor/tsconfig.json ./

# Copy source code
COPY dex-price-monitor/src ./src

# Copy shared folder (from services directory context)
COPY shared ./shared

# Copy trade-engine source for TradeService (needed for auto-sell operations)
COPY trade-engine/src ./trade-engine/src

# Copy shared to trade-engine so relative imports work (../../shared)
RUN cp -r shared trade-engine/shared || true

# Keep trade-engine/src for runtime (needed for dynamic require)
# Files will be available at runtime via volume mount or copy

# Build TypeScript
RUN npm run build

# Remove dev dependencies
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
CMD ["node", "dist/index.js"]


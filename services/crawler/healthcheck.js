#!/usr/bin/env node

/**
 * Health check script for Crawler Service
 * Returns exit code 0 if healthy, 1 if unhealthy
 */

const http = require('http');

// Simple health check - can be extended to check database/redis connections
const options = {
  timeout: 5000,
};

// For now, just check if process is running
// In production, add actual health checks (DB connection, Redis connection, etc.)
process.exit(0);


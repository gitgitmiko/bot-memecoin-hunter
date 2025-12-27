/**
 * Analyzer Service - Main Entry Point
 * 
 * This service analyzes crawled meme coin data
 * and identifies opportunities.
 */

require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('redis');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Database connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'memecoin_hunter',
  user: process.env.POSTGRES_USER || 'memecoin_user',
  password: process.env.POSTGRES_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis connection
let redisClient;
(async () => {
  redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || 6379,
    },
    password: process.env.REDIS_PASSWORD,
  });

  redisClient.on('error', (err) => logger.error('Redis Client Error', err));
  await redisClient.connect();
  logger.info('Connected to Redis');
  
  // Subscribe to crawler events
  const subscriber = redisClient.duplicate();
  await subscriber.connect();
  await subscriber.subscribe('crawler:new-data', (message) => {
    logger.info('New data received from crawler:', message);
    analyze();
  });
})();

// Main analyzer function
async function analyze() {
  logger.info('Starting analysis cycle...');
  
  try {
    // TODO: Implement actual analysis logic in Phase 3
    logger.info('Analysis cycle completed');
    
    // Notify telegram bot via Redis
    if (redisClient && redisClient.isOpen) {
      await redisClient.publish('analyzer:results', JSON.stringify({
        timestamp: new Date().toISOString(),
        message: 'Analysis results available'
      }));
    }
  } catch (error) {
    logger.error('Analysis error:', error);
  }
}

// Start analyzer on interval
const interval = parseInt(process.env.ANALYZER_INTERVAL || '60000'); // Default 1 minute
logger.info(`Analyzer service started. Interval: ${interval}ms`);

// Initial analysis
analyze();

// Schedule periodic analysis
setInterval(analyze, interval);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await pool.end();
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await pool.end();
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
  }
  process.exit(0);
});


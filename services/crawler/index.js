/**
 * Crawler Service - Main Entry Point
 * 
 * This service crawls meme coin data from various sources
 * and stores them in PostgreSQL database.
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
})();

// Main crawler function
async function crawl() {
  logger.info('Starting crawl cycle...');
  
  try {
    // TODO: Implement actual crawling logic in Phase 3
    logger.info('Crawl cycle completed');
    
    // Notify analyzer via Redis
    if (redisClient && redisClient.isOpen) {
      await redisClient.publish('crawler:new-data', JSON.stringify({
        timestamp: new Date().toISOString(),
        message: 'New data available for analysis'
      }));
    }
  } catch (error) {
    logger.error('Crawl error:', error);
  }
}

// Start crawler on interval
const interval = parseInt(process.env.CRAWLER_INTERVAL || '300000'); // Default 5 minutes
logger.info(`Crawler service started. Interval: ${interval}ms`);

// Initial crawl
crawl();

// Schedule periodic crawls
setInterval(crawl, interval);

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


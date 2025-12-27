/**
 * Telegram Bot Service - Main Entry Point
 * 
 * This service handles Telegram bot commands and notifications.
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
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

// Validate required environment variables
if (!process.env.TELEGRAM_BOT_TOKEN) {
  logger.error('TELEGRAM_BOT_TOKEN is required!');
  process.exit(1);
}

// Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

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
  
  // Subscribe to analyzer events
  const subscriber = redisClient.duplicate();
  await subscriber.connect();
  await subscriber.subscribe('analyzer:results', (message) => {
    logger.info('Analysis results received:', message);
    // TODO: Send notification to Telegram in Phase 3
  });
})();

// Bot commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome to Memecoin Hunter Bot! 🚀\n\nUse /help to see available commands.');
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpText = `
📋 Available Commands:

/start - Start the bot
/help - Show this help message
/status - Check bot status
/stats - Show statistics

More commands will be available in Phase 3.
  `;
  bot.sendMessage(chatId, helpText);
});

bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '✅ Bot is running!\n\nStatus: Active\nPhase: 2 (Infrastructure Setup)');
});

bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    // TODO: Implement actual stats query in Phase 3
    bot.sendMessage(chatId, '📊 Statistics:\n\nComing soon in Phase 3...');
  } catch (error) {
    logger.error('Error getting stats:', error);
    bot.sendMessage(chatId, '❌ Error retrieving statistics.');
  }
});

// Handle errors
bot.on('polling_error', (error) => {
  logger.error('Telegram polling error:', error);
});

logger.info('Telegram bot service started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  bot.stopPolling();
  await pool.end();
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  bot.stopPolling();
  await pool.end();
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
  }
  process.exit(0);
});


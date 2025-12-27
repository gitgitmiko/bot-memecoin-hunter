import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { initRedis, getRedisClient } from './config/redis';
import { testConnection } from './config/database';
import { logger } from './config/logger';
import { NotificationService } from './services/notification.service';
import { DataService } from './services/data.service';
import { REDIS_QUEUES } from './utils/constants';

dotenv.config();

/**
 * Telegram Bot Service
 * Handles alerts and user commands
 */
class TelegramBotService {
  private bot: TelegramBot | null = null;
  private notificationService: NotificationService | null = null;
  private dataService: DataService = new DataService();

  /**
   * Initialize services
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Telegram bot service...');

    // Validate bot token
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    logger.info('Database connection established');

    // Initialize Redis
    await initRedis();
    logger.info('Redis connection established');

    // Initialize Telegram bot with reduced polling frequency to avoid rate limiting
    // Polling interval: 5 seconds (default is 1-2 seconds)
    this.bot = new TelegramBot(botToken, { 
      polling: {
        interval: 5000, // 5 seconds instead of default 1-2 seconds
        autoStart: true,
        params: {
          timeout: 10, // Long polling timeout
        }
      }
    });
    this.notificationService = new NotificationService(botToken);

    // Setup bot handlers
    this.setupHandlers();

    logger.info('Telegram bot service initialized successfully');
  }

  /**
   * Setup bot command handlers
   */
  setupHandlers(): void {
    if (!this.bot) return;

    // /start command
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const welcomeMessage = `
🚀 <b>Welcome to Memecoin Hunter Bot!</b>

I'll alert you when we discover high-scoring meme coins.

<b>Available commands:</b>
/start - Show this message
/help - Show help message
/stats - Show statistics
/status - Check bot status

<b>Database Commands:</b>
/dbstats - 📊 Database statistics (total coins, analyses, high scores)
/dblist [limit] - 📋 List recent coins by created_at (default: 10, max: 20)
/dbnew [limit] - 🆕 List new coins by discovered_at (default: 10, max: 20)
/dbcoin &lt;address&gt; - 🪙 Get detailed coin information by address
/dbhighscore [limit] - ⭐ List high score coins (score > 70, default: 10, max: 20)

<i>Stay tuned for coin alerts! 📈</i>
      `.trim();

      this.bot!.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'HTML',
      }).catch((error) => {
        logger.error('Error sending start message:', error);
      });
    });

    // /help command
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      const helpMessage = `
📋 <b>Bot Commands:</b>

<b>Basic Commands:</b>
/start - Start the bot
/help - Show this help
/stats - Show statistics
/status - Check bot status

<b>Database Commands:</b>
/dbstats - 📊 Show database statistics (total coins, analyses, high scores, latest dates)
/dblist [limit] - 📋 List recent coins ordered by created_at (default: 10, max: 20)
/dbnew [limit] - 🆕 List new coins ordered by discovered_at (default: 10, max: 20)
/dbcoin &lt;address&gt; - 🪙 Get detailed coin information by address (Ethereum/Solana)
/dbhighscore [limit] - ⭐ List coins with overall_score > 70 (default: 10, max: 20)

<b>About:</b>
This bot monitors new meme coins and alerts you when we find high-scoring opportunities.

⚠️ <i>Always do your own research before investing!</i>
      `.trim();

      this.bot!.sendMessage(chatId, helpMessage, {
        parse_mode: 'HTML',
      }).catch((error) => {
        logger.error('Error sending help message:', error);
      });
    });

    // /status command
    this.bot.onText(/\/status/, (msg) => {
      const chatId = msg.chat.id;
      const statusMessage = `
✅ <b>Bot Status: Active</b>

🟢 All systems operational
📊 Monitoring for new coins
🔔 Alerts enabled

<i>Bot is running and ready!</i>
      `.trim();

      this.bot!.sendMessage(chatId, statusMessage, {
        parse_mode: 'HTML',
      }).catch((error) => {
        logger.error('Error sending status message:', error);
      });
    });

    // /stats command
    this.bot.onText(/\/stats/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const stats = await this.dataService.getStats();
        const statsMessage = `
📊 <b>Statistics</b>

🪙 <b>Total Coins:</b> ${stats.totalCoins}
📈 <b>Total Analyses:</b> ${stats.totalAnalyses}
⭐ <b>High Score Coins:</b> ${stats.highScoreCoins} (score > 70)

${stats.latestCoinDate ? `📅 <b>Latest Coin:</b> ${new Date(stats.latestCoinDate).toLocaleString()}` : ''}
${stats.latestAnalysisDate ? `📅 <b>Latest Analysis:</b> ${new Date(stats.latestAnalysisDate).toLocaleString()}` : ''}

<i>Use /dbstats for more detailed database statistics</i>
        `.trim();

        this.bot!.sendMessage(chatId, statsMessage, {
          parse_mode: 'HTML',
        }).catch((error) => {
          logger.error('Error sending stats message:', error);
        });
      } catch (error) {
        logger.error('Error getting stats:', error);
        this.bot!.sendMessage(chatId, '❌ Error getting statistics. Please try again later.').catch(() => {});
      }
    });

    // /dbstats command
    this.bot.onText(/\/dbstats/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const stats = await this.dataService.getStats();
        const statsMessage = `
📊 <b>Database Statistics</b>

<b>📦 Data Overview:</b>
🪙 <b>Total Coins:</b> ${stats.totalCoins.toLocaleString()}
📈 <b>Total Analyses:</b> ${stats.totalAnalyses.toLocaleString()}
⭐ <b>High Score Coins:</b> ${stats.highScoreCoins.toLocaleString()} (overall_score > 70)

<b>📅 Latest Activity:</b>
${stats.latestCoinDate ? `🆕 <b>Latest Coin:</b> ${new Date(stats.latestCoinDate).toLocaleString()}` : '🆕 <b>Latest Coin:</b> No coins yet'}
${stats.latestAnalysisDate ? `📊 <b>Latest Analysis:</b> ${new Date(stats.latestAnalysisDate).toLocaleString()}` : '📊 <b>Latest Analysis:</b> No analyses yet'}

<b>💡 Tips:</b>
• Use /dblist to see recent coins
• Use /dbnew to see newly discovered coins
• Use /dbhighscore to see top performers
        `.trim();

        this.bot!.sendMessage(chatId, statsMessage, {
          parse_mode: 'HTML',
        }).catch((error) => {
          logger.error('Error sending dbstats message:', error);
        });
      } catch (error) {
        logger.error('Error getting dbstats:', error);
        this.bot!.sendMessage(chatId, '❌ Error getting database statistics. Please try again later.').catch(() => {});
      }
    });

    // /dblist command
    this.bot.onText(/\/dblist(?:\s+(\d+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const limit = match && match[1] ? parseInt(match[1], 10) : 10;
      const safeLimit = Math.min(Math.max(limit, 1), 20); // Limit between 1-20

      try {
        const coins = await this.dataService.getRecentCoins(safeLimit);
        
        if (coins.length === 0) {
          this.bot!.sendMessage(chatId, '📭 No coins found in database.').catch(() => {});
          return;
        }

        let message = `📋 <b>Recent Coins (${coins.length}/${safeLimit})</b>\n`;
        message += `<i>Ordered by created_at (newest first)</i>\n\n`;
        
        coins.forEach((coin, index) => {
          const chainName = this.dataService.getChainName(coin.chainId);
          const symbol = coin.symbol || 'N/A';
          const name = coin.name || 'Unknown';
          const score = coin.overallScore !== null ? `${coin.overallScore}/100` : 'N/A';
          
          message += `<b>${index + 1}. ${symbol}</b> (${name})\n`;
          message += `📍 <code>${coin.address}</code>\n`;
          message += `⛓️ ${chainName} (${coin.chainId})\n`;
          message += `⭐ Score: ${score}\n`;
          if (coin.priceScore !== null || coin.volumeScore !== null) {
            message += `💰 Price: ${coin.priceScore !== null ? coin.priceScore : 'N/A'}/100 | `;
            message += `📊 Volume: ${coin.volumeScore !== null ? coin.volumeScore : 'N/A'}/100\n`;
          }
          if (coin.socialScore !== null || coin.riskScore !== null) {
            message += `👥 Social: ${coin.socialScore !== null ? coin.socialScore : 'N/A'}/100 | `;
            message += `⚠️ Risk: ${coin.riskScore !== null ? coin.riskScore : 'N/A'}/100\n`;
          }
          if (coin.liquidity) {
            message += `💵 Liquidity: $${coin.liquidity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
          }
          message += `📅 Created: ${new Date(coin.createdAt).toLocaleString()}\n\n`;
        });

        // Split message if too long (Telegram limit is 4096 characters)
        if (message.length > 4000) {
          const chunks = message.match(/[\s\S]{1,4000}/g) || [];
          for (const chunk of chunks) {
            await this.bot!.sendMessage(chatId, chunk, {
              parse_mode: 'HTML',
            }).catch((error) => {
              logger.error('Error sending dblist message chunk:', error);
            });
          }
        } else {
          this.bot!.sendMessage(chatId, message, {
            parse_mode: 'HTML',
          }).catch((error) => {
            logger.error('Error sending dblist message:', error);
          });
        }
      } catch (error) {
        logger.error('Error getting dblist:', error);
        this.bot!.sendMessage(chatId, '❌ Error getting coins list. Please try again later.').catch(() => {});
      }
    });

    // /dbnew command
    this.bot.onText(/\/dbnew(?:\s+(\d+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const limit = match && match[1] ? parseInt(match[1], 10) : 10;
      const safeLimit = Math.min(Math.max(limit, 1), 20); // Limit between 1-20

      try {
        const coins = await this.dataService.getNewCoins(safeLimit);
        
        if (coins.length === 0) {
          this.bot!.sendMessage(chatId, '🆕 No new coins found in database.').catch(() => {});
          return;
        }

        let message = `🆕 <b>New Coins (${coins.length}/${safeLimit})</b>\n`;
        message += `<i>Ordered by discovered_at (newest first)</i>\n\n`;
        
        coins.forEach((coin, index) => {
          const chainName = this.dataService.getChainName(coin.chainId);
          const symbol = coin.symbol || 'N/A';
          const name = coin.name || 'Unknown';
          const score = coin.overallScore !== null ? `${coin.overallScore}/100` : 'N/A';
          
          message += `<b>${index + 1}. ${symbol}</b> (${name})\n`;
          message += `📍 <code>${coin.address}</code>\n`;
          message += `⛓️ ${chainName} (${coin.chainId})\n`;
          message += `⭐ Score: ${score}\n`;
          if (coin.priceScore !== null || coin.volumeScore !== null) {
            message += `💰 Price: ${coin.priceScore !== null ? coin.priceScore : 'N/A'}/100 | `;
            message += `📊 Volume: ${coin.volumeScore !== null ? coin.volumeScore : 'N/A'}/100\n`;
          }
          if (coin.socialScore !== null || coin.riskScore !== null) {
            message += `👥 Social: ${coin.socialScore !== null ? coin.socialScore : 'N/A'}/100 | `;
            message += `⚠️ Risk: ${coin.riskScore !== null ? coin.riskScore : 'N/A'}/100\n`;
          }
          if (coin.liquidity) {
            message += `💵 Liquidity: $${coin.liquidity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
          }
          message += `📅 Discovered: ${new Date(coin.createdAt).toLocaleString()}\n\n`;
        });

        // Split message if too long (Telegram limit is 4096 characters)
        if (message.length > 4000) {
          const chunks = message.match(/[\s\S]{1,4000}/g) || [];
          for (const chunk of chunks) {
            await this.bot!.sendMessage(chatId, chunk, {
              parse_mode: 'HTML',
            }).catch((error) => {
              logger.error('Error sending dbnew message chunk:', error);
            });
          }
        } else {
          this.bot!.sendMessage(chatId, message, {
            parse_mode: 'HTML',
          }).catch((error) => {
            logger.error('Error sending dbnew message:', error);
          });
        }
      } catch (error) {
        logger.error('Error getting dbnew:', error);
        this.bot!.sendMessage(chatId, '❌ Error getting new coins. Please try again later.').catch(() => {});
      }
    });

    // /dbcoin command
    this.bot.onText(/\/dbcoin\s+([a-zA-Z0-9]{32,44})/, async (msg, match) => {
      const chatId = msg.chat.id;
      const address = match && match[1] ? match[1] : '';

      if (!address) {
        this.bot!.sendMessage(chatId, '❌ Please provide a valid address.\nUsage: /dbcoin <address>').catch(() => {});
        return;
      }

      try {
        const coin = await this.dataService.getCoinByAddress(address);
        
        if (!coin) {
          this.bot!.sendMessage(chatId, `❌ Coin not found with address: <code>${address}</code>`, {
            parse_mode: 'HTML',
          }).catch(() => {});
          return;
        }

        const chainName = this.dataService.getChainName(coin.chainId);
        const symbol = coin.symbol || 'N/A';
        const name = coin.name || 'Unknown';

        let message = `🪙 <b>Coin Details</b>\n\n`;
        message += `<b>${symbol}</b> (${name})\n`;
        message += `📍 <b>Address:</b> <code>${coin.address}</code>\n`;
        message += `⛓️ <b>Chain:</b> ${chainName} (${coin.chainId})\n`;
        message += `🆔 <b>Database ID:</b> ${coin.id}\n`;
        
        if (coin.liquidity !== null) {
          message += `💵 <b>Liquidity:</b> $${coin.liquidity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        }
        
        message += `📅 <b>Created:</b> ${new Date(coin.createdAt).toLocaleString()}\n\n`;

        if (coin.overallScore !== null) {
          message += `<b>📊 Analysis Scores:</b>\n`;
          message += `⭐ <b>Overall Score:</b> ${coin.overallScore}/100\n`;
          message += `💰 <b>Price Score:</b> ${coin.priceScore !== null ? coin.priceScore : 'N/A'}/100\n`;
          message += `📊 <b>Volume Score:</b> ${coin.volumeScore !== null ? coin.volumeScore : 'N/A'}/100\n`;
          message += `👥 <b>Social Score:</b> ${coin.socialScore !== null ? coin.socialScore : 'N/A'}/100\n`;
          message += `⚠️ <b>Risk Score:</b> ${coin.riskScore !== null ? coin.riskScore : 'N/A'}/100\n`;
        } else {
          message += `<i>⚠️ No analysis available for this coin yet.</i>\n`;
          message += `<i>The coin has been discovered but not yet analyzed.</i>\n`;
        }

        this.bot!.sendMessage(chatId, message, {
          parse_mode: 'HTML',
        }).catch((error) => {
          logger.error('Error sending dbcoin message:', error);
        });
      } catch (error) {
        logger.error('Error getting dbcoin:', error);
        this.bot!.sendMessage(chatId, '❌ Error getting coin details. Please try again later.').catch(() => {});
      }
    });

    // /dbhighscore command
    this.bot.onText(/\/dbhighscore(?:\s+(\d+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const limit = match && match[1] ? parseInt(match[1], 10) : 10;
      const safeLimit = Math.min(Math.max(limit, 1), 20); // Limit between 1-20

      try {
        const coins = await this.dataService.getHighScoreCoins(safeLimit);
        
        if (coins.length === 0) {
          this.bot!.sendMessage(chatId, '⭐ No high score coins found (score > 70).').catch(() => {});
          return;
        }

        let message = `⭐ <b>High Score Coins (${coins.length}/${safeLimit})</b>\n`;
        message += `<i>Overall Score > 70, ordered by score DESC</i>\n\n`;
        
        coins.forEach((coin, index) => {
          const chainName = this.dataService.getChainName(coin.chainId);
          const symbol = coin.symbol || 'N/A';
          const name = coin.name || 'Unknown';
          
          message += `<b>${index + 1}. ${symbol}</b> (${name})\n`;
          message += `⭐ Overall Score: <b>${coin.overallScore}/100</b>\n`;
          message += `📍 <code>${coin.address}</code>\n`;
          message += `⛓️ ${chainName} (${coin.chainId})\n`;
          message += `💰 Price: ${coin.priceScore !== null ? coin.priceScore : 'N/A'}/100 | `;
          message += `📊 Volume: ${coin.volumeScore !== null ? coin.volumeScore : 'N/A'}/100\n`;
          message += `👥 Social: ${coin.socialScore !== null ? coin.socialScore : 'N/A'}/100 | `;
          message += `⚠️ Risk: ${coin.riskScore !== null ? coin.riskScore : 'N/A'}/100\n`;
          if (coin.liquidity) {
            message += `💵 Liquidity: $${coin.liquidity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
          }
          message += `\n`;
        });

        // Split message if too long
        if (message.length > 4000) {
          const chunks = message.match(/[\s\S]{1,4000}/g) || [];
          for (const chunk of chunks) {
            await this.bot!.sendMessage(chatId, chunk, {
              parse_mode: 'HTML',
            }).catch((error) => {
              logger.error('Error sending dbhighscore message chunk:', error);
            });
          }
        } else {
          this.bot!.sendMessage(chatId, message, {
            parse_mode: 'HTML',
          }).catch((error) => {
            logger.error('Error sending dbhighscore message:', error);
          });
        }
      } catch (error) {
        logger.error('Error getting dbhighscore:', error);
        this.bot!.sendMessage(chatId, '❌ Error getting high score coins. Please try again later.').catch(() => {});
      }
    });

    // Handle errors
    this.bot.on('polling_error', (error) => {
      logger.error('Telegram polling error:', error);
    });
  }

  /**
   * Process high-score coin event from queue
   */
  async processHighScoreCoin(message: string): Promise<void> {
    try {
      const event = JSON.parse(message);
      if (event.event !== 'analyzer:high-score-coin') {
        logger.warn(`Unknown event type: ${event.event}`);
        return;
      }

      const alertData = event.data;

      if (!this.notificationService) {
        logger.error('Notification service not initialized');
        return;
      }

      logger.info(`Processing high-score coin alert: ${alertData.coinAddress}`);

      // Send to configured chat ID or broadcast to all users
      if (process.env.TELEGRAM_CHAT_ID) {
        await this.notificationService.sendToConfiguredChat(alertData);
      } else {
        await this.notificationService.broadcastAlert(alertData);
      }
    } catch (error) {
      logger.error('Error processing high-score coin:', error);
    }
  }

  /**
   * Start bot service
   */
  async start(): Promise<void> {
    await this.initialize();

    logger.info('Telegram bot service started');

    // Subscribe to analyzer queue
    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }

    const subscriber = client.duplicate();
    await subscriber.connect();

    await subscriber.subscribe(REDIS_QUEUES.ANALYZER_HIGH_SCORE, (message) => {
      logger.info('Received high-score coin event from queue');
      this.processHighScoreCoin(message).catch((error) => {
        logger.error('Error processing high-score coin:', error);
      });
    });

    logger.info(`Subscribed to queue: ${REDIS_QUEUES.ANALYZER_HIGH_SCORE}`);

    // Keep process alive
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down...');
      if (this.bot) {
        this.bot.stopPolling();
      }
      subscriber.quit();
      client.quit();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down...');
      if (this.bot) {
        this.bot.stopPolling();
      }
      subscriber.quit();
      client.quit();
      process.exit(0);
    });
  }
}

// Start service
const service = new TelegramBotService();
service.start().catch((error) => {
  logger.error('Failed to start Telegram bot service:', error);
  process.exit(1);
});


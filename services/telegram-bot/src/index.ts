import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import { initRedis, getRedisClient } from './config/redis';
import { testConnection } from './config/database';
import { logger } from './config/logger';
import { NotificationService } from './services/notification.service';
import { DataService } from './services/data.service';
import { TradingService } from './services/trading.service';
import { REDIS_QUEUES } from './utils/constants';
import { PositionStatus } from './services/position.service';

dotenv.config();

/**
 * Telegram Bot Service
 * Handles alerts and user commands
 */
class TelegramBotService {
  private bot: TelegramBot | null = null;
  private notificationService: NotificationService | null = null;
  private dataService: DataService = new DataService();
  private tradingService: TradingService = new TradingService();

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

    // Initialize trading service
    try {
      await this.tradingService.initialize();
      logger.info('Trading service initialized');
    } catch (error) {
      logger.warn('Trading service initialization failed (will retry on command):', error);
    }

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
/newbsc [limit] - 🆕 List new BSC coins (default: 10, max: 20)
/newsolana [limit] - 🆕 List new Solana coins (default: 10, max: 20)
/dbcoin &lt;address&gt; - 🪙 Get detailed coin information by address
/dbhighscore [limit] - ⭐ List high score coins (score > 70, default: 10, max: 20)

<b>Trading Commands:</b>
/positions - 📊 List all open positions
/buy &lt;token&gt; [amount] - 💰 Buy token (default $10, or specify amount)
/status &lt;token&gt; - 📈 Get position status
/sell &lt;token&gt; - 💸 Force sell position
/balance [address] - 💵 Check wallet balance (BUSD & BNB), or check specific address (read-only)
/swapbusdtobnb &lt;amount&gt; - 💱 Swap BUSD to BNB (useful when BNB balance is low)
/transfer &lt;address&gt; &lt;amount&gt; - 💸 Transfer BNB from bot wallet to address
/pnl - 📊 Total profit & loss
/walletinfo [index] - 🔑 Show wallet address and test account indices
/checkwallet &lt;address&gt; - 🔍 Search wallet address in indices 0-20
/checkcoin &lt;address&gt; - 🔍 Check if coin exists on DEX (BSC/Solana)
/24h &lt;address&gt; - 📊 Get 24h timeframe analysis
/infocoin &lt;address&gt; - ℹ️ Get coin information (website, social media, etc.)

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

<b>Trading Commands:</b>
/positions - 📊 List all open positions
/buy &lt;token_address&gt; [amount] - 💰 Buy token (default $10, or specify amount, BSC only)
/status &lt;token_address&gt; - 📈 Get position status by token address
/sell &lt;token_address&gt; - 💸 Force sell position
/balance [address] - 💵 Check wallet balance (BUSD & BNB), or check specific address (read-only)
/swapbusdtobnb &lt;amount&gt; - 💱 Swap BUSD to BNB (useful when BNB balance is low)
/transfer &lt;address&gt; &lt;amount&gt; - 💸 Transfer BNB from bot wallet to address
/pnl - 📊 Total profit & loss across all positions
/walletinfo [index] - 🔑 Show wallet address and test account indices
/checkwallet &lt;address&gt; - 🔍 Search wallet address in indices 0-20
/checkcoin &lt;address&gt; - 🔍 Check if coin exists on DEX (BSC/Solana)
/24h &lt;address&gt; - 📊 Get detailed 24h timeframe analysis
/infocoin &lt;address&gt; - ℹ️ Get coin information from internet (website, X/Twitter, Telegram, etc.)

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

    // /newbsc command - Get new BSC coins
    this.bot.onText(/\/newbsc(?:\s+(\d+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const limit = match && match[1] ? parseInt(match[1], 10) : 10;
      const safeLimit = Math.min(Math.max(limit, 1), 20); // Limit between 1-20

      try {
        const coins = await this.dataService.getNewCoinsByChain(56, safeLimit); // BSC chain_id = 56
        
        if (coins.length === 0) {
          this.bot!.sendMessage(chatId, '🆕 No new BSC coins found in database.').catch(() => {});
          return;
        }

        let message = `🆕 <b>New BSC Coins (${coins.length}/${safeLimit})</b>\n`;
        message += `<i>Ordered by discovered_at (newest first)</i>\n\n`;
        
        coins.forEach((coin, index) => {
          const symbol = coin.symbol || 'N/A';
          const name = coin.name || 'Unknown';
          const score = coin.overallScore !== null ? `${coin.overallScore}/100` : 'N/A';
          
          message += `<b>${index + 1}. ${symbol}</b> (${name})\n`;
          message += `📍 <code>${coin.address}</code>\n`;
          message += `⛓️ BSC\n`;
          message += `⭐ Score: ${score}\n`;
          if (coin.priceScore !== null || coin.volumeScore !== null) {
            message += `💰 Price: ${coin.priceScore !== null ? coin.priceScore : 'N/A'}/100 | `;
            message += `📊 Volume: ${coin.volumeScore !== null ? coin.volumeScore : 'N/A'}/100\n`;
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
              logger.error('Error sending newbsc message chunk:', error);
            });
          }
        } else {
          this.bot!.sendMessage(chatId, message, {
            parse_mode: 'HTML',
          }).catch((error) => {
            logger.error('Error sending newbsc message:', error);
          });
        }
      } catch (error) {
        logger.error('Error getting newbsc:', error);
        this.bot!.sendMessage(chatId, '❌ Error getting new BSC coins. Please try again later.').catch(() => {});
      }
    });

    // /newsolana command - Get new Solana coins
    this.bot.onText(/\/newsolana(?:\s+(\d+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const limit = match && match[1] ? parseInt(match[1], 10) : 10;
      const safeLimit = Math.min(Math.max(limit, 1), 20); // Limit between 1-20

      try {
        const coins = await this.dataService.getNewCoinsByChain(999, safeLimit); // Solana chain_id = 999
        
        if (coins.length === 0) {
          this.bot!.sendMessage(chatId, '🆕 No new Solana coins found in database.').catch(() => {});
          return;
        }

        let message = `🆕 <b>New Solana Coins (${coins.length}/${safeLimit})</b>\n`;
        message += `<i>Ordered by discovered_at (newest first)</i>\n\n`;
        
        coins.forEach((coin, index) => {
          const symbol = coin.symbol || 'N/A';
          const name = coin.name || 'Unknown';
          const score = coin.overallScore !== null ? `${coin.overallScore}/100` : 'N/A';
          
          message += `<b>${index + 1}. ${symbol}</b> (${name})\n`;
          message += `📍 <code>${coin.address}</code>\n`;
          message += `⛓️ Solana\n`;
          message += `⭐ Score: ${score}\n`;
          if (coin.priceScore !== null || coin.volumeScore !== null) {
            message += `💰 Price: ${coin.priceScore !== null ? coin.priceScore : 'N/A'}/100 | `;
            message += `📊 Volume: ${coin.volumeScore !== null ? coin.volumeScore : 'N/A'}/100\n`;
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
              logger.error('Error sending newsolana message chunk:', error);
            });
          }
        } else {
          this.bot!.sendMessage(chatId, message, {
            parse_mode: 'HTML',
          }).catch((error) => {
            logger.error('Error sending newsolana message:', error);
          });
        }
      } catch (error) {
        logger.error('Error getting newsolana:', error);
        this.bot!.sendMessage(chatId, '❌ Error getting new Solana coins. Please try again later.').catch(() => {});
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

    // ============================================================================
    // TRADING COMMANDS
    // ============================================================================

    // /positions command - List all positions
    this.bot.onText(/\/positions/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        // Send "refreshing" message
        const refreshingMsg = await this.bot!.sendMessage(chatId, '🔄 Memperbarui harga...').catch(() => null);
        
        // Refresh prices before displaying
        try {
          await this.tradingService.refreshPositionsPrices();
          // Small delay to ensure database is updated
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error: any) {
          logger.warn(`Error refreshing prices: ${error.message}`);
          // Continue anyway - will show cached data
        }
        
        // Delete refreshing message
        if (refreshingMsg) {
          this.bot!.deleteMessage(chatId, refreshingMsg.message_id).catch(() => {});
        }
        
        // Get fresh positions from database after refresh
        const positions = await this.tradingService.getPositions(PositionStatus.OPEN);
        
        if (positions.length === 0) {
          this.bot!.sendMessage(chatId, '📭 No open positions found.').catch(() => {});
          return;
        }

        let message = `📊 <b>Open Positions (${positions.length})</b>\n\n`;
        
        for (const pos of positions) {
          // Get symbol from multiple sources if not available
          let symbol = pos.symbol;
          if (!symbol) {
            try {
              symbol = await this.tradingService.getTokenSymbol(
                pos.tokenAddress,
                pos.chainId,
                pos.symbol,
                pos.coinId
              ) || 'N/A';
            } catch (error: any) {
              logger.warn(`Error getting symbol for ${pos.tokenAddress}:`, error);
              symbol = 'N/A';
            }
          }

          const pnl = pos.currentPriceUsd && pos.buyPriceUsd 
            ? ((pos.currentPriceUsd - pos.buyPriceUsd) / pos.buyPriceUsd) * 100
            : 0;
          const pnlSign = pnl >= 0 ? '📈' : '📉';
          
          message += `<b>${symbol}</b>\n`;
          message += `📍 <code>${pos.tokenAddress}</code>\n`;
          message += `💰 Buy: $${pos.buyPriceUsd.toFixed(8)}\n`;
          message += `💵 Current: $${pos.currentPriceUsd?.toFixed(8) || 'N/A'}\n`;
          message += `🔺 Highest: $${pos.highestPriceEver.toFixed(8)}\n`;
          if (pos.profitFloor) {
            message += `🛡️ Floor: $${pos.profitFloor.toFixed(8)}\n`;
          }
          message += `💎 Amount: ${parseFloat(pos.amountToken).toFixed(4)}\n`;
          message += `${pnlSign} PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%\n`;
          message += `\n`;
        }

        // Split if too long
        if (message.length > 4000) {
          const chunks = message.match(/[\s\S]{1,4000}/g) || [];
          for (const chunk of chunks) {
            await this.bot!.sendMessage(chatId, chunk, { parse_mode: 'HTML' }).catch(() => {});
          }
        } else {
          this.bot!.sendMessage(chatId, message, { parse_mode: 'HTML' }).catch(() => {});
        }
      } catch (error: any) {
        logger.error('Error getting positions:', error);
        this.bot!.sendMessage(chatId, `❌ Error: ${error.message || 'Failed to get positions'}`).catch(() => {});
      }
    });

    // /buy command - Buy token (supports address or symbol, with optional amount)
    // Format: /buy <token_address_or_symbol> [amount]
    // Example: /buy 0x123... 30 (buy $30 worth)
    // Example: /buy 0x123... (buy $10 default)
    this.bot.onText(/\/buy\s+(.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const input = match && match[1] ? match[1].trim() : '';
      
      if (!input) {
        this.bot!.sendMessage(chatId, '❌ Please provide token address or symbol.\nUsage: /buy <token_address_or_symbol> [amount]\n\nExample:\n/buy 0x123...5678 30\n/buy TOKEN 50').catch(() => {});
        return;
      }

      try {
        // Parse input: split by space to get token and amount
        const parts = input.split(/\s+/);
        let tokenInput = parts[0];
        let amountUsd = 10; // Default amount

        // Check if second part is a number (amount)
        if (parts.length > 1) {
          const amountStr = parts[1];
          const parsedAmount = parseFloat(amountStr);
          
          if (!isNaN(parsedAmount) && parsedAmount > 0) {
            amountUsd = parsedAmount;
          } else {
            // If second part is not a number, treat it as part of token (for symbols with spaces)
            tokenInput = input; // Use full input as token
          }
        }

        // Validate amount
        if (amountUsd <= 0) {
          this.bot!.sendMessage(chatId, '❌ Amount must be greater than 0.\nUsage: /buy <token_address_or_symbol> [amount]').catch(() => {});
          return;
        }

        if (amountUsd > 10000) {
          this.bot!.sendMessage(chatId, '❌ Maximum buy amount is $10,000 for safety.\nPlease use a smaller amount.').catch(() => {});
          return;
        }

        // Detect chain and validate address format
        const isBSC = tokenInput.match(/^0x[a-fA-F0-9]{40}$/);
        const isSolana = tokenInput.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
        
        let tokenAddress = tokenInput;
        let chainName = '';
        let chainId = 56; // Default to BSC
        
        if (!isBSC && !isSolana) {
          // Try to find by symbol (only for BSC for now)
          this.bot!.sendMessage(chatId, `🔍 Looking up token address for symbol: ${tokenInput}...`).catch(() => {});
          const foundAddress = await this.tradingService.findTokenAddressBySymbol(tokenInput, 56);
          if (!foundAddress) {
            this.bot!.sendMessage(chatId, `❌ Token "${tokenInput}" not found in database. Please use token address instead.\n\nUsage:\n• BSC: /buy 0x1234...5678 [amount]\n• Solana: /buy ABC...XYZ [amount]`).catch(() => {});
            return;
          }
          tokenAddress = foundAddress;
          chainName = 'BSC';
          chainId = 56;
        } else if (isBSC) {
          chainName = 'BSC';
          chainId = 56;
        } else if (isSolana) {
          chainName = 'Solana';
          chainId = 999;
        }

        const walletAddress = this.tradingService.getWalletAddress(chainId);
        const walletInfo = walletAddress ? `\n📍 Wallet: <code>${walletAddress}</code>` : '';
        
        this.bot!.sendMessage(chatId, `💰 Buying $${amountUsd} of token on ${chainName}...\n📍 Token: <code>${tokenAddress}</code>${walletInfo}`, { parse_mode: 'HTML' }).catch(() => {});

        const result = await this.tradingService.buy(tokenAddress, amountUsd, 5);
        
        const successMessage = `✅ <b>Buy Successful!</b>\n\n` +
          `📍 Token: <code>${tokenAddress}</code>\n` +
          `💰 Amount: $${amountUsd}\n` +
          `📊 Position ID: ${result.positionId}\n` +
          `🔗 TX Hash: <code>${result.txHash}</code>\n\n` +
          `Use /status ${tokenAddress} to check position status.`;
        
        this.bot!.sendMessage(chatId, successMessage, { parse_mode: 'HTML' }).catch(() => {});
      } catch (error: any) {
        logger.error('Error in buy command:', error);
        // Determine chain for better error message (detect from input)
        const isSolanaChain = input && input.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
        const chainSpecificTips = isSolanaChain
          ? `• Pastikan wallet memiliki cukup SOL untuk buy\n` +
            `• Pastikan wallet memiliki cukup SOL untuk gas fee\n`
          : `• Pastikan wallet memiliki cukup BUSD untuk buy\n` +
            `• Pastikan wallet memiliki cukup BNB untuk gas fee\n`;

        let errorMessage = `❌ Buy failed: ${error.message || 'Unknown error'}\n\n`;
        
        // Add specific error message for DNS/network issues
        if (error.message && (error.message.includes('ENOTFOUND') || error.message.includes('DNS') || error.message.includes('fetch failed'))) {
          errorMessage += `⚠️ <b>Network/DNS Issue Detected</b>\n\n`;
          errorMessage += `Masalah: Tidak bisa terhubung ke Jupiter API (Solana DEX).\n\n`;
          errorMessage += `💡 <b>Solusi:</b>\n`;
          errorMessage += `• Cek koneksi internet server\n`;
          errorMessage += `• Cek DNS settings di docker-compose.yml\n`;
          errorMessage += `• Coba restart services: docker-compose restart telegram-bot trade-engine\n`;
          errorMessage += `• Jika masalah berlanjut, cek firewall atau network restrictions\n\n`;
        }
        
        errorMessage += `💡 <b>Tips:</b>\n` +
          `• Pastikan WALLET_MNEMONIC atau WALLET_PRIVATE_KEY sudah di-set di .env\n` +
          chainSpecificTips +
          `• Cek log untuk detail error lebih lanjut`;
        
        this.bot!.sendMessage(
          chatId,
          errorMessage,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    });

    // /status command (enhanced) - Get position status by token
    this.bot.onText(/\/status\s+([a-zA-Z0-9]{40,42})/, async (msg, match) => {
      const chatId = msg.chat.id;
      const tokenAddress = match && match[1] ? match[1] : '';
      
      if (!tokenAddress) {
        this.bot!.sendMessage(chatId, '❌ Please provide token address.\nUsage: /status <token_address>').catch(() => {});
        return;
      }

      try {
        const position = await this.tradingService.getPositionByToken(tokenAddress);
        
        if (!position) {
          this.bot!.sendMessage(chatId, `❌ No position found for token <code>${tokenAddress}</code>`, { parse_mode: 'HTML' }).catch(() => {});
          return;
        }

        const pnl = position.currentPriceUsd && position.buyPriceUsd
          ? ((position.currentPriceUsd - position.buyPriceUsd) / position.buyPriceUsd) * 100
          : 0;
        const pnlSign = pnl >= 0 ? '📈' : '📉';

        const message = `📊 <b>Position Status</b>\n\n` +
          `<b>${position.symbol || 'N/A'}</b>\n` +
          `📍 Address: <code>${position.tokenAddress}</code>\n` +
          `📊 Status: ${position.status}\n` +
          `💰 Buy Price: $${position.buyPriceUsd.toFixed(8)}\n` +
          `💵 Current: $${position.currentPriceUsd?.toFixed(8) || 'N/A'}\n` +
          `🔺 Highest: $${position.highestPriceEver.toFixed(8)}\n` +
          (position.profitFloor ? `🛡️ Floor: $${position.profitFloor.toFixed(8)}\n` : '') +
          `💎 Amount: ${parseFloat(position.amountToken).toFixed(4)}\n` +
          `${pnlSign} PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%\n` +
          `📅 Created: ${position.createdAt ? new Date(position.createdAt).toLocaleString() : 'N/A'}`;

        this.bot!.sendMessage(chatId, message, { parse_mode: 'HTML' }).catch(() => {});
      } catch (error: any) {
        logger.error('Error getting position status:', error);
        this.bot!.sendMessage(chatId, `❌ Error: ${error.message || 'Failed to get status'}`).catch(() => {});
      }
    });

    // /sell command - Sell position (supports address or symbol)
    this.bot.onText(/\/sell\s+(.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const input = match && match[1] ? match[1].trim() : '';
      
      if (!input) {
        this.bot!.sendMessage(chatId, '❌ Please provide token address or symbol.\nUsage: /sell <token_address_or_symbol>').catch(() => {});
        return;
      }

      try {
        // Check if input is address (0x... with 40-42 hex chars) or symbol
        let tokenAddress = input;
        if (!input.startsWith('0x') || input.length < 40) {
          // Try to find by symbol
          this.bot!.sendMessage(chatId, `🔍 Looking up token address for symbol: ${input}...`).catch(() => {});
          const foundAddress = await this.tradingService.findTokenAddressBySymbol(input, 56);
          if (!foundAddress) {
            this.bot!.sendMessage(chatId, `❌ Token "${input}" not found. Please use token address instead.\n\nUsage: /sell 0x1234...5678`).catch(() => {});
            return;
          }
          tokenAddress = foundAddress;
        }

        // Validate address format
        if (!tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
          this.bot!.sendMessage(chatId, '❌ Invalid token address format. Must be 0x followed by 40 hex characters.').catch(() => {});
          return;
        }

        this.bot!.sendMessage(chatId, `💸 Selling position for token...\n📍 Address: <code>${tokenAddress}</code>`, { parse_mode: 'HTML' }).catch(() => {});

        const result = await this.tradingService.sellByToken(tokenAddress, 5);
        
        const successMessage = `✅ <b>Sell Successful!</b>\n\n` +
          `📍 Token: <code>${tokenAddress}</code>\n` +
          `💰 PnL: $${result.pnl >= 0 ? '+' : ''}${result.pnl.toFixed(2)}\n` +
          `🔗 TX Hash: <code>${result.txHash}</code>\n\n` +
          `Position has been closed.`;
        
        this.bot!.sendMessage(chatId, successMessage, { parse_mode: 'HTML' }).catch(() => {});
      } catch (error: any) {
        logger.error('Error in sell command:', error);
        this.bot!.sendMessage(
          chatId,
          `❌ Sell failed: ${error.message || 'Unknown error'}`
        ).catch(() => {});
      }
    });

    // /swapbusdtobnb command - Swap BUSD to BNB
    // Format: /swapbusdtobnb <amount>
    // Example: /swapbusdtobnb 10 (swap 10 BUSD to BNB)
    this.bot.onText(/\/swapbusdtobnb\s+(\d+(?:\.\d+)?)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const amountStr = match && match[1] ? match[1].trim() : '';
      
      if (!amountStr) {
        this.bot!.sendMessage(chatId, '❌ Please provide BUSD amount.\nUsage: /swapbusdtobnb <amount>\n\nExample:\n/swapbusdtobnb 10\n/swapbusdtobnb 50.5').catch(() => {});
        return;
      }

      const amountBUSD = parseFloat(amountStr);
      
      if (isNaN(amountBUSD) || amountBUSD <= 0) {
        this.bot!.sendMessage(chatId, '❌ Invalid amount. Amount must be greater than 0.').catch(() => {});
        return;
      }

      try {
        this.bot!.sendMessage(chatId, `💱 Swapping ${amountBUSD.toFixed(2)} BUSD to BNB...`).catch(() => {});
        
        const result = await this.tradingService.swapBUSDToBNB(amountBUSD, 5);
        
        const successMessage = `✅ <b>Swap Successful!</b>\n\n` +
          `💵 BUSD Swapped: ${amountBUSD.toFixed(2)}\n` +
          `⚡ BNB Received: ${parseFloat(result.bnbReceived).toFixed(8)}\n` +
          `🔗 TX Hash: <code>${result.txHash}</code>\n\n` +
          `Use /balance to check your updated balance.`;
        
        this.bot!.sendMessage(chatId, successMessage, { parse_mode: 'HTML' }).catch(() => {});
      } catch (error: any) {
        logger.error('Error in swapbusdtobnb command:', error);
        const errorMessage = `❌ Swap failed: ${error.message || 'Unknown error'}\n\n` +
          `💡 <b>Tips:</b>\n` +
          `• Pastikan wallet memiliki cukup BUSD\n` +
          `• Pastikan wallet memiliki cukup BNB untuk gas fee\n` +
          `• Cek log untuk detail error lebih lanjut`;
        
        this.bot!.sendMessage(
          chatId,
          errorMessage,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    });

    // /balance command - Get wallet balance (with optional address parameter)
    this.bot.onText(/\/balance(?:\s+(0x[a-fA-F0-9]{40}))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const addressArg = match && match[1] ? match[1] : null;
      
      try {
        let balance;
        let isCustomAddress = false;
        
        if (addressArg) {
          // Check balance by address (read-only)
          balance = await this.tradingService.getBalanceByAddress(addressArg);
          isCustomAddress = true;
        } else {
          // Get balance from configured wallet
          balance = await this.tradingService.getBalance();
        }
        
        const addressLabel = isCustomAddress ? 'Address' : 'Wallet';
        const totalValueUSD = 'totalValueUSD' in balance ? balance.totalValueUSD : 0;
        const message = `💵 <b>Wallet Balance</b>\n\n` +
          `📍 ${addressLabel}: <code>${balance.walletAddress}</code>\n` +
          (totalValueUSD > 0 ? `💰 Total Value: $${totalValueUSD.toFixed(2)}\n` : '') +
          `⚡ BNB: ${parseFloat(balance.bnb).toFixed(8)}\n` +
          `💵 BUSD: ${parseFloat(balance.busd).toFixed(2)}` +
          (isCustomAddress ? `\n\nℹ️ <i>Read-only balance check (no private key needed)</i>` : '');
        
        this.bot!.sendMessage(chatId, message, { parse_mode: 'HTML' }).catch(() => {});
      } catch (error: any) {
        logger.error('Error getting balance:', error);
        const errorMessage = addressArg 
          ? `❌ Error getting balance for address: ${error.message}\n\n` +
            `💡 Pastikan address format benar (0x... dengan 42 karakter)`
          : `❌ Error getting balance: ${error.message}\n\n` +
            `💡 <b>Tips:</b>\n` +
            `• Pastikan WALLET_MNEMONIC sudah di-set di .env (secret phrase dari Trust Wallet)\n` +
            `• Format: WALLET_MNEMONIC="word1 word2 word3 ... word12"\n` +
            `• Pastikan wallet address yang digunakan sudah memiliki BNB untuk gas\n` +
            `• Gunakan /walletinfo untuk melihat wallet address dari account index berbeda\n` +
            `• Gunakan /balance <address> untuk cek balance address tertentu (read-only)\n` +
            `• Cek log untuk detail error lebih lanjut`;
        
        this.bot!.sendMessage(
          chatId,
          errorMessage,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    });

    // /walletinfo command - Get wallet info and test different account indices
    this.bot.onText(/\/walletinfo(?:\s+(\d+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const testIndex = match && match[1] ? parseInt(match[1], 10) : null;
      
      try {
        const mnemonic = process.env.WALLET_MNEMONIC;
        if (!mnemonic) {
          this.bot!.sendMessage(
            chatId,
            `❌ WALLET_MNEMONIC tidak ditemukan di environment variables.\n\n` +
            `💡 Pastikan WALLET_MNEMONIC sudah di-set di .env file dengan format:\n` +
            `WALLET_MNEMONIC="word1 word2 word3 ... word12"`,
            { parse_mode: 'HTML' }
          ).catch(() => {});
          return;
        }

        const { getAddressFromMnemonic } = await import('../shared/utils/wallet');
        const currentIndex = parseInt(process.env.WALLET_ACCOUNT_INDEX || '0');
        
        let message = `🔑 <b>Wallet Information</b>\n\n`;
        message += `📝 <b>Current Configuration:</b>\n`;
        message += `Account Index: ${currentIndex}\n`;
        
        // Show current wallet address
        try {
          const currentAddress = getAddressFromMnemonic(mnemonic, currentIndex);
          message += `📍 Current Wallet: <code>${currentAddress}</code>\n\n`;
        } catch (error: any) {
          message += `❌ Error: ${error.message}\n\n`;
        }

        // If test index provided, show that address
        if (testIndex !== null) {
          try {
            const testAddress = getAddressFromMnemonic(mnemonic, testIndex);
            message += `🧪 <b>Test Account Index ${testIndex}:</b>\n`;
            message += `📍 Address: <code>${testAddress}</code>\n\n`;
            message += `💡 Jika ini adalah wallet yang benar, set WALLET_ACCOUNT_INDEX=${testIndex} di .env`;
          } catch (error: any) {
            message += `❌ Error testing index ${testIndex}: ${error.message}\n`;
          }
        } else {
          // Show first 10 account indices
          message += `📋 <b>Account Indices (0-9):</b>\n`;
          for (let i = 0; i <= 9; i++) {
            try {
              const address = getAddressFromMnemonic(mnemonic, i);
              const marker = i === currentIndex ? ' 👈 (current)' : '';
              message += `${i}: <code>${address}</code>${marker}\n`;
            } catch (error: any) {
              message += `${i}: ❌ Error\n`;
            }
          }
          message += `\n💡 Gunakan /walletinfo <index> untuk test account index tertentu (0-20)\n`;
          message += `💡 Gunakan /checkwallet <address> untuk mencari address di index 0-20\n`;
          message += `💡 Pastikan wallet address di atas sama dengan wallet di Trust Wallet`;
        }
        
        this.bot!.sendMessage(chatId, message, { parse_mode: 'HTML' }).catch(() => {});
      } catch (error: any) {
        logger.error('Error getting wallet info:', error);
        this.bot!.sendMessage(
          chatId,
          `❌ Error: ${error.message || 'Failed to get wallet info'}`
        ).catch(() => {});
      }
    });

    // /checkwallet command - Search for a specific wallet address in indices 0-20
    this.bot.onText(/\/checkwallet\s+(0x[a-fA-F0-9]{40})/, async (msg, match) => {
      const chatId = msg.chat.id;
      const targetAddress = match && match[1] ? match[1].toLowerCase() : '';
      
      if (!targetAddress) {
        this.bot!.sendMessage(
          chatId,
          '❌ Format salah. Gunakan: /checkwallet <wallet_address>\n\n' +
          'Contoh: /checkwallet 0x0f77bc83BfBf4Ea09A8fE3c0770Edcc8a4c47CB5'
        ).catch(() => {});
        return;
      }

      try {
        const mnemonic = process.env.WALLET_MNEMONIC;
        if (!mnemonic) {
          this.bot!.sendMessage(
            chatId,
            `❌ WALLET_MNEMONIC tidak ditemukan di environment variables.`
          ).catch(() => {});
          return;
        }

        const { getAddressFromMnemonic } = await import('../shared/utils/wallet');
        
        this.bot!.sendMessage(chatId, `🔍 Mencari address <code>${targetAddress}</code> di index 0-20...`, { parse_mode: 'HTML' }).catch(() => {});
        
        let foundIndex: number | null = null;
        const checkedAddresses: string[] = [];
        
        // Check indices 0-20
        for (let i = 0; i <= 20; i++) {
          try {
            const address = getAddressFromMnemonic(mnemonic, i);
            const normalizedAddress = address.toLowerCase();
            checkedAddresses.push(normalizedAddress);
            
            if (normalizedAddress === targetAddress) {
              foundIndex = i;
              break;
            }
          } catch (error: any) {
            // Skip errors and continue
          }
        }

        let message = `🔍 <b>Hasil Pencarian</b>\n\n`;
        message += `📍 Target Address: <code>${targetAddress}</code>\n\n`;

        if (foundIndex !== null) {
          message += `✅ <b>DITEMUKAN!</b>\n\n`;
          message += `🔢 Account Index: <b>${foundIndex}</b>\n`;
          message += `📍 Address: <code>${targetAddress}</code>\n\n`;
          message += `💡 <b>Langkah selanjutnya:</b>\n`;
          message += `1. Edit file .env\n`;
          message += `2. Set: WALLET_ACCOUNT_INDEX=${foundIndex}\n`;
          message += `3. Restart service: docker-compose restart telegram-bot\n`;
          message += `4. Verifikasi dengan /balance`;
        } else {
          message += `❌ <b>TIDAK DITEMUKAN</b>\n\n`;
          message += `Address tidak ditemukan di index 0-20.\n\n`;
          message += `💡 <b>Kemungkinan masalah:</b>\n`;
          message += `1. ❌ Mnemonic/Secret Phrase di .env berbeda dengan Trust Wallet\n`;
          message += `2. ❌ Wallet address yang diberikan bukan dari wallet ini\n`;
          message += `3. ❌ Address menggunakan derivation path yang berbeda\n\n`;
          message += `🔧 <b>Solusi:</b>\n`;
          message += `• Pastikan WALLET_MNEMONIC di .env adalah secret phrase dari Trust Wallet yang benar\n`;
          message += `• Copy secret phrase langsung dari Trust Wallet: Settings → Security → Show Recovery Phrase\n`;
          message += `• Pastikan format benar (12 atau 24 words, dipisah spasi)\n\n`;
          message += `📋 <b>Address yang sudah dicek (5 pertama):</b>\n`;
          checkedAddresses.slice(0, 5).forEach((addr, idx) => {
            message += `${idx}: <code>${addr}</code>\n`;
          });
          message += `... (total ${checkedAddresses.length} addresses checked)`;
        }
        
        this.bot!.sendMessage(chatId, message, { parse_mode: 'HTML' }).catch(() => {});
      } catch (error: any) {
        logger.error('Error checking wallet:', error);
        this.bot!.sendMessage(chatId, `❌ Error: ${error.message || 'Failed to check wallet'}`).catch(() => {});
      }
    });

    // /transfer command - Transfer BNB from bot wallet to address
    this.bot.onText(/\/transfer\s+(0x[a-fA-F0-9]{40})\s+([\d.]+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const toAddress = match && match[1] ? match[1] : '';
      const amount = match && match[2] ? parseFloat(match[2]) : 0;
      
      if (!toAddress || amount <= 0) {
        this.bot!.sendMessage(
          chatId,
          '❌ Format salah. Gunakan: /transfer <address> <amount>\n\n' +
          'Contoh: /transfer 0xb54eB756c51C40F7EeFE5FB750264bfC14B9e208 0.01\n\n' +
          '💡 <b>Catatan:</b>\n' +
          '• <amount> adalah jumlah BNB (contoh: 0.01 untuk 0.01 BNB)\n' +
          '• Pastikan wallet bot punya BNB cukup (termasuk gas fee)',
          { parse_mode: 'HTML' }
        ).catch(() => {});
        return;
      }

      try {
        this.bot!.sendMessage(
          chatId,
          `💸 Transferring ${amount} BNB to <code>${toAddress}</code>...\n\n` +
          `⏳ Please wait...`,
          { parse_mode: 'HTML' }
        ).catch(() => {});

        const result = await this.tradingService.transferBNB(toAddress, amount);
        
        const successMessage = `✅ <b>Transfer Successful!</b>\n\n` +
          `📍 To: <code>${toAddress}</code>\n` +
          `💰 Amount: ${amount} BNB\n` +
          `🔗 TX Hash: <code>${result.txHash}</code>\n\n` +
          `📊 View on BSCScan:\n` +
          `https://bscscan.com/tx/${result.txHash}`;
        
        this.bot!.sendMessage(chatId, successMessage, { parse_mode: 'HTML' }).catch(() => {});
      } catch (error: any) {
        logger.error('Error in transfer command:', error);
        this.bot!.sendMessage(
          chatId,
          `❌ Transfer failed: ${error.message || 'Unknown error'}\n\n` +
          `💡 <b>Tips:</b>\n` +
          `• Pastikan wallet bot punya BNB cukup (termasuk gas fee)\n` +
          `• Pastikan address tujuan benar (format: 0x...)\n` +
          `• Cek balance dengan /balance`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    });

    // /pnl command - Get total PnL
    this.bot.onText(/\/pnl/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const pnl = await this.tradingService.getTotalPnL();
        const pnlSign = pnl.totalPnL >= 0 ? '📈' : '📉';
        
        const message = `📊 <b>Total Profit & Loss</b>\n\n` +
          `💰 Total Invested: $${pnl.totalInvested.toFixed(2)}\n` +
          `💵 Total Value: $${pnl.totalValue.toFixed(2)}\n` +
          `${pnlSign} Total PnL: $${pnl.totalPnL >= 0 ? '+' : ''}${pnl.totalPnL.toFixed(2)}\n` +
          `${pnlSign} PnL %: ${pnl.totalPnLPercentage >= 0 ? '+' : ''}${pnl.totalPnLPercentage.toFixed(2)}%`;
        
        this.bot!.sendMessage(chatId, message, { parse_mode: 'HTML' }).catch(() => {});
      } catch (error: any) {
        logger.error('Error getting PnL:', error);
        this.bot!.sendMessage(chatId, `❌ Error: ${error.message || 'Failed to get PnL'}`).catch(() => {});
      }
    });

    // /checkcoin command - Check if coin exists on DEX (PancakeSwap for BSC, or Solana DEX)
    this.bot.onText(/\/checkcoin\s+(.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const input = match && match[1] ? match[1].trim() : '';
      
      if (!input) {
        this.bot!.sendMessage(chatId, '❌ Please provide token address.\nUsage: /checkcoin <token_address>\n\nSupported:\n• BSC: 0x... (42 chars)\n• Solana: Base58 (32-44 chars)').catch(() => {});
        return;
      }

      try {
        // Detect chain type
        const isBSC = input.match(/^0x[a-fA-F0-9]{40}$/);
        const isSolana = input.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
        
        if (!isBSC && !isSolana) {
          this.bot!.sendMessage(
            chatId, 
            '❌ Invalid token address format.\n\n' +
            'Supported formats:\n' +
            '• <b>BSC:</b> 0x... (42 characters)\n' +
            '• <b>Solana:</b> Base58 (32-44 characters)\n\n' +
            'Contoh:\n' +
            '• BSC: 0xd44bfa2e3c780fa8bcae8cda4f04e1bcbd8df126\n' +
            '• Solana: DYj6YVZkHcytZBtTSFPnMi5NLNHueNvcmCdmYNTkpump',
            { parse_mode: 'HTML' }
          ).catch(() => {});
          return;
        }

        const chainName = isBSC ? 'PancakeSwap (BSC)' : 'Solana DEX';
        this.bot!.sendMessage(chatId, `🔍 Checking coin on ${chainName}...`).catch(() => {});
        
        const result = await this.tradingService.checkTokenOnPancakeSwap(input);
        
        if (!result.exists) {
          const chainText = result.chain === 'bsc' ? 'PancakeSwap (BSC)' : 
                           result.chain === 'solana' ? 'Solana DEX' : 'DEX';
          this.bot!.sendMessage(
            chatId,
            `❌ <b>Token Not Found on ${chainText}</b>\n\n` +
            `📍 Address: <code>${input}</code>\n` +
            `🔗 Chain: ${chainText}\n\n` +
            `Token tidak ditemukan di ${chainText}.\n` +
            `Pastikan alamat token benar atau token belum terdaftar.`,
            { parse_mode: 'HTML' }
          ).catch(() => {});
          return;
        }

        const chainText = result.chain === 'bsc' ? 'PancakeSwap (BSC)' : 'Solana DEX';
        const priceChangeEmoji = result.priceChange24h && result.priceChange24h >= 0 ? '📈' : '📉';
        const priceChangeText = result.priceChange24h !== undefined 
          ? `${priceChangeEmoji} ${result.priceChange24h >= 0 ? '+' : ''}${result.priceChange24h.toFixed(2)}% (24h)`
          : 'N/A';

        let message = 
          `✅ <b>Token Found on ${chainText}</b>\n\n` +
          `🪙 Name: ${result.name || 'Unknown'}\n` +
          `💎 Symbol: <b>${result.symbol || 'Unknown'}</b>\n` +
          `📍 Address: <code>${input}</code>\n` +
          `🔗 Chain: ${chainText}\n\n`;
        
        if (result.price !== undefined) {
          message += `💰 Price: $${result.price.toFixed(8)}\n`;
        }
        
        message += `📊 24h Change: ${priceChangeText}\n`;
        
        if (result.liquidity !== undefined) {
          const liquidityText = result.liquidity >= 1000000 
            ? `$${(result.liquidity / 1000000).toFixed(2)}M`
            : `$${(result.liquidity / 1000).toFixed(2)}K`;
          message += `💧 Liquidity: ${liquidityText}\n`;
        }
        
        if (result.volume24h !== undefined) {
          const volumeText = result.volume24h >= 1000000 
            ? `$${(result.volume24h / 1000000).toFixed(2)}M`
            : `$${(result.volume24h / 1000).toFixed(2)}K`;
          message += `📈 Volume 24h: ${volumeText}\n`;
        }

        if (result.pairs && result.pairs.length > 0) {
          message += `\n🔗 Pairs Found: ${result.pairs.length}`;
          
          // Show top 3 pairs
          const topPairs = result.pairs.slice(0, 3);
          topPairs.forEach((pair, index) => {
            const pairLiquidity = pair.liquidity?.usd 
              ? (pair.liquidity.usd >= 1000000 
                  ? `$${(pair.liquidity.usd / 1000000).toFixed(2)}M`
                  : `$${(pair.liquidity.usd / 1000).toFixed(2)}K`)
              : 'N/A';
            const dexName = pair.dexId || 'Unknown DEX';
            message += `\n${index + 1}. ${pair.baseToken.symbol}/${pair.quoteToken.symbol} (${dexName}) - Liq: ${pairLiquidity}`;
          });
        }

        // Generate DexScreener link based on chain
        const dexscreenerLink = result.chain === 'bsc' 
          ? `https://dexscreener.com/bsc/${input}`
          : `https://dexscreener.com/solana/${input}`;
        message += `\n\n🌐 DexScreener: ${dexscreenerLink}`;
        
        this.bot!.sendMessage(chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true }).catch(() => {});
      } catch (error: any) {
        logger.error('Error checking token:', error);
        this.bot!.sendMessage(chatId, `❌ Error: ${error.message || 'Failed to check token'}`).catch(() => {});
      }
    });

    // /24h command - Get 24h timeframe statistics
    this.bot.onText(/\/24h\s+(.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const input = match && match[1] ? match[1].trim() : '';
      
      if (!input) {
        this.bot!.sendMessage(chatId, '❌ Please provide token address.\nUsage: /24h <token_address>\n\nSupported:\n• BSC: 0x... (42 chars)\n• Solana: Base58 (32-44 chars)').catch(() => {});
        return;
      }

      try {
        // Detect chain type
        const isBSC = input.match(/^0x[a-fA-F0-9]{40}$/);
        const isSolana = input.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
        
        if (!isBSC && !isSolana) {
          this.bot!.sendMessage(
            chatId, 
            '❌ Invalid token address format.\n\n' +
            'Supported formats:\n' +
            '• <b>BSC:</b> 0x... (42 characters)\n' +
            '• <b>Solana:</b> Base58 (32-44 characters)',
            { parse_mode: 'HTML' }
          ).catch(() => {});
          return;
        }

        const chainName = isBSC ? 'PancakeSwap (BSC)' : 'Solana DEX';
        this.bot!.sendMessage(chatId, `📊 Analyzing 24h timeframe on ${chainName}...`).catch(() => {});
        
        const result = await this.tradingService.get24hTimeframe(input);
        
        if (!result.exists) {
          const chainText = result.chain === 'bsc' ? 'PancakeSwap (BSC)' : 
                           result.chain === 'solana' ? 'Solana DEX' : 'DEX';
          this.bot!.sendMessage(
            chatId,
            `❌ <b>Token Not Found on ${chainText}</b>\n\n` +
            `📍 Address: <code>${input}</code>\n\n` +
            `Token tidak ditemukan di ${chainText}.`,
            { parse_mode: 'HTML' }
          ).catch(() => {});
          return;
        }

        const chainText = result.chain === 'bsc' ? 'PancakeSwap (BSC)' : 'Solana DEX';
        const priceChangeEmoji = result.priceChange24h && result.priceChange24h >= 0 ? '📈' : '📉';
        
        let message = `📊 <b>24h Timeframe Analysis</b>\n\n`;
        message += `🪙 <b>${result.name || 'Unknown'}</b> (${result.symbol || 'Unknown'})\n`;
        message += `📍 <code>${input}</code>\n`;
        message += `🔗 ${chainText}\n\n`;
        
        message += `💰 <b>Price Information</b>\n`;
        if (result.currentPrice !== undefined) {
          message += `Current: $${result.currentPrice.toFixed(8)}\n`;
        }
        
        if (result.high24h !== undefined && result.low24h !== undefined) {
          message += `24h High: $${result.high24h.toFixed(8)}\n`;
          message += `24h Low: $${result.low24h.toFixed(8)}\n`;
          if (result.currentPrice) {
            const rangePercent = ((result.high24h - result.low24h) / result.low24h) * 100;
            message += `Range: ${rangePercent.toFixed(2)}%\n`;
          }
        }
        
        if (result.priceChange24h !== undefined) {
          message += `${priceChangeEmoji} 24h Change: ${result.priceChange24h >= 0 ? '+' : ''}${result.priceChange24h.toFixed(2)}%\n`;
        }
        
        // Price change breakdown
        if (result.priceChange) {
          message += `\n📈 <b>Price Changes</b>\n`;
          if (result.priceChange.h1 !== undefined) {
            message += `1h: ${result.priceChange.h1 >= 0 ? '+' : ''}${result.priceChange.h1.toFixed(2)}%\n`;
          }
          if (result.priceChange.h6 !== undefined) {
            message += `6h: ${result.priceChange.h6 >= 0 ? '+' : ''}${result.priceChange.h6.toFixed(2)}%\n`;
          }
          if (result.priceChange.h24 !== undefined) {
            message += `24h: ${result.priceChange.h24 >= 0 ? '+' : ''}${result.priceChange.h24.toFixed(2)}%\n`;
          }
        }
        
        message += `\n💧 <b>Volume (24h)</b>\n`;
        if (result.volume24h !== undefined) {
          const volumeText = result.volume24h >= 1000000 
            ? `$${(result.volume24h / 1000000).toFixed(2)}M`
            : result.volume24h >= 1000
            ? `$${(result.volume24h / 1000).toFixed(2)}K`
            : `$${result.volume24h.toFixed(2)}`;
          message += `24h: ${volumeText}\n`;
        }
        if (result.volume6h !== undefined) {
          const volume6hText = result.volume6h >= 1000000 
            ? `$${(result.volume6h / 1000000).toFixed(2)}M`
            : result.volume6h >= 1000
            ? `$${(result.volume6h / 1000).toFixed(2)}K`
            : `$${result.volume6h.toFixed(2)}`;
          message += `6h: ${volume6hText}\n`;
        }
        if (result.volume1h !== undefined) {
          const volume1hText = result.volume1h >= 1000000 
            ? `$${(result.volume1h / 1000000).toFixed(2)}M`
            : result.volume1h >= 1000
            ? `$${(result.volume1h / 1000).toFixed(2)}K`
            : `$${result.volume1h.toFixed(2)}`;
          message += `1h: ${volume1hText}\n`;
        }
        
        // Transactions
        if (result.txns24h) {
          message += `\n🔄 <b>Transactions (24h)</b>\n`;
          message += `Total: ${result.txns24h.total.toLocaleString()}\n`;
          message += `✅ Buys: ${result.txns24h.buys.toLocaleString()}\n`;
          message += `❌ Sells: ${result.txns24h.sells.toLocaleString()}\n`;
          if (result.txns24h.total > 0) {
            const buyRatio = (result.txns24h.buys / result.txns24h.total) * 100;
            message += `Buy Ratio: ${buyRatio.toFixed(2)}%\n`;
          }
        }
        
        // Liquidity & Market Cap
        message += `\n💎 <b>Market Info</b>\n`;
        if (result.liquidity !== undefined) {
          const liquidityText = result.liquidity >= 1000000 
            ? `$${(result.liquidity / 1000000).toFixed(2)}M`
            : `$${(result.liquidity / 1000).toFixed(2)}K`;
          message += `Liquidity: ${liquidityText}\n`;
        }
        if (result.marketCap !== undefined) {
          const marketCapText = result.marketCap >= 1000000 
            ? `$${(result.marketCap / 1000000).toFixed(2)}M`
            : `$${(result.marketCap / 1000).toFixed(2)}K`;
          message += `Market Cap: ${marketCapText}\n`;
        }
        if (result.fdv !== undefined) {
          const fdvText = result.fdv >= 1000000 
            ? `$${(result.fdv / 1000000).toFixed(2)}M`
            : `$${(result.fdv / 1000).toFixed(2)}K`;
          message += `FDV: ${fdvText}\n`;
        }
        
        // Pairs info
        if (result.pairs && result.pairs.length > 0) {
          message += `\n🔗 <b>Pairs:</b> ${result.pairs.length}`;
        }

        // DexScreener link
        const dexscreenerLink = result.chain === 'bsc' 
          ? `https://dexscreener.com/bsc/${input}`
          : `https://dexscreener.com/solana/${input}`;
        message += `\n\n🌐 <a href="${dexscreenerLink}">View on DexScreener</a>`;
        
        this.bot!.sendMessage(chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true }).catch(() => {});
      } catch (error: any) {
        logger.error('Error getting 24h timeframe:', error);
        this.bot!.sendMessage(chatId, `❌ Error: ${error.message || 'Failed to get 24h timeframe'}`).catch(() => {});
      }
    });

    // /infocoin command - Get coin information from internet (website, social media, etc.)
    this.bot.onText(/\/infocoin\s+(.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const input = match && match[1] ? match[1].trim() : '';
      
      if (!input) {
        this.bot!.sendMessage(chatId, '❌ Please provide token address.\nUsage: /infocoin <token_address>\n\nSupported:\n• BSC: 0x... (42 chars)\n• Solana: Base58 (32-44 chars)').catch(() => {});
        return;
      }

      try {
        // Detect chain type
        const isBSC = input.match(/^0x[a-fA-F0-9]{40}$/);
        const isSolana = input.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
        
        if (!isBSC && !isSolana) {
          this.bot!.sendMessage(
            chatId, 
            '❌ Invalid token address format.\n\n' +
            'Supported formats:\n' +
            '• <b>BSC:</b> 0x... (42 characters)\n' +
            '• <b>Solana:</b> Base58 (32-44 characters)',
            { parse_mode: 'HTML' }
          ).catch(() => {});
          return;
        }

        const chainName = isBSC ? 'BSC' : 'Solana';
        this.bot!.sendMessage(chatId, `🔍 Searching coin information on ${chainName}...`).catch(() => {});
        
        const result = await this.tradingService.getCoinInfo(input);
        
        if (!result.exists) {
          const chainText = result.chain === 'bsc' ? 'PancakeSwap (BSC)' : 
                           result.chain === 'solana' ? 'Solana DEX' : 'DEX';
          this.bot!.sendMessage(
            chatId,
            `❌ <b>Token Not Found</b>\n\n` +
            `📍 Address: <code>${input}</code>\n\n` +
            `Token tidak ditemukan di ${chainText}.`,
            { parse_mode: 'HTML' }
          ).catch(() => {});
          return;
        }

        const chainText = result.chain === 'bsc' ? 'BSC (Binance Smart Chain)' : 'Solana';
        
        let message = `ℹ️ <b>Coin Information</b>\n\n`;
        message += `🪙 <b>${result.name || 'Unknown'}</b> (${result.symbol || 'Unknown'})\n`;
        message += `📍 Address: <code>${result.address}</code>\n`;
        message += `🔗 Chain: ${chainText}\n\n`;

        // Social Links
        let hasLinks = false;
        message += `<b>🌐 Social & Links</b>\n`;
        
        if (result.website) {
          message += `🌍 Website: <a href="${result.website}">${result.website.replace(/^https?:\/\//, '')}</a>\n`;
          hasLinks = true;
        }
        
        if (result.twitter) {
          const twitterHandle = result.twitter.replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//, '').replace(/^@/, '');
          message += `🐦 Twitter/X: <a href="${result.twitter}">@${twitterHandle}</a>\n`;
          hasLinks = true;
        }
        
        if (result.telegram) {
          const telegramHandle = result.telegram.replace(/^https?:\/\/(t\.me|telegram\.me)\//, '').replace(/^@/, '');
          message += `💬 Telegram: <a href="${result.telegram}">@${telegramHandle}</a>\n`;
          hasLinks = true;
        }
        
        if (result.discord) {
          message += `💎 Discord: <a href="${result.discord}">Join Server</a>\n`;
          hasLinks = true;
        }
        
        if (result.reddit) {
          message += `🔴 Reddit: <a href="${result.reddit}">View Community</a>\n`;
          hasLinks = true;
        }

        if (!hasLinks) {
          message += `ℹ️ No social links found in database\n`;
        }

        // Community Data (if available)
        if (result.community_data) {
          message += `\n<b>👥 Community</b>\n`;
          if (result.community_data.twitter_followers) {
            const followers = result.community_data.twitter_followers >= 1000000
              ? `${(result.community_data.twitter_followers / 1000000).toFixed(2)}M`
              : result.community_data.twitter_followers >= 1000
              ? `${(result.community_data.twitter_followers / 1000).toFixed(1)}K`
              : result.community_data.twitter_followers.toString();
            message += `Twitter Followers: ${followers}\n`;
          }
          if (result.community_data.telegram_channel_user_count) {
            const users = result.community_data.telegram_channel_user_count >= 1000000
              ? `${(result.community_data.telegram_channel_user_count / 1000000).toFixed(2)}M`
              : result.community_data.telegram_channel_user_count >= 1000
              ? `${(result.community_data.telegram_channel_user_count / 1000).toFixed(1)}K`
              : result.community_data.telegram_channel_user_count.toString();
            message += `Telegram Members: ${users}\n`;
          }
        }

        // Description
        if (result.description) {
          message += `\n<b>📝 Description</b>\n`;
          // Remove HTML tags and format
          const cleanDescription = result.description
            .replace(/<[^>]*>/g, '')
            .replace(/\n+/g, ' ')
            .trim();
          message += `${cleanDescription}\n`;
        }

        // Additional Links
        if (result.links) {
          const additionalLinks: string[] = [];
          
          if (result.links.blockchain_site && result.links.blockchain_site.length > 0) {
            result.links.blockchain_site.slice(0, 2).forEach((link: string) => {
              if (link && link.startsWith('http')) {
                additionalLinks.push(`🔗 <a href="${link}">Blockchain Explorer</a>`);
              }
            });
          }
          
          if (result.links.repos_url?.github && result.links.repos_url.github.length > 0) {
            result.links.repos_url.github.slice(0, 1).forEach((link: string) => {
              if (link && link.startsWith('http')) {
                additionalLinks.push(`💻 <a href="${link}">GitHub</a>`);
              }
            });
          }

          if (additionalLinks.length > 0) {
            message += `\n<b>🔗 Additional Links</b>\n${additionalLinks.join('\n')}\n`;
          }
        }

        // CoinGecko link (only show if we have validated data)
        if (result.coingecko_id) {
          message += `\n📊 <a href="https://www.coingecko.com/en/coins/${result.coingecko_id}">View on CoinGecko</a>`;
          message += `\n✅ <i>CoinGecko data validated by contract address</i>`;
        } else {
          message += `\n⚠️ <i>Coin not found in CoinGecko database (contract address not registered)</i>`;
        }

        // DexScreener link
        const dexscreenerLink = result.chain === 'bsc' 
          ? `https://dexscreener.com/bsc/${result.address}`
          : `https://dexscreener.com/solana/${result.address}`;
        message += `📈 <a href="${dexscreenerLink}">View on DexScreener</a>`;
        
        this.bot!.sendMessage(chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true }).catch(() => {});
      } catch (error: any) {
        logger.error('Error getting coin info:', error);
        this.bot!.sendMessage(chatId, `❌ Error: ${error.message || 'Failed to get coin information'}`).catch(() => {});
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


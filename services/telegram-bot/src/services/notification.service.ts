import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../config/logger';
import { formatCoinAlert, CoinAlert } from '../utils/formatters';
import { RateLimiterService } from './rate-limiter.service';
import { pool } from '../config/database';

/**
 * Notification service for sending Telegram alerts
 */
export class NotificationService {
  private bot: TelegramBot;
  private rateLimiter: RateLimiterService;

  constructor(botToken: string) {
    this.bot = new TelegramBot(botToken, { polling: false });
    this.rateLimiter = new RateLimiterService();
  }

  /**
   * Get all active users (users who have started the bot)
   */
  async getActiveUsers(): Promise<number[]> {
    try {
      const result = await pool.query(
        `SELECT DISTINCT telegram_id FROM users WHERE telegram_id IS NOT NULL`
      );

      return result.rows.map((row) => parseInt(row.telegram_id));
    } catch (error) {
      logger.error('Error fetching active users:', error);
      return [];
    }
  }

  /**
   * Get user's preferred chat ID (or use provided)
   */
  async getUserChatId(telegramId: number): Promise<number | null> {
    // For now, use telegram_id as chat_id
    // In future, can add separate chat_id field in users table
    return telegramId;
  }

  /**
   * Send coin alert to a user
   */
  async sendAlert(chatId: number, alert: CoinAlert): Promise<boolean> {
    try {
      // Check rate limit
      const canSend = await this.rateLimiter.canSendMessage(chatId);
      if (!canSend) {
        logger.warn(`Rate limit exceeded for chat ${chatId}, skipping alert`);
        return false;
      }

      // Format message
      const message = formatCoinAlert(alert);

      // Send message with HTML parsing
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });

      logger.info(`Alert sent to chat ${chatId} for coin ${alert.coinAddress}`);
      return true;
    } catch (error: any) {
      logger.error(`Error sending alert to chat ${chatId}:`, error);

      // Handle specific Telegram errors
      if (error.response?.body?.error_code === 403) {
        logger.warn(`Bot blocked by user ${chatId}`);
      }

      return false;
    }
  }

  /**
   * Send alert to all active users
   */
  async broadcastAlert(alert: CoinAlert): Promise<number> {
    const activeUsers = await this.getActiveUsers();
    logger.info(`Broadcasting alert to ${activeUsers.length} users`);

    let successCount = 0;

    for (const userId of activeUsers) {
      try {
        const chatId = await this.getUserChatId(userId);
        if (!chatId) continue;

        const sent = await this.sendAlert(chatId, alert);
        if (sent) {
          successCount++;
        }

        // Small delay to avoid hitting rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        logger.error(`Error broadcasting to user ${userId}:`, error);
        // Continue with other users
      }
    }

    logger.info(`Alert broadcast complete: ${successCount}/${activeUsers.length} sent`);
    return successCount;
  }

  /**
   * Send alert to specific chat ID (from env or user preference)
   */
  async sendToConfiguredChat(alert: CoinAlert): Promise<boolean> {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      logger.warn('TELEGRAM_CHAT_ID not configured, skipping alert');
      return false;
    }

    try {
      return await this.sendAlert(parseInt(chatId), alert);
    } catch (error) {
      logger.error('Error sending to configured chat:', error);
      return false;
    }
  }
}


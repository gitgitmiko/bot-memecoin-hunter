/**
 * Telegram Notification Service for Auto-Sell Notifications
 * Sends notifications to Telegram when auto-sell is executed
 */

import TelegramBot from 'node-telegram-bot-api';
import { pool } from '../config/database';
import { logger } from '../config/logger';

export interface AutoSellNotificationData {
  positionId: number;
  tokenAddress: string;
  symbol?: string;
  chainId: number;
  txHash: string;
  pnl: number;
  pnlPercentage?: number;
  buyPrice: number;
  sellPrice: number;
  highestPrice: number;
  amountInvested: number;
}

export class TelegramNotificationService {
  private bot: TelegramBot | null = null;
  private botToken: string | null = null;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
    
    if (this.botToken) {
      try {
        this.bot = new TelegramBot(this.botToken, { polling: false });
        logger.info('Telegram notification service initialized');
      } catch (error: any) {
        logger.error(`Failed to initialize Telegram bot: ${error.message}`);
        this.bot = null;
      }
    } else {
      logger.warn('TELEGRAM_BOT_TOKEN not found. Auto-sell notifications will be disabled.');
    }
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
   * Get configured chat ID from environment
   */
  getConfiguredChatId(): number | null {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      return null;
    }
    return parseInt(chatId);
  }

  /**
   * Format auto-sell notification message
   */
  private formatAutoSellMessage(data: AutoSellNotificationData): string {
    const chainName = data.chainId === 56 ? 'BSC' : data.chainId === 999 ? 'Solana' : `Chain ${data.chainId}`;
    const symbol = data.symbol || 'N/A';
    const pnlEmoji = data.pnl >= 0 ? '📈' : '📉';
    const pnlSign = data.pnl >= 0 ? '+' : '';
    const pnlPercentage = data.pnlPercentage !== undefined 
      ? `${pnlSign}${data.pnlPercentage.toFixed(2)}%` 
      : 'N/A';

    const message = `🤖 <b>AUTO-SELL EXECUTED</b>\n\n` +
      `💰 <b>Position ID:</b> ${data.positionId}\n` +
      `🪙 <b>Token:</b> ${symbol}\n` +
      `📍 <b>Address:</b> <code>${data.tokenAddress}</code>\n` +
      `⛓️ <b>Chain:</b> ${chainName}\n\n` +
      `💵 <b>Invested:</b> $${data.amountInvested.toFixed(2)}\n` +
      `📊 <b>Buy Price:</b> $${data.buyPrice.toFixed(8)}\n` +
      `💵 <b>Sell Price:</b> $${data.sellPrice.toFixed(8)}\n` +
      `🔺 <b>Highest Price:</b> $${data.highestPrice.toFixed(8)}\n\n` +
      `${pnlEmoji} <b>PnL:</b> ${pnlSign}$${data.pnl.toFixed(2)} (${pnlPercentage})\n\n` +
      `🔗 <b>TX Hash:</b> <code>${data.txHash}</code>\n\n` +
      `✅ <i>Sold automatically by profit floor logic</i>`;

    return message;
  }

  /**
   * Send auto-sell notification to a specific chat
   */
  async sendNotification(chatId: number, data: AutoSellNotificationData): Promise<boolean> {
    if (!this.bot) {
      logger.warn('Telegram bot not initialized, cannot send notification');
      return false;
    }

    try {
      const message = this.formatAutoSellMessage(data);
      
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });

      logger.info(`Auto-sell notification sent to chat ${chatId} for position ${data.positionId}`);
      return true;
    } catch (error: any) {
      logger.error(`Error sending notification to chat ${chatId}:`, error);

      // Handle specific Telegram errors
      if (error.response?.body?.error_code === 403) {
        logger.warn(`Bot blocked by user ${chatId}`);
      }

      return false;
    }
  }

  /**
   * Broadcast auto-sell notification to all active users
   */
  async broadcastNotification(data: AutoSellNotificationData): Promise<number> {
    if (!this.bot) {
      logger.warn('Telegram bot not initialized, cannot broadcast notification');
      return 0;
    }

    const activeUsers = await this.getActiveUsers();
    logger.info(`Broadcasting auto-sell notification to ${activeUsers.length} users`);

    let successCount = 0;

    for (const userId of activeUsers) {
      try {
        const sent = await this.sendNotification(userId, data);
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

    logger.info(`Auto-sell notification broadcast complete: ${successCount}/${activeUsers.length} sent`);
    return successCount;
  }

  /**
   * Send notification to configured chat ID (from env)
   */
  async sendToConfiguredChat(data: AutoSellNotificationData): Promise<boolean> {
    const chatId = this.getConfiguredChatId();
    if (!chatId) {
      logger.warn('TELEGRAM_CHAT_ID not configured, skipping notification');
      return false;
    }

    return await this.sendNotification(chatId, data);
  }

  /**
   * Send notification (tries configured chat first, then broadcasts to all users)
   */
  async notifyAutoSell(data: AutoSellNotificationData): Promise<void> {
    if (!this.bot) {
      logger.warn('Telegram bot not initialized, skipping auto-sell notification');
      return;
    }

    try {
      // Try configured chat first
      const configuredChatId = this.getConfiguredChatId();
      if (configuredChatId) {
        await this.sendToConfiguredChat(data);
      } else {
        // If no configured chat, broadcast to all active users
        await this.broadcastNotification(data);
      }
    } catch (error) {
      logger.error('Error in notifyAutoSell:', error);
    }
  }
}


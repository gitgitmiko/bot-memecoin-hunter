import { getRedisClient } from '../config/redis';
import { logger } from '../config/logger';

/**
 * Rate limiter service for Telegram messages
 * Uses Redis to track message counts per user/channel
 */
export class RateLimiterService {
  private readonly MAX_MESSAGES_PER_MINUTE = 5; // Max 5 messages per minute
  private readonly RATE_LIMIT_WINDOW = 60; // 60 seconds

  /**
   * Check if message can be sent (rate limit check)
   */
  async canSendMessage(chatId: number): Promise<boolean> {
    try {
      const client = getRedisClient();
      if (!client.isOpen) {
        await client.connect();
      }

      const key = `rate_limit:telegram:${chatId}`;
      const currentCount = await client.get(key);

      if (!currentCount) {
        // First message in window
        await client.setEx(key, this.RATE_LIMIT_WINDOW, '1');
        return true;
      }

      const count = parseInt(currentCount, 10);
      if (count >= this.MAX_MESSAGES_PER_MINUTE) {
        logger.debug(`Rate limit exceeded for chat ${chatId}`);
        return false;
      }

      // Increment counter
      await client.incr(key);
      return true;
    } catch (error) {
      logger.error('Error checking rate limit:', error);
      // Allow message if rate limit check fails
      return true;
    }
  }

  /**
   * Reset rate limit for a chat (for testing/admin purposes)
   */
  async resetRateLimit(chatId: number): Promise<void> {
    try {
      const client = getRedisClient();
      if (!client.isOpen) {
        await client.connect();
      }

      const key = `rate_limit:telegram:${chatId}`;
      await client.del(key);
    } catch (error) {
      logger.error('Error resetting rate limit:', error);
    }
  }
}


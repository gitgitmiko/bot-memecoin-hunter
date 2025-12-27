import { publishToQueue } from '../config/redis';
import { CrawlerJob, NormalizedCoin } from '../types';
import { logger } from '../config/logger';
import { REDIS_QUEUES } from '../utils/constants';

/**
 * Redis queue service for publishing crawler jobs
 */
export class QueueService {
  /**
   * Publish new coin to Redis queue
   */
  async publishNewCoin(coin: NormalizedCoin): Promise<void> {
    try {
      const job: CrawlerJob = {
        event: 'crawler:new-coin',
        timestamp: new Date().toISOString(),
        data: {
          coinAddress: coin.address,
          chainId: coin.chainId,
          source: coin.source,
          normalizedData: coin,
        },
      };

      await publishToQueue(REDIS_QUEUES.CRAWLER_NEW_COIN, job);
      logger.info(`Published new coin to queue: ${coin.address}`);
    } catch (error) {
      logger.error(`Error publishing coin to queue ${coin.address}:`, error);
      throw error;
    }
  }

  /**
   * Batch publish coins to queue
   */
  async publishCoins(coins: NormalizedCoin[]): Promise<void> {
    for (const coin of coins) {
      try {
        await this.publishNewCoin(coin);
      } catch (error) {
        logger.error(`Error publishing coin in batch:`, error);
        // Continue with other coins
      }
    }
  }
}


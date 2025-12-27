import dotenv from 'dotenv';
import { initRedis } from './config/redis';
import { testConnection } from './config/database';
import { logger } from './config/logger';
import { DexScreenerCrawler } from './crawlers/dexscreener-crawler';
import { StorageService } from './services/storage.service';
import { QueueService } from './services/queue.service';
import { validateCoinData } from './utils/validators';
import { NormalizedCoin } from './types';

dotenv.config();

/**
 * Main crawler service entry point
 */
class CrawlerService {
  private crawler: DexScreenerCrawler;
  private storageService: StorageService;
  private queueService: QueueService;
  private interval: number;
  private isRunning: boolean = false;

  constructor() {
    this.crawler = new DexScreenerCrawler();
    this.storageService = new StorageService();
    this.queueService = new QueueService();
    this.interval = parseInt(process.env.CRAWLER_INTERVAL || '300000'); // Default 5 minutes
  }

  /**
   * Initialize services
   */
  async initialize(): Promise<void> {
    logger.info('Initializing crawler service...');

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    logger.info('Database connection established');

    // Initialize Redis
    await initRedis();
    logger.info('Redis connection established');

    logger.info('Crawler service initialized successfully');
  }

  /**
   * Run one crawl cycle
   */
  async crawl(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Crawl already running, skipping...');
      return;
    }

    this.isRunning = true;
    logger.info('Starting crawl cycle...');

    try {
      // Fetch new pairs from DexScreener
      const pairs = await this.crawler.fetchNewPairs([
        'ethereum',
        'bsc',
        'base',
        'solana',
      ]);

      if (pairs.length === 0) {
        logger.info('No new pairs found');
        this.isRunning = false;
        return;
      }

      logger.info(`Found ${pairs.length} new pairs, processing...`);

      // Normalize and validate pairs
      const normalizedCoins: NormalizedCoin[] = [];
      for (const pair of pairs) {
        try {
          const normalized = this.crawler.normalizePair(pair);

          // Validate coin data
          if (validateCoinData(normalized)) {
            normalizedCoins.push(normalized);
          } else {
            logger.warn(`Invalid coin data for ${normalized.address}, skipping`);
          }
        } catch (error) {
          logger.error(`Error normalizing pair:`, error);
          // Continue with other pairs
        }
      }

      logger.info(
        `Validated ${normalizedCoins.length} coins out of ${pairs.length} pairs`
      );

      if (normalizedCoins.length === 0) {
        logger.info('No valid coins to process');
        this.isRunning = false;
        return;
      }

      // Store coins to database
      const storedIds = await this.storageService.storeCoins(normalizedCoins);
      logger.info(`Stored ${storedIds.length} new coins to database`);

      // Publish new coins to Redis queue for analyzer
      await this.queueService.publishCoins(normalizedCoins);
      logger.info(`Published ${normalizedCoins.length} coins to queue`);

      logger.info('Crawl cycle completed successfully');
    } catch (error) {
      logger.error('Error during crawl cycle:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start crawler service
   */
  async start(): Promise<void> {
    await this.initialize();

    logger.info(`Crawler service started. Interval: ${this.interval}ms`);

    // Run initial crawl
    await this.crawl();

    // Schedule periodic crawls
    setInterval(() => {
      this.crawl().catch((error) => {
        logger.error('Error in scheduled crawl:', error);
      });
    }, this.interval);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down crawler service...');
    this.isRunning = false;
    process.exit(0);
  }
}

// Start service
const service = new CrawlerService();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  service.shutdown();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  service.shutdown();
});

// Start the service
service.start().catch((error) => {
  logger.error('Failed to start crawler service:', error);
  process.exit(1);
});


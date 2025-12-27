import dotenv from 'dotenv';
import { initRedis, getRedisClient } from './config/redis';
import { testConnection, pool } from './config/database';
import { logger } from './config/logger';
import { ValidationService } from './services/validation.service';
import { RiskCheckService } from './services/risk-check.service';
import { ScoringService } from './services/scoring.service';
import { StorageService } from './services/storage.service';
import { QueueService } from './services/queue.service';
import { AnalysisResult, CrawlerJobData } from './types';
import { REDIS_QUEUES } from './utils/constants';

dotenv.config();

/**
 * Analyzer worker service
 * Consumes jobs from Redis queue, analyzes coins, and stores results
 */
class AnalyzerService {
  private validationService: ValidationService;
  private riskCheckService: RiskCheckService;
  private scoringService: ScoringService;
  private storageService: StorageService;
  private queueService: QueueService;
  private isProcessing: boolean = false;

  constructor() {
    this.validationService = new ValidationService();
    this.riskCheckService = new RiskCheckService();
    this.scoringService = new ScoringService();
    this.storageService = new StorageService();
    this.queueService = new QueueService();
  }

  /**
   * Initialize services
   */
  async initialize(): Promise<void> {
    logger.info('Initializing analyzer service...');

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    logger.info('Database connection established');

    // Initialize Redis
    await initRedis();
    logger.info('Redis connection established');
  }

  /**
   * Get coin data from database
   */
  async getCoinData(coinAddress: string, chainId: number): Promise<any> {
    try {
      // Solana addresses (chain_id = 999) are case-sensitive, don't lowercase them
      // Ethereum addresses should be lowercase for consistency
      const isSolana = chainId === 999;
      const address = isSolana ? coinAddress : coinAddress.toLowerCase();
      
      const result = await pool.query(
        `SELECT * FROM coins WHERE address = $1 AND chain_id = $2`,
        [address, chainId]
      );

      if (result.rows.length === 0) {
        logger.warn(`Coin ${coinAddress} not found in database`);
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error(`Error fetching coin data for ${coinAddress}:`, error);
      throw error;
    }
  }

  /**
   * Analyze a coin
   */
  async analyzeCoin(jobData: CrawlerJobData): Promise<AnalysisResult | null> {
    try {
      logger.info(`Analyzing coin: ${jobData.coinAddress}`);

      // Get coin data from database
      const coinData = await this.getCoinData(
        jobData.coinAddress,
        jobData.chainId
      );

      if (!coinData) {
        logger.warn(`Coin ${jobData.coinAddress} not found, skipping analysis`);
        return null;
      }

      // Extract liquidity
      const liquidityUsd = coinData.liquidity
        ? parseFloat(coinData.liquidity)
        : undefined;

      // Validate coin
      const validation = this.validationService.validate({
        liquidityUsd,
        volume24h: jobData.normalizedData.volume24h,
        holderCount: undefined, // Not available from DexScreener
      });

      if (!validation.isValid) {
        logger.warn(
          `Coin ${jobData.coinAddress} failed validation: ${validation.errors.join(', ')}`
        );
        // Continue analysis even if validation fails (warnings only)
      }

      // Perform risk checks
      const riskCheck = await this.riskCheckService.checkRisks(
        jobData.coinAddress,
        jobData.chainId,
        liquidityUsd
      );

      // Calculate scores
      const priceScore = this.scoringService.calculatePriceScore(
        jobData.normalizedData.priceChange24h
      );
      const volumeScore = this.scoringService.calculateVolumeScore(
        jobData.normalizedData.volume24h
      );
      const socialScore = this.scoringService.calculateSocialScore(
        jobData.normalizedData.transactions24h
      );
      const riskScore = this.scoringService.calculateRiskScore(riskCheck);
      const overallScore = this.scoringService.calculateScore(
        priceScore,
        volumeScore,
        socialScore,
        riskScore
      );

      // Build analysis result
      const analysis: AnalysisResult = {
        coinId: coinData.id,
        coinAddress: jobData.coinAddress,
        priceScore,
        volumeScore,
        socialScore,
        riskScore,
        overallScore,
        metrics: {
          liquidityUsd,
          volume24h: jobData.normalizedData.volume24h,
          isHoneypot: riskCheck.isHoneypot,
          hasMintAuthority: riskCheck.hasMintAuthority,
          liquidityLocked: riskCheck.liquidityLocked,
          riskLevel: riskCheck.riskLevel,
          riskReasons: riskCheck.riskReasons,
        },
        recommendations: [],
      };

      // Generate recommendations
      analysis.recommendations = this.scoringService.generateRecommendations(analysis);

      logger.info(
        `Analysis complete for ${jobData.coinAddress}: Score ${overallScore}`
      );

      return analysis;
    } catch (error) {
      logger.error(`Error analyzing coin ${jobData.coinAddress}:`, error);
      return null;
    }
  }

  /**
   * Process a job from queue
   */
  async processJob(message: string): Promise<void> {
    if (this.isProcessing) {
      logger.warn('Already processing a job, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      const job = JSON.parse(message);
      if (job.event !== 'crawler:new-coin') {
        logger.warn(`Unknown job event: ${job.event}`);
        return;
      }

      const jobData: CrawlerJobData = job.data;

      // Analyze coin
      const analysis = await this.analyzeCoin(jobData);
      if (!analysis) {
        logger.warn(`Analysis failed for ${jobData.coinAddress}`);
        return;
      }

      // Store analysis result
      await this.storageService.storeAnalysis(analysis);

      // Publish high-score coins to queue
      await this.queueService.publishHighScoreCoin(analysis);
    } catch (error) {
      logger.error('Error processing job:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start analyzer service
   */
  async start(): Promise<void> {
    await this.initialize();

    logger.info('Analyzer service started, listening to queue...');

    const client = getRedisClient();
    if (!client.isOpen) {
      await client.connect();
    }

    // Subscribe to crawler queue
    const subscriber = client.duplicate();
    await subscriber.connect();

    await subscriber.subscribe(REDIS_QUEUES.CRAWLER_NEW_COIN, (message) => {
      logger.info('Received job from queue');
      this.processJob(message).catch((error) => {
        logger.error('Error in job processor:', error);
      });
    });

    logger.info(`Subscribed to queue: ${REDIS_QUEUES.CRAWLER_NEW_COIN}`);

    // Keep process alive
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down...');
      subscriber.quit();
      client.quit();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down...');
      subscriber.quit();
      client.quit();
      process.exit(0);
    });
  }
}

// Start service
const service = new AnalyzerService();
service.start().catch((error) => {
  logger.error('Failed to start analyzer service:', error);
  process.exit(1);
});


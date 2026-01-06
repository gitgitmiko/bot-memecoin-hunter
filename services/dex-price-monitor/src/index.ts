/**
 * Dex Price Monitor Service
 * Monitors token prices and updates positions
 */

import dotenv from 'dotenv';
import { PriceMonitorService } from './services/price-monitor.service';
import { TelegramNotificationService } from './services/telegram-notification.service';
import { testConnection, pool } from './config/database';
import { logger } from './config/logger';

// TradeService will be loaded dynamically at runtime if available
// Note: Auto-sell functionality requires trade-engine files to be available
// For now, this service only detects sell conditions - actual selling should be handled by trade-engine service

dotenv.config();

class DexPriceMonitorService {
  private priceMonitor: PriceMonitorService;
  private tradeService: any = null; // Use any to avoid type errors at compile time
  private telegramNotification: TelegramNotificationService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly intervalMs: number;

  constructor() {
    this.priceMonitor = new PriceMonitorService();
    this.telegramNotification = new TelegramNotificationService();
    // Default interval: 45 seconds (between 30-60)
    this.intervalMs = parseInt(process.env.PRICE_MONITOR_INTERVAL_MS || '45000');
  }

  /**
   * Initialize services
   */
  async initialize(): Promise<void> {
    logger.info('Initializing dex price monitor service...');

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    logger.info('Database connection established');

    // Try to initialize TradeService for auto-sell operations (optional)
    // If trade-engine files are not available, this service will only detect sell conditions
    try {
      const path = require('path');
      const appRoot = path.resolve(__dirname, '../..'); // /app
      
      // Load PancakeSwap from shared (compiled JS should be available)
      // Since shared is copied but not compiled, we need to use ts-node for TypeScript files
      // But BSC_ADDRESSES is exported as const, so we can require the JS if compiled
      // For now, try to get BSC_ADDRESSES from trade-engine dist which should have it compiled
      const tradeServiceDistPath = path.join(appRoot, 'trade-engine', 'dist', 'src', 'services', 'trade.service');
      
      // Load compiled TradeService (should be available from build step)
      let TradeService;
      let BSC_ADDRESSES_BUSD;
      try {
        logger.debug(`Trying to load TradeService from dist: ${tradeServiceDistPath}`);
        const tradeModule = require(tradeServiceDistPath);
        TradeService = tradeModule.TradeService;
        
        // Also try to get BSC_ADDRESSES from shared (if available)
        try {
          const sharedPancakeswapPath = path.join(appRoot, 'shared', 'libs', 'pancakeswap');
          const pancakeswapModule = require(sharedPancakeswapPath);
          BSC_ADDRESSES_BUSD = pancakeswapModule.BSC_ADDRESSES?.BUSD;
        } catch (pancakeError) {
          // Fallback to hardcoded BUSD address
          BSC_ADDRESSES_BUSD = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
        }
        
        if (!BSC_ADDRESSES_BUSD) {
          BSC_ADDRESSES_BUSD = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'; // Fallback
        }
        
        logger.info('TradeService loaded from dist');
      } catch (distError: any) {
        logger.warn(`TradeService dist not found: ${distError.message}. Auto-sell will be disabled.`);
        throw new Error(`TradeService compiled files not found. Please ensure trade-engine is built.`);
      }
      
      const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/';
      const mnemonic = process.env.WALLET_MNEMONIC;
      const privateKey = process.env.WALLET_PRIVATE_KEY;
      const accountIndex = parseInt(process.env.WALLET_ACCOUNT_INDEX || '0', 10);

      const walletKey = mnemonic || privateKey;
      if (walletKey && TradeService) {
        this.tradeService = new TradeService(
          rpcUrl,
          walletKey,
          BSC_ADDRESSES_BUSD,
          accountIndex
        );
        logger.info('✅ TradeService initialized for auto-sell operations');
      } else {
        logger.warn('Wallet credentials or TradeService not found. Auto-sell will be disabled. This service will only detect sell conditions.');
      }
    } catch (error: any) {
      logger.warn(`TradeService not available: ${error.message}. Auto-sell will be disabled. This service will only detect sell conditions.`);
      if (error.stack) {
        logger.debug(`TradeService error stack: ${error.stack}`);
      }
    }

    logger.info(`Price monitor initialized with interval: ${this.intervalMs}ms`);
  }

  /**
   * Run one monitoring cycle
   */
  async monitorCycle(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Monitor cycle already running, skipping...');
      return;
    }

    this.isRunning = true;
    logger.info('Starting price monitor cycle...');

    try {
      // Update all open positions
      const results = await this.priceMonitor.updateAllPositions(56); // BSC only for now

      // Check which positions should be sold
      const sellCandidates = results.filter((r) => r.shouldSell);

      if (sellCandidates.length > 0) {
        logger.info(
          `Found ${sellCandidates.length} positions that should be sold based on profit floor logic.`
        );
        
        // Execute auto-sell if TradeService is available
        if (this.tradeService) {
          for (const candidate of sellCandidates) {
            try {
              logger.info(
                `Auto-selling position ${candidate.positionId} (token: ${candidate.tokenAddress}). Current price: $${candidate.currentPrice}, Floor: ${candidate.profitFloor}`
              );
              
              const sellResult = await this.tradeService.sell({
                positionId: candidate.positionId,
                slippage: 5,
              });
              
              logger.info(
                `✅ Auto-sell successful for position ${candidate.positionId}. TX: ${sellResult.txHash}, PnL: $${sellResult.pnl.toFixed(2)}`
              );

              // Get position details from database for notification
              try {
                const positionResult = await pool.query(
                  `SELECT * FROM positions WHERE id = $1`,
                  [candidate.positionId]
                );

                if (positionResult.rows.length > 0) {
                  const position = positionResult.rows[0];
                  
                  // Send Telegram notification
                  await this.telegramNotification.notifyAutoSell({
                    positionId: candidate.positionId,
                    tokenAddress: position.token_address,
                    symbol: position.symbol || undefined,
                    chainId: position.chain_id,
                    txHash: sellResult.txHash,
                    pnl: sellResult.pnl,
                    pnlPercentage: position.pnl_percentage ? parseFloat(position.pnl_percentage) : undefined,
                    buyPrice: parseFloat(position.buy_price_usd),
                    sellPrice: candidate.currentPrice,
                    highestPrice: parseFloat(position.highest_price_ever),
                    amountInvested: parseFloat(position.amount_usd_invested),
                  });

                  logger.info(`Telegram notification sent for auto-sell position ${candidate.positionId}`);
                } else {
                  logger.warn(`Position ${candidate.positionId} not found in database for notification`);
                }
              } catch (notifError: any) {
                logger.error(`Failed to send Telegram notification for position ${candidate.positionId}: ${notifError.message}`);
                // Don't fail the auto-sell if notification fails
              }
              
              // Small delay between sells to avoid rate limits
              await new Promise((resolve) => setTimeout(resolve, 2000));
            } catch (error: any) {
              logger.error(
                `Failed to auto-sell position ${candidate.positionId}: ${error.message}`
              );
              // Continue with next position even if one fails
            }
          }
        } else {
          logger.warn(
            `TradeService not initialized. ${sellCandidates.length} positions meet sell conditions but auto-sell is disabled.`
          );
        }
      }

      logger.info(`Price monitor cycle completed. Updated ${results.length} positions.`);
    } catch (error) {
      logger.error('Error in price monitor cycle:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start monitoring (runs on interval)
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Monitor already started');
      return;
    }

    logger.info(`Starting price monitor with interval ${this.intervalMs}ms`);

    // Run immediately on start
    this.monitorCycle().catch((error) => {
      logger.error('Error in initial monitor cycle:', error);
    });

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.monitorCycle().catch((error) => {
        logger.error('Error in monitor cycle:', error);
      });
    }, this.intervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Price monitor stopped');
    }
  }
}

// Main execution
if (require.main === module) {
  (async () => {
    try {
      const monitor = new DexPriceMonitorService();
      await monitor.initialize();
      monitor.start();

      // Graceful shutdown
      process.on('SIGINT', () => {
        logger.info('Received SIGINT, shutting down gracefully...');
        monitor.stop();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        logger.info('Received SIGTERM, shutting down gracefully...');
        monitor.stop();
        process.exit(0);
      });
    } catch (error) {
      logger.error('Failed to start price monitor:', error);
      process.exit(1);
    }
  })();
}

// Export for use in other services
export { DexPriceMonitorService };


/**
 * Trade Engine Service
 * Main entry point for trade engine
 */

import dotenv from 'dotenv';
import { TradeService } from './services/trade.service';
import { testConnection } from './config/database';
import { logger } from './config/logger';
import { BSC_ADDRESSES } from '../shared/libs/pancakeswap';

dotenv.config();

class TradeEngineService {
  private tradeService: TradeService | null = null;

  constructor() {
  }

  /**
   * Initialize services
   */
  async initialize(): Promise<void> {
    logger.info('Initializing trade engine service...');

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    logger.info('Database connection established');

    // Initialize PancakeSwap helper
    const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/';
    const mnemonic = process.env.WALLET_MNEMONIC;
    const privateKey = process.env.WALLET_PRIVATE_KEY; // Fallback untuk backward compatibility
    const accountIndex = parseInt(process.env.WALLET_ACCOUNT_INDEX || '0', 10);

    // Prioritize mnemonic over private key
    const walletKey = mnemonic || privateKey;

    if (!walletKey) {
      throw new Error('WALLET_MNEMONIC or WALLET_PRIVATE_KEY environment variable is required');
    }

    this.tradeService = new TradeService(rpcUrl, walletKey, BSC_ADDRESSES.BUSD, accountIndex);
    logger.info('Trade engine initialized successfully');
  }

  /**
   * Get trade service instance
   */
  getTradeService(): TradeService {
    if (!this.tradeService) {
      throw new Error('Trade service not initialized. Call initialize() first.');
    }
    return this.tradeService;
  }
}

// Export singleton instance
let tradeEngine: TradeEngineService | null = null;

export async function getTradeEngine(): Promise<TradeEngineService> {
  if (!tradeEngine) {
    tradeEngine = new TradeEngineService();
    await tradeEngine.initialize();
  }
  return tradeEngine;
}

// If running directly, initialize and keep alive
if (require.main === module) {
  (async () => {
    try {
      await getTradeEngine();
      logger.info('Trade engine service is running (standalone mode)');
      
      // Keep process alive
      process.on('SIGINT', () => {
        logger.info('Received SIGINT, shutting down gracefully...');
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        logger.info('Received SIGTERM, shutting down gracefully...');
        process.exit(0);
      });
    } catch (error) {
      logger.error('Failed to initialize trade engine:', error);
      process.exit(1);
    }
  })();
}


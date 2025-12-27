import { pool } from '../config/database';
import { NormalizedCoin } from '../types';
import { logger } from '../config/logger';

/**
 * Database storage service for coins
 */
export class StorageService {
  /**
   * Store coin to database
   * Returns coin ID if successful, null if already exists
   */
  async storeCoin(coin: NormalizedCoin): Promise<number | null> {
    try {
      // Check if coin already exists
      const existing = await pool.query(
        `SELECT id FROM coins WHERE address = $1 AND chain_id = $2`,
        [coin.address, coin.chainId]
      );

      if (existing.rows.length > 0) {
        logger.debug(`Coin ${coin.address} already exists in database`);
        return existing.rows[0].id;
      }

      // Insert new coin
      const result = await pool.query(
        `INSERT INTO coins (
          address, chain_id, name, symbol, 
          total_supply, liquidity, source, 
          discovered_at, raw_data, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id`,
        [
          coin.address,
          coin.chainId,
          coin.name,
          coin.symbol,
          null, // total_supply - not available from DexScreener
          coin.liquidityUsd?.toString() || null,
          coin.source,
          new Date(coin.pairCreatedAt),
          JSON.stringify(coin.rawData),
        ]
      );

      const coinId = result.rows[0].id;
      logger.info(`Stored new coin ${coin.address} with ID: ${coinId}`);

      return coinId;
    } catch (error) {
      logger.error(`Error storing coin ${coin.address}:`, error);
      throw error;
    }
  }

  /**
   * Batch store coins
   */
  async storeCoins(coins: NormalizedCoin[]): Promise<number[]> {
    const coinIds: number[] = [];

    for (const coin of coins) {
      try {
        const id = await this.storeCoin(coin);
        if (id) {
          coinIds.push(id);
        }
      } catch (error) {
        logger.error(`Error storing coin in batch:`, error);
        // Continue with other coins
      }
    }

    return coinIds;
  }
}


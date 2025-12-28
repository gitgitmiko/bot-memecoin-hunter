/**
 * Price Monitor Service
 * Monitors token prices from DexScreener and updates positions
 */

import axios from 'axios';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import { PositionStatus } from '../../shared/types/position.types';
import { calculateProfitFloor, shouldSell } from '../utils/profit-floor';

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

export interface PriceUpdateResult {
  positionId: number;
  tokenAddress: string;
  currentPrice: number;
  highestPrice: number;
  profitFloor: number | null;
  shouldSell: boolean;
}

export class PriceMonitorService {
  /**
   * Get token price from DexScreener
   */
  async getTokenPrice(
    tokenAddress: string,
    _chainId: number = 56
  ): Promise<number | null> {
    try {
      const response = await axios.get(`${DEXSCREENER_API}/${tokenAddress}`, {
        timeout: 10000,
      });

      if (!response.data?.pairs || response.data.pairs.length === 0) {
        return null;
      }

      // Find pair on BSC
      const bscPair = response.data.pairs.find(
        (pair: any) => pair.chainId === 'bsc' || pair.chainId === '56'
      );

      if (!bscPair?.priceUsd) {
        return null;
      }

      return parseFloat(bscPair.priceUsd);
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        logger.warn(`Timeout fetching price for ${tokenAddress}`);
      } else {
        logger.error(`Error fetching price for ${tokenAddress}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Update price for a single position
   */
  async updatePositionPrice(positionId: number): Promise<PriceUpdateResult | null> {
    try {
      // Get position from database
      const result = await pool.query(
        `SELECT * FROM positions WHERE id = $1 AND status = $2`,
        [positionId, PositionStatus.OPEN]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const position = result.rows[0];
      const tokenAddress = position.token_address;
      const chainId = position.chain_id;

      // Get current price
      const currentPrice = await this.getTokenPrice(tokenAddress, chainId);
      if (!currentPrice) {
        logger.warn(`Cannot get price for position ${positionId}`);
        return null;
      }

      // Update highest price if current is higher
      let highestPrice = parseFloat(position.highest_price_ever);
      if (currentPrice > highestPrice) {
        highestPrice = currentPrice;
      }

      // Calculate profit floor
      const profitFloor = calculateProfitFloor(highestPrice);

      // Update database
      await pool.query(
        `UPDATE positions 
        SET current_price_usd = $1, 
            highest_price_ever = $2, 
            profit_floor = $3,
            updated_at = NOW()
        WHERE id = $4`,
        [currentPrice, highestPrice, profitFloor, positionId]
      );

      // Check if should sell
      const shouldSellFlag = shouldSell(currentPrice, highestPrice);

      logger.debug(
        `Position ${positionId}: Price $${currentPrice}, Highest $${highestPrice}, Floor ${profitFloor}, Sell: ${shouldSellFlag}`
      );

      return {
        positionId,
        tokenAddress,
        currentPrice,
        highestPrice,
        profitFloor,
        shouldSell: shouldSellFlag,
      };
    } catch (error) {
      logger.error(`Error updating price for position ${positionId}:`, error);
      return null;
    }
  }

  /**
   * Update prices for all open positions
   */
  async updateAllPositions(chainId?: number): Promise<PriceUpdateResult[]> {
    try {
      // Get all open positions
      let query = `SELECT id FROM positions WHERE status = $1`;
      const params: any[] = [PositionStatus.OPEN];

      if (chainId !== undefined) {
        query += ` AND chain_id = $2`;
        params.push(chainId);
      }

      const result = await pool.query(query, params);
      const positionIds = result.rows.map((row: any) => row.id);

      logger.info(`Updating prices for ${positionIds.length} positions`);

      // Update each position (with some concurrency control)
      const results: PriceUpdateResult[] = [];
      const batchSize = 5; // Process 5 at a time to avoid rate limits

      for (let i = 0; i < positionIds.length; i += batchSize) {
        const batch = positionIds.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map((id: number) => this.updatePositionPrice(id))
        );
        results.push(...batchResults.filter((r): r is PriceUpdateResult => r !== null));

        // Small delay between batches
        if (i + batchSize < positionIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      const sellCandidates = results.filter((r) => r.shouldSell);
      if (sellCandidates.length > 0) {
        logger.info(
          `${sellCandidates.length} positions meet sell conditions: ${sellCandidates.map((r) => r.positionId).join(', ')}`
        );
      }

      return results;
    } catch (error) {
      logger.error('Error updating all positions:', error);
      return [];
    }
  }

  /**
   * Get positions that need to be checked for selling
   */
  async getPositionsToCheckSell(): Promise<number[]> {
    try {
      // Get positions that:
      // 1. Are OPEN
      // 2. Have profit_floor (highest_price >= $50)
      // 3. Current price might be <= profit floor
      const result = await pool.query(
        `SELECT id FROM positions 
        WHERE status = $1 
        AND profit_floor IS NOT NULL
        ORDER BY updated_at ASC`,
        [PositionStatus.OPEN]
      );

      return result.rows.map((row: any) => row.id);
    } catch (error) {
      logger.error('Error getting positions to check sell:', error);
      return [];
    }
  }
}


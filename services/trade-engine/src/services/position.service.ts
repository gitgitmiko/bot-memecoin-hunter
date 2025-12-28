/**
 * Position Service
 * Handles database operations for positions
 */

import { pool } from '../config/database';
import { logger } from '../config/logger';
import {
  Position,
  PositionStatus,
  CreatePositionParams,
  UpdatePositionParams,
} from '../../shared/types/position.types';

export class PositionService {
  /**
   * Create a new position
   */
  async createPosition(params: CreatePositionParams): Promise<number> {
    try {
      const result = await pool.query(
        `INSERT INTO positions (
          token_address, symbol, chain_id, buy_price_usd,
          current_price_usd, highest_price_ever, amount_token,
          amount_usd_invested, status, buy_tx_hash, coin_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          params.tokenAddress,
          params.symbol || null,
          params.chainId,
          params.buyPriceUsd,
          params.buyPriceUsd, // current_price_usd = buy_price_usd initially
          params.buyPriceUsd, // highest_price_ever = buy_price_usd initially
          params.amountToken,
          params.amountUsdInvested,
          PositionStatus.OPEN,
          params.buyTxHash,
          params.coinId || null,
        ]
      );

      const positionId = result.rows[0].id;
      logger.info(`Created position ${positionId} for token ${params.tokenAddress}`);
      return positionId;
    } catch (error: any) {
      logger.error(`Error creating position for ${params.tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get position by token address and status
   */
  async getPositionByToken(
    tokenAddress: string,
    chainId: number,
    status: PositionStatus = PositionStatus.OPEN
  ): Promise<Position | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM positions 
        WHERE token_address = $1 AND chain_id = $2 AND status = $3
        ORDER BY created_at DESC
        LIMIT 1`,
        [tokenAddress, chainId, status]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToPosition(result.rows[0]);
    } catch (error) {
      logger.error(
        `Error getting position for ${tokenAddress}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all open positions
   */
  async getOpenPositions(chainId?: number): Promise<Position[]> {
    try {
      let query = `SELECT * FROM positions WHERE status = $1 ORDER BY created_at DESC`;
      const params: any[] = [PositionStatus.OPEN];

      if (chainId !== undefined) {
        query += ` AND chain_id = $2`;
        params.push(chainId);
      }

      const result = await pool.query(query, params);
      return result.rows.map((row) => this.mapRowToPosition(row));
    } catch (error) {
      logger.error('Error getting open positions:', error);
      throw error;
    }
  }

  /**
   * Get position by ID
   */
  async getPositionById(id: number): Promise<Position | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM positions WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToPosition(result.rows[0]);
    } catch (error) {
      logger.error(`Error getting position ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update position
   */
  async updatePosition(
    id: number,
    params: UpdatePositionParams
  ): Promise<void> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (params.currentPriceUsd !== undefined) {
        updates.push(`current_price_usd = $${paramIndex++}`);
        values.push(params.currentPriceUsd);
      }

      if (params.highestPriceEver !== undefined) {
        updates.push(`highest_price_ever = $${paramIndex++}`);
        values.push(params.highestPriceEver);
      }

      if (params.profitFloor !== undefined) {
        updates.push(`profit_floor = $${paramIndex++}`);
        values.push(params.profitFloor);
      }

      if (params.sellTxHash !== undefined) {
        updates.push(`sell_tx_hash = $${paramIndex++}`);
        values.push(params.sellTxHash);
      }

      if (params.pnl !== undefined) {
        updates.push(`pnl = $${paramIndex++}`);
        values.push(params.pnl);
      }

      if (params.pnlPercentage !== undefined) {
        updates.push(`pnl_percentage = $${paramIndex++}`);
        values.push(params.pnlPercentage);
      }

      if (params.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(params.status);
        if (params.status === PositionStatus.CLOSED) {
          updates.push(`closed_at = NOW()`);
        }
      }

      if (updates.length === 0) {
        return;
      }

      values.push(id);
      const query = `UPDATE positions SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

      await pool.query(query, values);
      logger.info(`Updated position ${id}`);
    } catch (error) {
      logger.error(`Error updating position ${id}:`, error);
      throw error;
    }
  }

  /**
   * Check if position exists for token
   */
  async hasOpenPosition(
    tokenAddress: string,
    chainId: number
  ): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM positions 
        WHERE token_address = $1 AND chain_id = $2 AND status = $3`,
        [tokenAddress, chainId, PositionStatus.OPEN]
      );

      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      logger.error(
        `Error checking position existence for ${tokenAddress}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all positions (open and closed)
   */
  async getAllPositions(limit: number = 100): Promise<Position[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM positions ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
      return result.rows.map((row) => this.mapRowToPosition(row));
    } catch (error) {
      logger.error('Error getting all positions:', error);
      throw error;
    }
  }

  /**
   * Map database row to Position object
   */
  private mapRowToPosition(row: any): Position {
    return {
      id: row.id,
      tokenAddress: row.token_address,
      symbol: row.symbol,
      chainId: row.chain_id,
      buyPriceUsd: parseFloat(row.buy_price_usd),
      currentPriceUsd: row.current_price_usd
        ? parseFloat(row.current_price_usd)
        : undefined,
      highestPriceEver: parseFloat(row.highest_price_ever),
      profitFloor: row.profit_floor ? parseFloat(row.profit_floor) : undefined,
      amountToken: row.amount_token.toString(),
      amountUsdInvested: parseFloat(row.amount_usd_invested),
      status: row.status as PositionStatus,
      buyTxHash: row.buy_tx_hash || undefined,
      sellTxHash: row.sell_tx_hash || undefined,
      pnl: row.pnl ? parseFloat(row.pnl) : undefined,
      pnlPercentage: row.pnl_percentage
        ? parseFloat(row.pnl_percentage)
        : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at || undefined,
      coinId: row.coin_id || undefined,
    };
  }
}


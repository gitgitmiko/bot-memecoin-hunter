/**
 * Position Service for Telegram Bot
 * Copy of PositionService from trade-engine (can be shared later)
 */

import { pool } from '../config/database';
import { logger } from '../config/logger';

// Types definition (local to avoid build dependencies)
export enum PositionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export interface Position {
  id?: number;
  tokenAddress: string;
  symbol?: string;
  chainId: number;
  buyPriceUsd: number;
  currentPriceUsd?: number;
  highestPriceEver: number;
  profitFloor?: number;
  amountToken: string;
  amountUsdInvested: number;
  status: PositionStatus;
  buyTxHash?: string;
  sellTxHash?: string;
  pnl?: number;
  pnlPercentage?: number;
  createdAt?: Date;
  updatedAt?: Date;
  closedAt?: Date;
  coinId?: number;
}

export interface CreatePositionParams {
  tokenAddress: string;
  symbol?: string;
  chainId: number;
  buyPriceUsd: number;
  amountToken: string;
  amountUsdInvested: number;
  buyTxHash: string;
  coinId?: number;
}

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
          params.buyPriceUsd,
          params.buyPriceUsd,
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
      logger.error(`Error getting position for ${tokenAddress}:`, error);
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
      logger.error(`Error checking position existence for ${tokenAddress}:`, error);
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

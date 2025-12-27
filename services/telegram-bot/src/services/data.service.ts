import { pool } from '../config/database';
import { logger } from '../config/logger';

export interface CoinStats {
  totalCoins: number;
  totalAnalyses: number;
  highScoreCoins: number; // coins with overall_score > 70
  latestCoinDate: Date | null;
  latestAnalysisDate: Date | null;
}

export interface CoinInfo {
  id: number;
  address: string;
  symbol: string | null;
  name: string | null;
  chainId: number;
  liquidity: number | null;
  createdAt: Date;
  overallScore: number | null;
  priceScore: number | null;
  volumeScore: number | null;
  socialScore: number | null;
  riskScore: number | null;
}

/**
 * Service for querying database data
 */
export class DataService {
  /**
   * Get database statistics
   */
  async getStats(): Promise<CoinStats> {
    try {
      // Get total coins
      const coinsResult = await pool.query('SELECT COUNT(*) as count, MAX(created_at) as latest FROM coins');
      const totalCoins = parseInt(coinsResult.rows[0].count || '0');
      const latestCoinDate = coinsResult.rows[0].latest || null;

      // Get total analyses
      const analysesResult = await pool.query('SELECT COUNT(*) as count, MAX(created_at) as latest FROM analyses');
      const totalAnalyses = parseInt(analysesResult.rows[0].count || '0');
      const latestAnalysisDate = analysesResult.rows[0].latest || null;

      // Get high score coins (overall_score > 70)
      const highScoreResult = await pool.query(
        'SELECT COUNT(DISTINCT coin_id) as count FROM analyses WHERE overall_score > 70'
      );
      const highScoreCoins = parseInt(highScoreResult.rows[0].count || '0');

      return {
        totalCoins,
        totalAnalyses,
        highScoreCoins,
        latestCoinDate,
        latestAnalysisDate,
      };
    } catch (error) {
      logger.error('Error getting stats:', error);
      throw error;
    }
  }

  /**
   * Get recent coins
   */
  async getRecentCoins(limit: number = 10): Promise<CoinInfo[]> {
    try {
      const result = await pool.query(
        `SELECT 
          c.id,
          c.address,
          c.symbol,
          c.name,
          c.chain_id,
          c.liquidity,
          c.created_at,
          a.overall_score,
          a.price_score,
          a.volume_score,
          a.social_score,
          a.risk_score
        FROM coins c
        LEFT JOIN analyses a ON c.id = a.coin_id
        ORDER BY c.created_at DESC
        LIMIT $1`,
        [limit]
      );

      return result.rows.map((row) => ({
        id: row.id,
        address: row.address,
        symbol: row.symbol,
        name: row.name,
        chainId: row.chain_id,
        liquidity: row.liquidity ? parseFloat(row.liquidity) : null,
        createdAt: row.created_at,
        overallScore: row.overall_score,
        priceScore: row.price_score,
        volumeScore: row.volume_score,
        socialScore: row.social_score,
        riskScore: row.risk_score,
      }));
    } catch (error) {
      logger.error('Error getting recent coins:', error);
      throw error;
    }
  }

  /**
   * Get coin by address
   */
  async getCoinByAddress(address: string): Promise<CoinInfo | null> {
    try {
      const result = await pool.query(
        `SELECT 
          c.id,
          c.address,
          c.symbol,
          c.name,
          c.chain_id,
          c.liquidity,
          c.created_at,
          a.overall_score,
          a.price_score,
          a.volume_score,
          a.social_score,
          a.risk_score
        FROM coins c
        LEFT JOIN analyses a ON c.id = a.coin_id
        WHERE LOWER(c.address) = LOWER($1)
        ORDER BY a.created_at DESC
        LIMIT 1`,
        [address]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        address: row.address,
        symbol: row.symbol,
        name: row.name,
        chainId: row.chain_id,
        liquidity: row.liquidity ? parseFloat(row.liquidity) : null,
        createdAt: row.created_at,
        overallScore: row.overall_score,
        priceScore: row.price_score,
        volumeScore: row.volume_score,
        socialScore: row.social_score,
        riskScore: row.risk_score,
      };
    } catch (error) {
      logger.error('Error getting coin by address:', error);
      throw error;
    }
  }

  /**
   * Get high score coins (overall_score > 70)
   */
  async getHighScoreCoins(limit: number = 10): Promise<CoinInfo[]> {
    try {
      const result = await pool.query(
        `SELECT 
          c.id,
          c.address,
          c.symbol,
          c.name,
          c.chain_id,
          c.liquidity,
          c.created_at,
          a.overall_score,
          a.price_score,
          a.volume_score,
          a.social_score,
          a.risk_score
        FROM coins c
        INNER JOIN analyses a ON c.id = a.coin_id
        WHERE a.overall_score > 70
        ORDER BY a.overall_score DESC, a.created_at DESC
        LIMIT $1`,
        [limit]
      );

      return result.rows.map((row) => ({
        id: row.id,
        address: row.address,
        symbol: row.symbol,
        name: row.name,
        chainId: row.chain_id,
        liquidity: row.liquidity ? parseFloat(row.liquidity) : null,
        createdAt: row.created_at,
        overallScore: row.overall_score,
        priceScore: row.price_score,
        volumeScore: row.volume_score,
        socialScore: row.social_score,
        riskScore: row.risk_score,
      }));
    } catch (error) {
      logger.error('Error getting high score coins:', error);
      throw error;
    }
  }

  /**
   * Get new coins (ordered by discovered_at DESC)
   */
  async getNewCoins(limit: number = 10): Promise<CoinInfo[]> {
    try {
      const result = await pool.query(
        `SELECT 
          c.id,
          c.address,
          c.symbol,
          c.name,
          c.chain_id,
          c.liquidity,
          c.discovered_at,
          c.created_at,
          a.overall_score,
          a.price_score,
          a.volume_score,
          a.social_score,
          a.risk_score
        FROM coins c
        LEFT JOIN LATERAL (
          SELECT 
            overall_score,
            price_score,
            volume_score,
            social_score,
            risk_score
          FROM analyses
          WHERE coin_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
        ) a ON true
        ORDER BY COALESCE(c.discovered_at, c.created_at) DESC
        LIMIT $1`,
        [limit]
      );

      return result.rows.map((row) => ({
        id: row.id,
        address: row.address,
        symbol: row.symbol,
        name: row.name,
        chainId: row.chain_id,
        liquidity: row.liquidity ? parseFloat(row.liquidity) : null,
        createdAt: row.discovered_at || row.created_at,
        overallScore: row.overall_score,
        priceScore: row.price_score,
        volumeScore: row.volume_score,
        socialScore: row.social_score,
        riskScore: row.risk_score,
      }));
    } catch (error) {
      logger.error('Error getting new coins:', error);
      throw error;
    }
  }

  /**
   * Get chain name from chain ID
   */
  getChainName(chainId: number): string {
    const chainMap: Record<number, string> = {
      1: 'Ethereum',
      56: 'BSC',
      137: 'Polygon',
      43114: 'Avalanche',
      250: 'Fantom',
      42161: 'Arbitrum',
      10: 'Optimism',
      8453: 'Base',
      999: 'Solana',
    };
    return chainMap[chainId] || `Chain ${chainId}`;
  }
}


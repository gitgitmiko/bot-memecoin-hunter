import { pool } from '../config/database';
import { AnalysisResult } from '../types';
import { logger } from '../config/logger';

/**
 * Storage service for analysis results
 */
export class StorageService {
  /**
   * Store analysis result to database
   */
  async storeAnalysis(analysis: AnalysisResult): Promise<number> {
    try {
      const result = await pool.query(
        `INSERT INTO analyses (
          coin_id, analyzed_at, price_score, volume_score,
          social_score, risk_score, overall_score,
          metrics, recommendations, created_at
        ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id`,
        [
          analysis.coinId,
          Math.round(analysis.priceScore), // Ensure integer
          Math.round(analysis.volumeScore), // Ensure integer
          Math.round(analysis.socialScore), // Ensure integer
          Math.round(analysis.riskScore), // Ensure integer
          Math.round(analysis.overallScore), // Ensure integer
          JSON.stringify(analysis.metrics),
          analysis.recommendations,
        ]
      );

      const analysisId = result.rows[0].id;
      logger.info(`Stored analysis for coin ${analysis.coinAddress}, ID: ${analysisId}`);

      return analysisId;
    } catch (error) {
      logger.error(`Error storing analysis for ${analysis.coinAddress}:`, error);
      throw error;
    }
  }
}


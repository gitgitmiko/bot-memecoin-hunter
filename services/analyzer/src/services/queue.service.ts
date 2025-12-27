import { getRedisClient } from '../config/redis';
import { AnalysisResult } from '../types';
import { logger } from '../config/logger';
import { REDIS_QUEUES, SCORE_THRESHOLDS } from '../utils/constants';

/**
 * Queue service for publishing high-score coins
 */
export class QueueService {
  /**
   * Publish high-score coin to Redis queue
   */
  async publishHighScoreCoin(analysis: AnalysisResult): Promise<void> {
    try {
      // Only publish if score meets threshold
      if (analysis.overallScore < SCORE_THRESHOLDS.HIGH_SCORE_THRESHOLD) {
        logger.debug(
          `Coin ${analysis.coinAddress} score ${analysis.overallScore} below threshold, skipping`
        );
        return;
      }

      const message = {
        event: 'analyzer:high-score-coin',
        timestamp: new Date().toISOString(),
        data: {
          coinAddress: analysis.coinAddress,
          score: analysis.overallScore,
          analysis: {
            priceScore: analysis.priceScore,
            volumeScore: analysis.volumeScore,
            socialScore: analysis.socialScore,
            riskScore: analysis.riskScore,
          },
          recommendations: analysis.recommendations,
        },
      };

      const client = getRedisClient();
      if (!client.isOpen) {
        await client.connect();
      }

      await client.publish(REDIS_QUEUES.ANALYZER_HIGH_SCORE, JSON.stringify(message));
      logger.info(`Published high-score coin to queue: ${analysis.coinAddress} (score: ${analysis.overallScore})`);
    } catch (error) {
      logger.error(`Error publishing high-score coin ${analysis.coinAddress}:`, error);
      throw error;
    }
  }
}


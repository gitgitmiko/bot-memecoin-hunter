/**
 * Constants for analyzer service
 */

export const REDIS_QUEUES = {
  CRAWLER_NEW_COIN: 'crawler:new-coin',
  ANALYZER_HIGH_SCORE: 'analyzer:high-score-coin',
} as const;

export const SCORE_THRESHOLDS = {
  MIN_SCORE: 0,
  MAX_SCORE: 100,
  HIGH_SCORE_THRESHOLD: 70,
} as const;


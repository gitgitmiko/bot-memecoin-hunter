/**
 * Constants for crawler service
 * (Local copy to avoid TypeScript rootDir issues)
 */

export const REDIS_QUEUES = {
  CRAWLER_NEW_COIN: 'crawler:new-coin',
  ANALYZER_HIGH_SCORE: 'analyzer:high-score-coin',
} as const;


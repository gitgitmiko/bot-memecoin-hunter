/**
 * Shared constants
 */

export const CHAIN_IDS = {
  ETHEREUM: 1,
  BSC: 56,
  POLYGON: 137,
  ARBITRUM: 42161,
  BASE: 8453,
  OPTIMISM: 10,
} as const;

export const REDIS_QUEUES = {
  CRAWLER_NEW_COIN: 'crawler:new-coin',
  ANALYZER_HIGH_SCORE: 'analyzer:high-score-coin',
} as const;

export const SCORE_THRESHOLDS = {
  MIN_SCORE: 0,
  MAX_SCORE: 100,
  HIGH_SCORE_THRESHOLD: 70,
} as const;

export const CRAWLER_SOURCES = {
  DEX: 'dex',
  DEXSCREENER: 'dexscreener',
  TWITTER: 'twitter',
  TELEGRAM: 'telegram',
} as const;

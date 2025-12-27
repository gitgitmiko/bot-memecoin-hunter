"use strict";
/**
 * Shared constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRAWLER_SOURCES = exports.SCORE_THRESHOLDS = exports.REDIS_QUEUES = exports.CHAIN_IDS = void 0;
exports.CHAIN_IDS = {
    ETHEREUM: 1,
    BSC: 56,
    POLYGON: 137,
    ARBITRUM: 42161,
    BASE: 8453,
    OPTIMISM: 10,
};
exports.REDIS_QUEUES = {
    CRAWLER_NEW_COIN: 'crawler:new-coin',
    ANALYZER_HIGH_SCORE: 'analyzer:high-score-coin',
};
exports.SCORE_THRESHOLDS = {
    MIN_SCORE: 0,
    MAX_SCORE: 100,
    HIGH_SCORE_THRESHOLD: 70,
};
exports.CRAWLER_SOURCES = {
    DEX: 'dex',
    DEXSCREENER: 'dexscreener',
    TWITTER: 'twitter',
    TELEGRAM: 'telegram',
};
//# sourceMappingURL=constants.js.map
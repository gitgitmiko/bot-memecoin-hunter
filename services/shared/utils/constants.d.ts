/**
 * Shared constants
 */
export declare const CHAIN_IDS: {
    readonly ETHEREUM: 1;
    readonly BSC: 56;
    readonly POLYGON: 137;
    readonly ARBITRUM: 42161;
    readonly BASE: 8453;
    readonly OPTIMISM: 10;
};
export declare const REDIS_QUEUES: {
    readonly CRAWLER_NEW_COIN: "crawler:new-coin";
    readonly ANALYZER_HIGH_SCORE: "analyzer:high-score-coin";
};
export declare const SCORE_THRESHOLDS: {
    readonly MIN_SCORE: 0;
    readonly MAX_SCORE: 100;
    readonly HIGH_SCORE_THRESHOLD: 70;
};
export declare const CRAWLER_SOURCES: {
    readonly DEX: "dex";
    readonly DEXSCREENER: "dexscreener";
    readonly TWITTER: "twitter";
    readonly TELEGRAM: "telegram";
};
//# sourceMappingURL=constants.d.ts.map
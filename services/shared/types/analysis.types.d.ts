/**
 * Shared types for analysis-related data
 */
export interface Analysis {
    id?: number;
    coinId: number;
    analyzedAt?: Date;
    priceScore?: number;
    volumeScore?: number;
    socialScore?: number;
    riskScore?: number;
    overallScore?: number;
    metrics?: Record<string, any>;
    recommendations?: string[];
    createdAt?: Date;
}
export interface AnalysisResult {
    coinAddress: string;
    score: number;
    analysis: {
        priceScore: number;
        volumeScore: number;
        socialScore: number;
        riskScore: number;
    };
    recommendations: string[];
}
export interface HighScoreCoinEvent {
    event: 'analyzer:high-score-coin';
    timestamp: string;
    data: AnalysisResult;
}
//# sourceMappingURL=analysis.types.d.ts.map
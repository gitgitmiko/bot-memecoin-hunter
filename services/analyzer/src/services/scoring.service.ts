import { AnalysisResult, RiskCheckResult } from '../types';

/**
 * Scoring service
 * Calculates scores based on various factors
 */
export class ScoringService {
  /**
   * Calculate overall score from analysis data
   */
  calculateScore(
    priceScore: number,
    volumeScore: number,
    socialScore: number,
    riskScore: number
  ): number {
    // Weighted scoring system
    const weights = {
      price: 0.2,
      volume: 0.3,
      social: 0.2,
      risk: 0.3, // Risk is inverted (higher risk = lower score)
    };

    const overallScore =
      priceScore * weights.price +
      volumeScore * weights.volume +
      socialScore * weights.social +
      riskScore * weights.risk;

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(overallScore)));
  }

  /**
   * Calculate price score (0-100)
   * Based on price stability and trend
   */
  calculatePriceScore(
    priceChange24h?: number,
    volatility?: number
  ): number {
    let score = 50; // Base score

    // Positive price change is good
    if (priceChange24h && priceChange24h > 0) {
      score += Math.min(30, priceChange24h * 2);
    } else if (priceChange24h && priceChange24h < 0) {
      score -= Math.min(30, Math.abs(priceChange24h) * 2);
    }

    // Low volatility is better (more stable)
    if (volatility !== undefined && volatility < 50) {
      score += 10;
    } else if (volatility !== undefined && volatility > 100) {
      score -= 20;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate volume score (0-100)
   * Based on 24h volume
   */
  calculateVolumeScore(volume24h?: number): number {
    if (!volume24h) {
      return 0;
    }

    // Scoring based on volume tiers
    if (volume24h >= 1000000) {
      return 100; // $1M+ volume
    } else if (volume24h >= 500000) {
      return 90; // $500k+ volume
    } else if (volume24h >= 100000) {
      return 75; // $100k+ volume
    } else if (volume24h >= 50000) {
      return 60; // $50k+ volume
    } else if (volume24h >= 10000) {
      return 40; // $10k+ volume
    } else if (volume24h >= 5000) {
      return 20; // $5k+ volume
    }

    return 10; // Less than $5k
  }

  /**
   * Calculate social score (0-100)
   * Based on social media presence (placeholder)
   */
  calculateSocialScore(
    transactions24h?: { buys: number; sells: number }
  ): number {
    if (!transactions24h) {
      return 50; // Neutral score
    }

    const totalTransactions = transactions24h.buys + transactions24h.sells;
    const buyRatio = transactions24h.buys / (totalTransactions || 1);

    // Higher buy ratio = better score
    let score = 50 + (buyRatio - 0.5) * 50;

    // More transactions = slightly better
    if (totalTransactions > 100) {
      score += 10;
    } else if (totalTransactions > 50) {
      score += 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Calculate risk score (0-100)
   * Higher score = lower risk
   */
  calculateRiskScore(riskCheck: RiskCheckResult): number {
    let score = 100; // Start with perfect score

    // Deduct points for each risk factor
    if (riskCheck.isHoneypot) {
      score -= 100; // Honeypot = instant fail
    }

    if (riskCheck.hasMintAuthority) {
      score -= 30; // Mint authority = major risk
    }

    if (!riskCheck.liquidityLocked) {
      score -= 20; // No liquidity lock = risk
    }

    // Deduct based on risk level
    switch (riskCheck.riskLevel) {
      case 'high':
        score -= 40;
        break;
      case 'medium':
        score -= 20;
        break;
      case 'low':
        // No deduction
        break;
    }

    // Each additional risk reason reduces score
    score -= riskCheck.riskReasons.length * 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(analysis: AnalysisResult): string[] {
    const recommendations: string[] = [];

    if (analysis.volumeScore >= 75) {
      recommendations.push('high-volume');
    }

    if (analysis.priceScore >= 70) {
      recommendations.push('trending');
    }

    if (analysis.riskScore >= 80) {
      recommendations.push('low-risk');
    } else if (analysis.riskScore < 50) {
      recommendations.push('high-risk');
    }

    if (analysis.metrics.liquidityUsd && analysis.metrics.liquidityUsd >= 100000) {
      recommendations.push('good-liquidity');
    }

    if (analysis.metrics.liquidityLocked) {
      recommendations.push('liquidity-locked');
    }

    if (!analysis.metrics.hasMintAuthority) {
      recommendations.push('no-mint');
    }

    return recommendations;
  }
}


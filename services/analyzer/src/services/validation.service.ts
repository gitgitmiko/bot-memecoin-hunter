import { ValidationResult } from '../types';

/**
 * Validation service for coin data
 * Validates liquidity, volume, holder count, etc.
 */
export class ValidationService {
  // Minimum thresholds
  private readonly MIN_LIQUIDITY_USD = 10000; // $10k minimum liquidity
  private readonly MIN_VOLUME_24H = 5000; // $5k minimum 24h volume
  private readonly MIN_HOLDERS = 10; // Minimum holder count

  /**
   * Validate coin data
   */
  validate(coinData: {
    liquidityUsd?: number;
    volume24h?: number;
    holderCount?: number;
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate liquidity
    if (!coinData.liquidityUsd || coinData.liquidityUsd < this.MIN_LIQUIDITY_USD) {
      errors.push(`Liquidity too low: $${coinData.liquidityUsd || 0} (min: $${this.MIN_LIQUIDITY_USD})`);
    }

    // Validate volume
    if (!coinData.volume24h || coinData.volume24h < this.MIN_VOLUME_24H) {
      warnings.push(`Volume low: $${coinData.volume24h || 0} (min: $${this.MIN_VOLUME_24H})`);
    }

    // Validate holders (if available)
    if (coinData.holderCount !== undefined && coinData.holderCount < this.MIN_HOLDERS) {
      warnings.push(`Holder count low: ${coinData.holderCount} (min: ${this.MIN_HOLDERS})`);
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
    };
  }
}


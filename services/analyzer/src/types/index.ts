/**
 * Type definitions for analyzer service
 */

/**
 * Normalized coin data structure
 * This should match the structure stored in the database
 */
export interface NormalizedCoin {
  address: string;
  symbol?: string;
  name?: string;
  chainId: number;
  decimals?: number;
  price?: number;
  priceChange24h?: number;
  volume24h?: number;
  liquidity?: string;
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: number;
  pairAddress?: string;
  token0?: {
    address: string;
    symbol?: string;
    name?: string;
  };
  token1?: {
    address: string;
    symbol?: string;
    name?: string;
  };
  raw_data?: Record<string, any>;
  transactions24h?: { buys: number; sells: number };
}

export interface AnalysisResult {
  coinId: number;
  coinAddress: string;
  priceScore: number;
  volumeScore: number;
  socialScore: number;
  riskScore: number;
  overallScore: number;
  metrics: {
    liquidityUsd?: number;
    volume24h?: number;
    holderCount?: number;
    isHoneypot?: boolean;
    hasMintAuthority?: boolean;
    liquidityLocked?: boolean;
    riskLevel?: 'low' | 'medium' | 'high';
    riskReasons?: string[];
  };
  recommendations: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RiskCheckResult {
  isHoneypot: boolean;
  hasMintAuthority: boolean;
  liquidityLocked: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  riskReasons: string[];
}

export interface CrawlerJobData {
  coinAddress: string;
  chainId: number;
  source: string;
  normalizedData: NormalizedCoin;
}


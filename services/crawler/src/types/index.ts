/**
 * Type definitions for crawler service
 */

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  pairCreatedAt?: number;
}

export interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[] | null;
}

export interface NormalizedCoin {
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  priceUsd?: number;
  liquidityUsd?: number;
  volume24h?: number;
  priceChange24h?: number;
  transactions24h: {
    buys: number;
    sells: number;
  };
  pairAddress: string;
  pairCreatedAt: number;
  source: 'dexscreener';
  rawData: DexScreenerPair;
}

export interface CrawlerJob {
  event: 'crawler:new-coin';
  timestamp: string;
  data: {
    coinAddress: string;
    chainId: number;
    source: 'dexscreener';
    normalizedData: NormalizedCoin;
  };
}

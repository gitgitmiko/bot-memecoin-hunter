/**
 * Shared types for coin-related data
 */

export interface Coin {
  id?: number;
  address: string;
  chainId: number;
  name?: string;
  symbol?: string;
  decimals?: number;
  totalSupply?: string;
  liquidity?: string;
  source: 'dex' | 'twitter' | 'telegram';
  discoveredAt?: Date;
  rawData?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CoinDiscoveryEvent {
  event: 'crawler:new-coin';
  timestamp: string;
  data: {
    coinAddress: string;
    chainId: number;
    source: 'dex' | 'twitter' | 'telegram';
    rawData: Record<string, any>;
  };
}


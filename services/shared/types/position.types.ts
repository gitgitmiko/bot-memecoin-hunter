/**
 * Position types for trading positions
 */

export enum PositionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export interface Position {
  id?: number;
  tokenAddress: string;
  symbol?: string;
  chainId: number;
  buyPriceUsd: number;
  currentPriceUsd?: number;
  highestPriceEver: number;
  profitFloor?: number;
  amountToken: string; // Use string for high precision
  amountUsdInvested: number;
  status: PositionStatus;
  buyTxHash?: string;
  sellTxHash?: string;
  pnl?: number;
  pnlPercentage?: number;
  createdAt?: Date;
  updatedAt?: Date;
  closedAt?: Date;
  coinId?: number;
}

export interface CreatePositionParams {
  tokenAddress: string;
  symbol?: string;
  chainId: number;
  buyPriceUsd: number;
  amountToken: string;
  amountUsdInvested: number;
  buyTxHash: string;
  coinId?: number;
}

export interface UpdatePositionParams {
  currentPriceUsd?: number;
  highestPriceEver?: number;
  profitFloor?: number;
  sellTxHash?: string;
  pnl?: number;
  pnlPercentage?: number;
  status?: PositionStatus;
}

export interface TradeParams {
  tokenAddress: string;
  amountUsd: number;
  slippage?: number; // Default 5-10%
  chainId?: number; // Default BSC (56)
}


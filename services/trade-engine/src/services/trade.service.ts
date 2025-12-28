/**
 * Trade Service
 * Handles BUY and SELL operations via PancakeSwap
 */

import { PancakeSwapHelper, BSC_ADDRESSES } from '../../shared/libs/pancakeswap';
import { PositionService } from './position.service';
import { PositionStatus } from '../../shared/types/position.types';
import { logger } from '../config/logger';
import { calculateProfitFloor, shouldSell } from '../utils/profit-floor';
import axios from 'axios';

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

export interface BuyParams {
  tokenAddress: string;
  amountUsd: number;
  slippage?: number;
  chainId?: number;
  symbol?: string;
  coinId?: number;
}

export interface SellParams {
  positionId: number;
  slippage?: number;
}

export class TradeService {
  private pancakeswap: PancakeSwapHelper;
  private positionService: PositionService;

  constructor(
    rpcUrl: string,
    mnemonicOrPrivateKey: string,
    _stablecoinAddress: string = BSC_ADDRESSES.BUSD,
    accountIndex: number = 0
  ) {
    this.pancakeswap = new PancakeSwapHelper(rpcUrl, mnemonicOrPrivateKey, BSC_ADDRESSES.ROUTER_V2, accountIndex);
    this.positionService = new PositionService();
  }

  /**
   * Get token price from DexScreener
   */
  private async getTokenPrice(
    tokenAddress: string,
    _chainId: number = 56
  ): Promise<number | null> {
    try {
      const response = await axios.get(`${DEXSCREENER_API}/${tokenAddress}`);
      
      if (!response.data?.pairs || response.data.pairs.length === 0) {
        logger.warn(`No price data found for token ${tokenAddress}`);
        return null;
      }

      // Find pair on BSC
      const bscPair = response.data.pairs.find(
        (pair: any) => pair.chainId === 'bsc' || pair.chainId === '56'
      );

      if (!bscPair?.priceUsd) {
        logger.warn(`No BSC price found for token ${tokenAddress}`);
        return null;
      }

      return parseFloat(bscPair.priceUsd);
    } catch (error) {
      logger.error(`Error fetching price for ${tokenAddress}:`, error);
      return null;
    }
  }

  /**
   * BUY Logic
   * - Buy $10 per coin
   * - Once per coin only
   */
  async buy(params: BuyParams): Promise<{ positionId: number; txHash: string }> {
    const {
      tokenAddress,
      amountUsd = 10,
      slippage = 5,
      chainId = 56,
      symbol,
      coinId,
    } = params;

    try {
      // Check if position already exists
      const hasPosition = await this.positionService.hasOpenPosition(
        tokenAddress,
        chainId
      );

      if (hasPosition) {
        throw new Error(
          `Position already exists for token ${tokenAddress}. Only one position per token allowed.`
        );
      }

      // Get current price before buy
      const currentPrice = await this.getTokenPrice(tokenAddress, chainId);
      if (!currentPrice) {
        throw new Error(`Cannot get price for token ${tokenAddress}`);
      }

      logger.info(
        `Buying $${amountUsd} of token ${tokenAddress} at price $${currentPrice}`
      );

      // Execute swap via PancakeSwap
      const swapResult = await this.pancakeswap.swapExactTokensForTokens(
        tokenAddress,
        amountUsd,
        BSC_ADDRESSES.BUSD,
        slippage
      );

      // Create position record
      const positionId = await this.positionService.createPosition({
        tokenAddress,
        symbol,
        chainId,
        buyPriceUsd: currentPrice,
        amountToken: swapResult.tokenAmount,
        amountUsdInvested: amountUsd,
        buyTxHash: swapResult.txHash,
        coinId,
      });

      logger.info(
        `Buy successful. Position ID: ${positionId}, TX: ${swapResult.txHash}`
      );

      return {
        positionId,
        txHash: swapResult.txHash,
      };
    } catch (error: any) {
      logger.error(`Error buying token ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * SELL Logic
   * - Sell 100% of position
   * - Triggered by profit floor logic
   */
  async sell(params: SellParams): Promise<{ txHash: string; pnl: number }> {
    const { positionId, slippage = 5 } = params;

    try {
      // Get position
      const position = await this.positionService.getPositionById(positionId);
      if (!position) {
        throw new Error(`Position ${positionId} not found`);
      }

      if (position.status === PositionStatus.CLOSED) {
        throw new Error(`Position ${positionId} is already closed`);
      }

      logger.info(`Selling position ${positionId} for token ${position.tokenAddress}`);

      // Execute swap (sell token for BUSD)
      const swapResult = await this.pancakeswap.swapExactTokensForETH(
        position.tokenAddress,
        position.amountToken,
        BSC_ADDRESSES.BUSD,
        slippage
      );

      // Calculate PnL
      const sellPriceUsd = parseFloat(swapResult.amountOut);
      const pnl = sellPriceUsd - position.amountUsdInvested;
      const pnlPercentage = ((sellPriceUsd - position.amountUsdInvested) / position.amountUsdInvested) * 100;

      // Update position
      await this.positionService.updatePosition(positionId, {
        status: PositionStatus.CLOSED,
        sellTxHash: swapResult.txHash,
        pnl,
        pnlPercentage,
      });

      logger.info(
        `Sell successful. Position ID: ${positionId}, TX: ${swapResult.txHash}, PnL: $${pnl.toFixed(2)} (${pnlPercentage.toFixed(2)}%)`
      );

      return {
        txHash: swapResult.txHash,
        pnl,
      };
    } catch (error: any) {
      logger.error(`Error selling position ${positionId}:`, error);
      throw error;
    }
  }

  /**
   * Check and execute sell if profit floor condition is met
   */
  async checkAndSellIfNeeded(positionId: number): Promise<boolean> {
    try {
      const position = await this.positionService.getPositionById(positionId);
      if (!position || position.status === PositionStatus.CLOSED) {
        return false;
      }

      // Get current price
      const currentPrice = await this.getTokenPrice(position.tokenAddress, position.chainId);
      if (!currentPrice) {
        logger.warn(`Cannot get price for position ${positionId}, skipping sell check`);
        return false;
      }

      // Update current price and highest price
      let highestPrice = position.highestPriceEver;
      if (currentPrice > highestPrice) {
        highestPrice = currentPrice;
      }

      // Update position with new prices
      const profitFloor = calculateProfitFloor(highestPrice);
      await this.positionService.updatePosition(positionId, {
        currentPriceUsd: currentPrice,
        highestPriceEver: highestPrice,
        profitFloor: profitFloor || undefined,
      });

      // Check if should sell
      if (shouldSell(currentPrice, highestPrice)) {
        logger.info(
          `Profit floor condition met for position ${positionId}. Current: $${currentPrice}, Floor: $${profitFloor}, Highest: $${highestPrice}. Executing sell...`
        );
        await this.sell({ positionId });
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error(`Error checking sell condition for position ${positionId}:`, error);
      return false;
    }
  }

  /**
   * Get wallet balance (BUSD)
   */
  async getBalance(): Promise<{ busd: string; bnb: string }> {
    try {
      const busdBalance = await this.pancakeswap.getTokenBalance(BSC_ADDRESSES.BUSD);
      const bnbBalance = await this.pancakeswap.getBNBBalance();
      return {
        busd: busdBalance,
        bnb: bnbBalance,
      };
    } catch (error) {
      logger.error('Error getting wallet balance:', error);
      throw error;
    }
  }
}


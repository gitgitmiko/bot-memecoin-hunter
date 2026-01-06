/**
 * Trade Service
 * Handles BUY and SELL operations via PancakeSwap (BSC) and Jupiter (Solana)
 */

import { PancakeSwapHelper, BSC_ADDRESSES } from '../../shared/libs/pancakeswap';
import { SolanaJupiterHelper } from '../../shared/libs/solana-jupiter';
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
  private solanaHelper: SolanaJupiterHelper | null = null;
  private positionService: PositionService;
  private walletKey: string;
  private accountIndex: number;

  constructor(
    rpcUrl: string,
    mnemonicOrPrivateKey: string,
    _stablecoinAddress: string = BSC_ADDRESSES.BUSD,
    accountIndex: number = 0
  ) {
    this.walletKey = mnemonicOrPrivateKey;
    this.accountIndex = accountIndex;
    this.pancakeswap = new PancakeSwapHelper(rpcUrl, mnemonicOrPrivateKey, BSC_ADDRESSES.ROUTER_V2, accountIndex);
    this.positionService = new PositionService();
  }

  /**
   * Initialize Solana helper if needed
   */
  private async getSolanaHelper(): Promise<SolanaJupiterHelper> {
    if (!this.solanaHelper) {
      const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      this.solanaHelper = new SolanaJupiterHelper(solanaRpcUrl, this.walletKey, this.accountIndex);
    }
    return this.solanaHelper;
  }

  /**
   * Get token price from DexScreener (supports BSC and Solana)
   */
  private async getTokenPrice(
    tokenAddress: string,
    chainId: number = 56
  ): Promise<number | null> {
    try {
      const response = await axios.get(`${DEXSCREENER_API}/${tokenAddress}`);
      
      if (!response.data?.pairs || response.data.pairs.length === 0) {
        logger.warn(`No price data found for token ${tokenAddress}`);
        return null;
      }

      let pair: any = null;

      if (chainId === 999) {
        // Solana
        pair = response.data.pairs.find(
          (p: any) => p.chainId === 'solana'
        );
      } else {
        // BSC (default)
        pair = response.data.pairs.find(
          (p: any) => p.chainId === 'bsc' || p.chainId === '56'
        );
      }

      if (!pair?.priceUsd) {
        logger.warn(`No price found for token ${tokenAddress} on chain ${chainId}`);
        return null;
      }

      return parseFloat(pair.priceUsd);
    } catch (error) {
      logger.error(`Error fetching price for ${tokenAddress}:`, error);
      return null;
    }
  }

  /**
   * BUY Logic
   * - Buy token (supports BSC and Solana)
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
        `Buying $${amountUsd} of token ${tokenAddress} on chain ${chainId} at price $${currentPrice}`
      );

      let swapResult: any;

      // Handle different chains
      if (chainId === 999) {
        // Solana
        const solanaHelper = await this.getSolanaHelper();
        
        // Get SOL price in USD to convert USD amount to SOL
        let solPriceUSD = 0;
        try {
          const axios = (await import('axios')).default;
          const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
            timeout: 5000,
          });
          if (response.data?.solana?.usd) {
            solPriceUSD = response.data.solana.usd;
          }
        } catch (error: any) {
          logger.warn(`Failed to fetch SOL price from CoinGecko: ${error.message}. Using fallback price 100 USD`);
          solPriceUSD = 100; // Fallback approximate SOL price
        }

        // Convert USD amount to SOL amount
        const amountSOL = amountUsd / solPriceUSD;
        logger.info(`Converting $${amountUsd} to ${amountSOL.toFixed(8)} SOL (SOL price: $${solPriceUSD})`);

        // Execute swap via Jupiter using SOL
        swapResult = await solanaHelper.swapSOLForToken(
          tokenAddress,
          amountSOL,
          slippage
        );
      } else {
        // BSC (default)
        // Get BNB price in USD to convert USD amount to BNB
        let bnbPriceUSD = 0;
        try {
          const axios = (await import('axios')).default;
          const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd', {
            timeout: 5000,
          });
          if (response.data?.binancecoin?.usd) {
            bnbPriceUSD = response.data.binancecoin.usd;
          }
        } catch (error: any) {
          logger.warn(`Failed to fetch BNB price from CoinGecko: ${error.message}. Using fallback price 300 USD`);
          bnbPriceUSD = 300; // Fallback approximate BNB price
        }

        // Convert USD amount to BNB amount
        const amountBNB = amountUsd / bnbPriceUSD;
        logger.info(`Converting $${amountUsd} to ${amountBNB.toFixed(8)} BNB (BNB price: $${bnbPriceUSD})`);

        // Check BNB balance and swap BUSD to BNB if needed
        const currentBNBBalance = parseFloat(await this.pancakeswap.getBNBBalance());
        const requiredBNB = amountBNB + 0.01; // Add 0.01 BNB buffer for gas fees
        
        if (currentBNBBalance < requiredBNB) {
          logger.info(`BNB balance (${currentBNBBalance.toFixed(8)}) is insufficient. Required: ${requiredBNB.toFixed(8)}. Checking BUSD balance...`);
          
          // Check BUSD balance
          const busdBalance = parseFloat(await this.pancakeswap.getBUSDBalance());
          const neededBNB = requiredBNB - currentBNBBalance;
          const neededBUSD = neededBNB * bnbPriceUSD;
          
          if (busdBalance >= neededBUSD) {
            logger.info(`Swapping ${neededBUSD.toFixed(2)} BUSD to BNB...`);
            const swapResult = await this.pancakeswap.swapBUSDToBNB(neededBUSD, slippage);
            logger.info(`BUSD to BNB swap successful: ${swapResult.txHash}. New BNB balance should be sufficient.`);
          } else {
            throw new Error(
              `Insufficient balance. Need ${requiredBNB.toFixed(8)} BNB but only have ${currentBNBBalance.toFixed(8)} BNB. ` +
              `Also need ${neededBUSD.toFixed(2)} BUSD but only have ${busdBalance.toFixed(2)} BUSD. ` +
              `Please add more BNB or BUSD to your wallet.`
            );
          }
        }

        // Execute swap via PancakeSwap using BNB
        swapResult = await this.pancakeswap.swapExactBNBForTokens(
          tokenAddress,
          amountBNB,
          slippage
        );
      }

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

      logger.info(`Selling position ${positionId} for token ${position.tokenAddress} on chain ${position.chainId}`);

      let swapResult: any;
      let sellPriceUsd: number;

      // Handle different chains
      if (position.chainId === 999) {
        // Solana - sell token for SOL
        const solanaHelper = await this.getSolanaHelper();
        
        // Get SOL price to calculate USD value
        let solPriceUSD = 0;
        try {
          const axios = (await import('axios')).default;
          const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
            timeout: 5000,
          });
          if (response.data?.solana?.usd) {
            solPriceUSD = response.data.solana.usd;
          }
        } catch (error: any) {
          logger.warn(`Failed to fetch SOL price: ${error.message}. Using fallback price 100 USD`);
          solPriceUSD = 100;
        }

        // Execute swap via Jupiter (Token -> SOL)
        swapResult = await solanaHelper.swapTokenForSOL(
          position.tokenAddress,
          position.amountToken,
          slippage
        );

        // Calculate USD value from SOL received
        sellPriceUsd = parseFloat(swapResult.amountOut) * solPriceUSD;
      } else {
        // BSC - sell token for BUSD
        swapResult = await this.pancakeswap.swapExactTokensForETH(
          position.tokenAddress,
          position.amountToken,
          BSC_ADDRESSES.BUSD,
          slippage
        );

        // Calculate PnL (BUSD amount is already in USD)
        sellPriceUsd = parseFloat(swapResult.amountOut);
      }

      // Calculate PnL
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

      // Get invested amount for profit floor calculation
      const investAmount = position.amountUsdInvested || 10;

      // Update position with new prices
      const profitFloor = calculateProfitFloor(highestPrice, investAmount);
      await this.positionService.updatePosition(positionId, {
        currentPriceUsd: currentPrice,
        highestPriceEver: highestPrice,
        profitFloor: profitFloor || undefined,
      });

      // Check if should sell
      if (shouldSell(currentPrice, highestPrice, investAmount)) {
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


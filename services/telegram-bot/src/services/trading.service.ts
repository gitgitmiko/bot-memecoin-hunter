/**
 * Trading Service for Telegram Bot
 * Handles trading operations (buy/sell) via TradeService
 */

import { PositionService, PositionStatus } from './position.service';
import { logger } from '../config/logger';
import { PancakeSwapHelper, BSC_ADDRESSES } from '../../shared/libs/pancakeswap';

// Dynamic import for TradeService (load at runtime, not compile time)
let TradeServiceClass: any = null;

function loadTradeService() {
  if (TradeServiceClass) return;
  
  try {
    const tradeModule = require('../../../trade-engine/src/services/trade.service');
    TradeServiceClass = tradeModule.TradeService;
  } catch (error: any) {
    logger.warn('TradeService not available:', error.message);
  }
}

export class TradingService {
  private positionService: PositionService;
  private pancakeswap: PancakeSwapHelper | null = null;
  private tradeService: any = null; // Use any to avoid type errors at compile time

  constructor() {
    this.positionService = new PositionService();
  }

  /**
   * Initialize trading service
   */
  async initialize(): Promise<void> {
    logger.info('Trading service initialized');
    
    // Initialize PancakeSwap helper for balance checks
    try {
      const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
      const mnemonicOrPrivateKey = process.env.WALLET_MNEMONIC || process.env.WALLET_PRIVATE_KEY;
      const accountIndex = parseInt(process.env.WALLET_ACCOUNT_INDEX || '0');
      
      if (mnemonicOrPrivateKey) {
        this.pancakeswap = new PancakeSwapHelper(
          rpcUrl,
          mnemonicOrPrivateKey,
          BSC_ADDRESSES.ROUTER_V2,
          accountIndex
        );
        logger.info('PancakeSwap helper initialized');
        
        // Try to load TradeService dynamically at runtime
        loadTradeService();
        
        // Initialize TradeService for buy/sell operations
        if (TradeServiceClass) {
          this.tradeService = new TradeServiceClass(
            rpcUrl,
            mnemonicOrPrivateKey,
            BSC_ADDRESSES.BUSD,
            accountIndex
          );
          logger.info('TradeService initialized for buy/sell operations');
        } else {
          logger.warn('TradeService not available. Buy/sell operations will be disabled.');
        }
      } else {
        logger.warn('Wallet credentials not found. Trading operations will not be available.');
      }
    } catch (error: any) {
      logger.warn(`Failed to initialize trading services: ${error.message}`);
    }
  }

  /**
   * Get all positions
   */
  async getPositions(status?: PositionStatus) {
    if (status) {
      if (status === PositionStatus.OPEN) {
        return await this.positionService.getOpenPositions();
      }
    }
    return await this.positionService.getAllPositions(100);
  }

  /**
   * Get position by token address
   */
  async getPositionByToken(tokenAddress: string, chainId: number = 56) {
    return await this.positionService.getPositionByToken(tokenAddress, chainId);
  }

  /**
   * Find token address by symbol (from database)
   */
  async findTokenAddressBySymbol(symbol: string, chainId: number = 56): Promise<string | null> {
    try {
      const { pool } = await import('../config/database');
      const result = await pool.query(
        `SELECT address FROM coins 
         WHERE UPPER(symbol) = UPPER($1) 
         AND chain_id = $2 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [symbol, chainId]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0].address;
      }
      
      return null;
    } catch (error: any) {
      logger.error(`Error finding token address for symbol ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Buy token
   */
  async buy(tokenAddress: string, amountUsd: number = 10, slippage: number = 5) {
    // Try to load TradeService if not already loaded
    if (!this.tradeService) {
      loadTradeService();
      
      try {
        if (TradeServiceClass) {
          const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
          const mnemonicOrPrivateKey = process.env.WALLET_MNEMONIC || process.env.WALLET_PRIVATE_KEY;
          const accountIndex = parseInt(process.env.WALLET_ACCOUNT_INDEX || '0');
          if (mnemonicOrPrivateKey) {
            this.tradeService = new TradeServiceClass(
              rpcUrl,
              mnemonicOrPrivateKey,
              BSC_ADDRESSES.BUSD,
              accountIndex
            );
          }
        }
      } catch (error: any) {
        throw new Error(`TradeService not available: ${error.message}`);
      }
    }
    
    if (!this.tradeService) {
      throw new Error('TradeService not initialized. Wallet credentials may be missing.');
    }
    
    try {
      const result = await this.tradeService.buy({
        tokenAddress,
        amountUsd,
        slippage,
        chainId: 56, // BSC
      });
      
      return result;
    } catch (error: any) {
      logger.error(`Error buying token ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Sell position by token address
   */
  async sellByToken(tokenAddress: string, slippage: number = 5) {
    // Try to load TradeService if not already loaded
    if (!this.tradeService) {
      loadTradeService();
      
      try {
        if (TradeServiceClass) {
          const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
          const mnemonicOrPrivateKey = process.env.WALLET_MNEMONIC || process.env.WALLET_PRIVATE_KEY;
          const accountIndex = parseInt(process.env.WALLET_ACCOUNT_INDEX || '0');
          if (mnemonicOrPrivateKey) {
            this.tradeService = new TradeServiceClass(
              rpcUrl,
              mnemonicOrPrivateKey,
              BSC_ADDRESSES.BUSD,
              accountIndex
            );
          }
        }
      } catch (error: any) {
        throw new Error(`TradeService not available: ${error.message}`);
      }
    }
    
    if (!this.tradeService) {
      throw new Error('TradeService not initialized. Wallet credentials may be missing.');
    }
    
    try {
      // Find position by token address
      const position = await this.positionService.getPositionByToken(tokenAddress, 56);
      if (!position) {
        throw new Error(`No open position found for token ${tokenAddress}`);
      }
      
      if (position.status === PositionStatus.CLOSED) {
        throw new Error(`Position for token ${tokenAddress} is already closed`);
      }
      
      const result = await this.tradeService.sell({
        positionId: position.id,
        slippage,
      });
      
      return result;
    } catch (error: any) {
      logger.error(`Error selling position for token ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Sell position by position ID
   */
  async sell(positionId: number, slippage: number = 5) {
    if (!this.tradeService) {
      throw new Error('TradeService not initialized. Wallet credentials may be missing.');
    }
    
    try {
      const result = await this.tradeService.sell({
        positionId,
        slippage,
      });
      
      return result;
    } catch (error: any) {
      logger.error(`Error selling position ${positionId}:`, error);
      throw error;
    }
  }

  /**
   * Get balance (BUSD and BNB)
   */
  async getBalance(): Promise<{ busd: string; bnb: string }> {
    if (!this.pancakeswap) {
      throw new Error('PancakeSwap helper not initialized. Wallet credentials may be missing.');
    }
    
    try {
      const busdBalance = await this.pancakeswap.getTokenBalance(BSC_ADDRESSES.BUSD);
      const bnbBalance = await this.pancakeswap.getBNBBalance();
      return {
        busd: busdBalance,
        bnb: bnbBalance,
      };
    } catch (error: any) {
      logger.error('Error getting wallet balance:', error);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  /**
   * Detect chain type from address format
   */
  private detectChain(address: string): 'bsc' | 'solana' | 'unknown' {
    // BSC/Ethereum: 0x followed by 40 hex characters
    if (address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return 'bsc';
    }
    
    // Solana: Base58 encoded, typically 32-44 characters, alphanumeric
    // Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
    if (address.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
      return 'solana';
    }
    
    return 'unknown';
  }

  /**
   * Check if token exists on DEX (PancakeSwap for BSC, or Raydium/Jupiter for Solana)
   */
  async checkTokenOnPancakeSwap(tokenAddress: string): Promise<{
    exists: boolean;
    chain?: 'bsc' | 'solana';
    name?: string;
    symbol?: string;
    price?: number;
    priceChange24h?: number;
    liquidity?: number;
    volume24h?: number;
    pairs?: Array<{
      chainId: string;
      dexId: string;
      pairAddress: string;
      baseToken: { address: string; symbol: string; name: string };
      quoteToken: { address: string; symbol: string };
      priceUsd: string;
      liquidity: { usd: number };
      volume: { h24: number };
      priceChange: { h24: number };
    }>;
  }> {
    try {
      const axios = require('axios');
      const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';
      
      // Detect chain
      const chain = this.detectChain(tokenAddress);
      if (chain === 'unknown') {
        throw new Error('Invalid token address format. Supported: BSC (0x...) or Solana (base58)');
      }

      const response = await axios.get(`${DEXSCREENER_API}/${tokenAddress}`, {
        timeout: 10000,
      });

      if (!response.data?.pairs || response.data.pairs.length === 0) {
        return { exists: false, chain };
      }

      let filteredPairs: any[] = [];
      
      if (chain === 'bsc') {
        // Find pairs on BSC/PancakeSwap
        filteredPairs = response.data.pairs.filter(
          (pair: any) => 
            (pair.chainId === 'bsc' || pair.chainId === '56') &&
            (pair.dexId === 'pancakeswap' || pair.dexId === 'pancakeswap-v2')
        );
      } else if (chain === 'solana') {
        // Find pairs on Solana (Raydium, Jupiter, Orca, etc.)
        filteredPairs = response.data.pairs.filter(
          (pair: any) => 
            pair.chainId === 'solana'
        );
      }

      if (filteredPairs.length === 0) {
        // Token exists but not on the specified DEX
        return { exists: false, chain };
      }

      // Get the pair with highest liquidity
      const bestPair = filteredPairs.reduce((prev: any, current: any) => {
        const prevLiquidity = prev.liquidity?.usd || 0;
        const currentLiquidity = current.liquidity?.usd || 0;
        return currentLiquidity > prevLiquidity ? current : prev;
      });

      return {
        exists: true,
        chain,
        name: bestPair.baseToken?.name || 'Unknown',
        symbol: bestPair.baseToken?.symbol || 'Unknown',
        price: bestPair.priceUsd ? parseFloat(bestPair.priceUsd) : undefined,
        priceChange24h: bestPair.priceChange?.h24 || undefined,
        liquidity: bestPair.liquidity?.usd || undefined,
        volume24h: bestPair.volume?.h24 || undefined,
        pairs: filteredPairs.map((pair: any) => ({
          chainId: pair.chainId,
          dexId: pair.dexId,
          pairAddress: pair.pairAddress,
          baseToken: pair.baseToken,
          quoteToken: pair.quoteToken,
          priceUsd: pair.priceUsd,
          liquidity: pair.liquidity,
          volume: pair.volume,
          priceChange: pair.priceChange,
        })),
      };
    } catch (error: any) {
      logger.error(`Error checking token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get 24h timeframe statistics for a token
   */
  async get24hTimeframe(tokenAddress: string): Promise<{
    exists: boolean;
    chain?: 'bsc' | 'solana';
    name?: string;
    symbol?: string;
    currentPrice?: number;
    price24h?: number;
    priceChange24h?: number;
    priceChange24hPercentage?: number;
    high24h?: number;
    low24h?: number;
    volume24h?: number;
    volume6h?: number;
    volume1h?: number;
    liquidity?: number;
    marketCap?: number;
    fdv?: number;
    txns24h?: {
      buys: number;
      sells: number;
      total: number;
    };
    priceChange?: {
      m5?: number;
      h1?: number;
      h6?: number;
      h24?: number;
    };
    pairs?: Array<{
      dexId: string;
      pairAddress: string;
      priceUsd: string;
      priceChange: { h24: number };
      volume: { h24: number; h6: number; h1: number };
      txns: { h24: { buys: number; sells: number } };
      liquidity: { usd: number };
    }>;
  }> {
    try {
      const axios = require('axios');
      const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';
      
      // Detect chain
      const chain = this.detectChain(tokenAddress);
      if (chain === 'unknown') {
        throw new Error('Invalid token address format. Supported: BSC (0x...) or Solana (base58)');
      }

      const response = await axios.get(`${DEXSCREENER_API}/${tokenAddress}`, {
        timeout: 10000,
      });

      if (!response.data?.pairs || response.data.pairs.length === 0) {
        return { exists: false, chain };
      }

      let filteredPairs: any[] = [];
      
      if (chain === 'bsc') {
        filteredPairs = response.data.pairs.filter(
          (pair: any) => 
            (pair.chainId === 'bsc' || pair.chainId === '56') &&
            (pair.dexId === 'pancakeswap' || pair.dexId === 'pancakeswap-v2')
        );
      } else if (chain === 'solana') {
        filteredPairs = response.data.pairs.filter(
          (pair: any) => pair.chainId === 'solana'
        );
      }

      if (filteredPairs.length === 0) {
        return { exists: false, chain };
      }

      // Get the pair with highest liquidity
      const bestPair = filteredPairs.reduce((prev: any, current: any) => {
        const prevLiquidity = prev.liquidity?.usd || 0;
        const currentLiquidity = current.liquidity?.usd || 0;
        return currentLiquidity > prevLiquidity ? current : prev;
      });

      // Calculate aggregate stats across all pairs
      const currentPrice = bestPair.priceUsd ? parseFloat(bestPair.priceUsd) : undefined;
      const priceChange24h = bestPair.priceChange?.h24 || 0;
      const priceChange24hPercentage = priceChange24h;
      
      // Aggregate volume
      const totalVolume24h = filteredPairs.reduce((sum, pair) => sum + (pair.volume?.h24 || 0), 0);
      const totalVolume6h = filteredPairs.reduce((sum, pair) => sum + (pair.volume?.h6 || 0), 0);
      const totalVolume1h = filteredPairs.reduce((sum, pair) => sum + (pair.volume?.h1 || 0), 0);
      
      // Aggregate transactions
      const totalTxns24h = filteredPairs.reduce((sum, pair) => {
        const buys = pair.txns?.h24?.buys || 0;
        const sells = pair.txns?.h24?.sells || 0;
        return sum + buys + sells;
      }, 0);
      const totalBuys24h = filteredPairs.reduce((sum, pair) => sum + (pair.txns?.h24?.buys || 0), 0);
      const totalSells24h = filteredPairs.reduce((sum, pair) => sum + (pair.txns?.h24?.sells || 0), 0);

      // Calculate high/low from price change (approximate)
      // If price increased, low = current / (1 + change%), high = current
      // If price decreased, high = current / (1 + change%), low = current
      let high24h: number | undefined = currentPrice;
      let low24h: number | undefined = currentPrice;
      
      if (currentPrice && priceChange24hPercentage !== undefined) {
        if (priceChange24hPercentage > 0) {
          // Price went up: current is high, calculate low from 24h ago
          low24h = currentPrice / (1 + priceChange24hPercentage / 100);
        } else if (priceChange24hPercentage < 0) {
          // Price went down: current is low, calculate high from 24h ago
          high24h = currentPrice / (1 + priceChange24hPercentage / 100);
        }
      }

      return {
        exists: true,
        chain,
        name: bestPair.baseToken?.name || 'Unknown',
        symbol: bestPair.baseToken?.symbol || 'Unknown',
        currentPrice,
        priceChange24h: priceChange24hPercentage,
        priceChange24hPercentage,
        high24h,
        low24h,
        volume24h: totalVolume24h,
        volume6h: totalVolume6h,
        volume1h: totalVolume1h,
        liquidity: bestPair.liquidity?.usd || undefined,
        marketCap: bestPair.marketCap || undefined,
        fdv: bestPair.fdv || undefined,
        txns24h: {
          buys: totalBuys24h,
          sells: totalSells24h,
          total: totalTxns24h,
        },
        priceChange: bestPair.priceChange,
        pairs: filteredPairs.map((pair: any) => ({
          dexId: pair.dexId,
          pairAddress: pair.pairAddress,
          priceUsd: pair.priceUsd,
          priceChange: pair.priceChange,
          volume: pair.volume,
          txns: pair.txns,
          liquidity: pair.liquidity,
        })),
      };
    } catch (error: any) {
      logger.error(`Error getting 24h timeframe: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get coin information from internet (website, social media, etc.)
   */
  async getCoinInfo(tokenAddress: string): Promise<{
    exists: boolean;
    chain?: 'bsc' | 'solana';
    name?: string;
    symbol?: string;
    address: string;
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    reddit?: string;
    description?: string;
    links?: {
      homepage?: string[];
      blockchain_site?: string[];
      official_forum_url?: string[];
      subreddit_url?: string;
      repos_url?: {
        github?: string[];
      };
    };
    community_data?: {
      twitter_followers?: number;
      telegram_channel_user_count?: number;
    };
    coingecko_id?: string;
  }> {
    try {
      const axios = require('axios');
      
      // Detect chain
      const chain = this.detectChain(tokenAddress);
      if (chain === 'unknown') {
        throw new Error('Invalid token address format. Supported: BSC (0x...) or Solana (base58)');
      }

      // First, get basic info from DexScreener
      const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';
      const dexscreenerResponse = await axios.get(`${DEXSCREENER_API}/${tokenAddress}`, {
        timeout: 10000,
      });

      if (!dexscreenerResponse.data?.pairs || dexscreenerResponse.data.pairs.length === 0) {
        return { exists: false, chain, address: tokenAddress };
      }

      let filteredPairs: any[] = [];
      
      if (chain === 'bsc') {
        filteredPairs = dexscreenerResponse.data.pairs.filter(
          (pair: any) => 
            (pair.chainId === 'bsc' || pair.chainId === '56') &&
            (pair.dexId === 'pancakeswap' || pair.dexId === 'pancakeswap-v2')
        );
      } else if (chain === 'solana') {
        filteredPairs = dexscreenerResponse.data.pairs.filter(
          (pair: any) => pair.chainId === 'solana'
        );
      }

      if (filteredPairs.length === 0) {
        return { exists: false, chain, address: tokenAddress };
      }

      const bestPair = filteredPairs.reduce((prev: any, current: any) => {
        const prevLiquidity = prev.liquidity?.usd || 0;
        const currentLiquidity = current.liquidity?.usd || 0;
        return currentLiquidity > prevLiquidity ? current : prev;
      });

      const name = bestPair.baseToken?.name || 'Unknown';
      const symbol = bestPair.baseToken?.symbol || 'Unknown';

      // Try to get detailed info from CoinGecko API - ONLY if contract address matches
      let coinInfo: any = null;
      let coingeckoId: string | undefined = undefined;

      try {
        // CoinGecko API - Search by contract address ONLY
        // We will NOT use symbol search as fallback because it can return wrong coin
        const coinGeckoChainId = chain === 'bsc' ? 'binance-smart-chain' : 'solana';
        const coingeckoUrl = `https://api.coingecko.com/api/v3/coins/${coinGeckoChainId}/contract/${tokenAddress.toLowerCase()}`;
        
        try {
          const coingeckoResponse = await axios.get(coingeckoUrl, {
            timeout: 10000,
            params: {
              localization: false,
              tickers: false,
              market_data: false,
              community_data: true,
              developer_data: false,
              sparkline: false,
            },
          });

          if (coingeckoResponse.data) {
            // Validate contract address matches
            const platforms = coingeckoResponse.data.platforms || {};
            const contractKey = chain === 'bsc' ? 'binance-smart-chain' : 'solana';
            const contractInResponse = platforms[contractKey];
            
            // Normalize addresses for comparison (lowercase, no leading zeros)
            const normalizedInput = tokenAddress.toLowerCase();
            const normalizedResponse = contractInResponse?.toLowerCase();
            
            if (normalizedResponse && normalizedInput === normalizedResponse) {
              // Contract address matches - use this data
              coinInfo = coingeckoResponse.data;
              coingeckoId = coinInfo.id;
              logger.info(`CoinGecko data found for ${tokenAddress} - contract validated`);
            } else {
              logger.warn(`CoinGecko contract mismatch for ${tokenAddress}. Expected: ${normalizedInput}, Got: ${normalizedResponse}`);
              // Don't use this data if contract doesn't match
              coinInfo = null;
            }
          }
        } catch (coingeckoError: any) {
          // CoinGecko might not have this token, that's okay
          if (coingeckoError.response?.status !== 404) {
            logger.warn(`CoinGecko API error for ${tokenAddress}: ${coingeckoError.message}`);
          } else {
            logger.info(`Coin not found in CoinGecko for contract ${tokenAddress}`);
          }
        }

        // NOTE: We intentionally do NOT use symbol search as fallback
        // because different coins can have the same symbol but different contracts
        // This prevents showing wrong information
      } catch (error: any) {
        logger.warn(`Error fetching CoinGecko data: ${error.message}`);
      }

      // Extract social links from CoinGecko data
      let website: string | undefined;
      let twitter: string | undefined;
      let telegram: string | undefined;
      let discord: string | undefined;
      let reddit: string | undefined;
      let description: string | undefined;

      if (coinInfo) {
        if (coinInfo.links?.homepage && coinInfo.links.homepage.length > 0) {
          website = coinInfo.links.homepage[0];
        }
        
        if (coinInfo.links?.twitter_screen_name) {
          twitter = `https://twitter.com/${coinInfo.links.twitter_screen_name}`;
        } else if (coinInfo.links?.twitter) {
          twitter = Array.isArray(coinInfo.links.twitter) 
            ? coinInfo.links.twitter[0] 
            : coinInfo.links.twitter;
        }
        
        if (coinInfo.links?.telegram_channel_identifier) {
          telegram = `https://t.me/${coinInfo.links.telegram_channel_identifier}`;
        } else if (coinInfo.links?.telegram) {
          telegram = Array.isArray(coinInfo.links.telegram) 
            ? coinInfo.links.telegram[0] 
            : coinInfo.links.telegram;
        }
        
        if (coinInfo.links?.discord) {
          discord = Array.isArray(coinInfo.links.discord) 
            ? coinInfo.links.discord[0] 
            : coinInfo.links.discord;
        }
        
        if (coinInfo.links?.subreddit_url) {
          reddit = coinInfo.links.subreddit_url;
        }
        
        if (coinInfo.description?.en) {
          description = coinInfo.description.en;
          if (description && description.length > 500) {
            description = description.substring(0, 500) + '...';
          }
        }
      }

      return {
        exists: true,
        chain,
        name,
        symbol,
        address: tokenAddress,
        website,
        twitter,
        telegram,
        discord,
        reddit,
        description,
        links: coinInfo?.links,
        community_data: coinInfo?.community_data,
        coingecko_id: coingeckoId,
      };
    } catch (error: any) {
      logger.error(`Error getting coin info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate total PnL
   */
  async getTotalPnL(): Promise<{ totalPnL: number; totalPnLPercentage: number; totalInvested: number; totalValue: number }> {
    const positions = await this.positionService.getAllPositions(1000);
    
    let totalInvested = 0;
    let totalValue = 0;
    let totalPnL = 0;

    for (const position of positions) {
      totalInvested += position.amountUsdInvested;
      
      if (position.status === PositionStatus.CLOSED && position.pnl !== undefined) {
        totalPnL += position.pnl;
        totalValue += position.amountUsdInvested + position.pnl;
      } else if (position.status === PositionStatus.OPEN && position.currentPriceUsd) {
        const currentValue = parseFloat(position.amountToken) * position.currentPriceUsd;
        totalValue += currentValue;
        totalPnL += currentValue - position.amountUsdInvested;
      } else {
        totalValue += position.amountUsdInvested; // Assume no change if no price
      }
    }

    const totalPnLPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    return {
      totalPnL,
      totalPnLPercentage,
      totalInvested,
      totalValue,
    };
  }
}


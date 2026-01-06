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
    // Try to load from compiled dist first (preferred)
    let tradeModule;
    const path = require('path');
    
    // Try multiple paths
    const possiblePaths = [
      '/app/trade-engine/dist/src/services/trade.service', // Absolute path
      path.join(process.cwd(), 'trade-engine', 'dist', 'src', 'services', 'trade.service'),
      path.join(__dirname, '../../../trade-engine/dist/src/services/trade.service'),
      '../../../trade-engine/dist/src/services/trade.service',
    ];
    
    let loaded = false;
    for (const tradePath of possiblePaths) {
      try {
        tradeModule = require(tradePath);
        logger.info(`✅ TradeService loaded from: ${tradePath}`);
        loaded = true;
        break;
      } catch (e) {
        // Try next path
        continue;
      }
    }
    
    if (!loaded) {
      logger.warn('TradeService dist not found, cannot load TradeService');
      throw new Error('TradeService compiled files not found. Please ensure trade-engine is built.');
    }
    
    TradeServiceClass = tradeModule.TradeService;
    if (TradeServiceClass) {
      logger.info('✅ TradeService class loaded successfully');
    } else {
      logger.warn('TradeService class not found in module');
    }
  } catch (error: any) {
    // Don't fail completely - TradeService might have optional dependencies
    // It will be loaded on-demand when buy/sell is called
    logger.warn('TradeService not available (will retry on-demand):', error.message);
    if (error.message.includes('@solana/web3.js')) {
      logger.info('Note: Solana dependencies missing, but TradeService can still work for BSC');
    }
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
    logger.info('Initializing trading service...');
    
    // Initialize PancakeSwap helper for balance checks
    try {
      const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
      const mnemonicOrPrivateKey = process.env.WALLET_MNEMONIC || process.env.WALLET_PRIVATE_KEY;
      const accountIndex = parseInt(process.env.WALLET_ACCOUNT_INDEX || '0');
      
      if (!mnemonicOrPrivateKey) {
        logger.warn('⚠️ Wallet credentials not found (WALLET_MNEMONIC or WALLET_PRIVATE_KEY). Trading operations will not be available.');
        return;
      }
      
      logger.info(`🔑 Wallet credentials found. Account index: ${accountIndex}`);
      
      // Initialize PancakeSwap helper
      this.pancakeswap = new PancakeSwapHelper(
        rpcUrl,
        mnemonicOrPrivateKey,
        BSC_ADDRESSES.ROUTER_V2,
        accountIndex
      );
      
      const walletAddress = this.pancakeswap.getWalletAddress();
      logger.info(`✅ PancakeSwap helper initialized. Wallet address: ${walletAddress}`);
      
      // Try to load TradeService dynamically at runtime
      loadTradeService();
      
      // Initialize TradeService for buy/sell operations
      if (TradeServiceClass) {
        try {
          this.tradeService = new TradeServiceClass(
            rpcUrl,
            mnemonicOrPrivateKey,
            BSC_ADDRESSES.BUSD,
            accountIndex
          );
          logger.info(`✅ TradeService initialized for buy/sell operations. Wallet address: ${walletAddress}`);
        } catch (error: any) {
          logger.error(`❌ Failed to initialize TradeService: ${error.message}`);
          logger.error(error);
        }
      } else {
        logger.warn('⚠️ TradeService class not available. Buy/sell operations will be disabled.');
      }
    } catch (error: any) {
      logger.error(`❌ Failed to initialize trading services: ${error.message}`);
      logger.error(error);
    }
  }

  /**
   * Get all positions
   */
  async getPositions(status?: PositionStatus) {
    if (status) {
      if (status === PositionStatus.OPEN) {
        // Always get fresh data from database (no caching)
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
   * Get token symbol from multiple sources
   * 1. From position.symbol (if exists)
   * 2. From coins table using coin_id (if exists)
   * 3. From DexScreener API using token address
   */
  async getTokenSymbol(
    tokenAddress: string,
    chainId: number,
    existingSymbol?: string,
    coinId?: number
  ): Promise<string | null> {
    // 1. Use existing symbol if available
    if (existingSymbol) {
      return existingSymbol;
    }

    // 2. Try to get from coins table using coin_id
    if (coinId) {
      try {
        const { pool } = await import('../config/database');
        const result = await pool.query(
          `SELECT symbol FROM coins WHERE id = $1`,
          [coinId]
        );
        
        if (result.rows.length > 0 && result.rows[0].symbol) {
          return result.rows[0].symbol;
        }
      } catch (error: any) {
        logger.warn(`Error getting symbol from coins table for coin_id ${coinId}:`, error);
      }
    }

    // 3. Try to get from coins table using token address
    try {
      const { pool } = await import('../config/database');
      const isSolana = chainId === 999;
      const address = isSolana ? tokenAddress : tokenAddress.toLowerCase();
      
      const result = await pool.query(
        `SELECT symbol FROM coins WHERE address = $1 AND chain_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [address, chainId]
      );
      
      if (result.rows.length > 0 && result.rows[0].symbol) {
        return result.rows[0].symbol;
      }
    } catch (error: any) {
      logger.warn(`Error getting symbol from coins table for address ${tokenAddress}:`, error);
    }

    // 4. Try to get from DexScreener API
    try {
      const tokenInfo = await this.checkTokenOnPancakeSwap(tokenAddress);
      if (tokenInfo.symbol && tokenInfo.symbol !== 'Unknown') {
        return tokenInfo.symbol;
      }
    } catch (error: any) {
      logger.warn(`Error getting symbol from DexScreener for ${tokenAddress}:`, error);
    }

    return null;
  }

  /**
   * Buy token (supports BSC and Solana)
   */
  async buy(tokenAddress: string, amountUsd: number = 10, slippage: number = 5) {
    // Detect chain from address
    const chain = this.detectChain(tokenAddress);
    let chainId = 56; // Default to BSC
    
    if (chain === 'solana') {
      chainId = 999;
    } else if (chain === 'bsc') {
      chainId = 56;
    } else {
      throw new Error('Invalid token address format. Supported: BSC (0x...) or Solana (base58)');
    }

    // Try to initialize if not already initialized
    if (!this.tradeService) {
      logger.warn('TradeService not initialized. Attempting to initialize...');
      await this.initialize();
    }
    
    // Try to load TradeService if still not loaded
    if (!this.tradeService) {
      loadTradeService();
      
      try {
        if (TradeServiceClass) {
          // TradeService constructor always uses BSC RPC URL for PancakeSwap helper
          // Solana helper will be initialized lazy using SOLANA_RPC_URL from env
          const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
          
          const mnemonicOrPrivateKey = process.env.WALLET_MNEMONIC || process.env.WALLET_PRIVATE_KEY;
          const accountIndex = parseInt(process.env.WALLET_ACCOUNT_INDEX || '0');
          
          if (!mnemonicOrPrivateKey) {
            throw new Error('WALLET_MNEMONIC or WALLET_PRIVATE_KEY environment variable is required');
          }
          
          this.tradeService = new TradeServiceClass(
            rpcUrl,
            mnemonicOrPrivateKey,
            BSC_ADDRESSES.BUSD,
            accountIndex
          );
          logger.info(`TradeService initialized successfully for chain ${chainId}`);
        }
      } catch (error: any) {
        logger.error(`Failed to initialize TradeService: ${error.message}`);
        throw new Error(`TradeService not available: ${error.message}. Please check WALLET_MNEMONIC or WALLET_PRIVATE_KEY environment variable.`);
      }
    }
    
    if (!this.tradeService) {
      throw new Error('TradeService not initialized. Please check WALLET_MNEMONIC or WALLET_PRIVATE_KEY environment variable.');
    }
    
    try {
      const result = await this.tradeService.buy({
        tokenAddress,
        amountUsd,
        slippage,
        chainId,
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
    // Try to initialize if not already initialized
    if (!this.tradeService) {
      logger.warn('TradeService not initialized. Attempting to initialize...');
      await this.initialize();
    }
    
    // Try to load TradeService if still not loaded
    if (!this.tradeService) {
      loadTradeService();
      
      try {
        if (TradeServiceClass) {
          const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
          const mnemonicOrPrivateKey = process.env.WALLET_MNEMONIC || process.env.WALLET_PRIVATE_KEY;
          const accountIndex = parseInt(process.env.WALLET_ACCOUNT_INDEX || '0');
          
          if (!mnemonicOrPrivateKey) {
            throw new Error('WALLET_MNEMONIC or WALLET_PRIVATE_KEY environment variable is required');
          }
          
          this.tradeService = new TradeServiceClass(
            rpcUrl,
            mnemonicOrPrivateKey,
            BSC_ADDRESSES.BUSD,
            accountIndex
          );
          logger.info('TradeService initialized successfully');
        }
      } catch (error: any) {
        logger.error(`Failed to initialize TradeService: ${error.message}`);
        throw new Error(`TradeService not available: ${error.message}. Please check WALLET_MNEMONIC or WALLET_PRIVATE_KEY environment variable.`);
      }
    }
    
    if (!this.tradeService) {
      throw new Error('TradeService not initialized. Please check WALLET_MNEMONIC or WALLET_PRIVATE_KEY environment variable.');
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
  async getBalance(): Promise<{ busd: string; bnb: string; walletAddress: string; totalValueUSD: number }> {
    // Try to initialize if not already initialized
    if (!this.pancakeswap) {
      logger.warn('PancakeSwap helper not initialized. Attempting to initialize...');
      await this.initialize();
      
      if (!this.pancakeswap) {
        throw new Error('PancakeSwap helper not initialized. Please check WALLET_MNEMONIC or WALLET_PRIVATE_KEY environment variable.');
      }
    }
    
    try {
      const walletAddress = this.pancakeswap.getWalletAddress();
      logger.info(`Getting balance for wallet: ${walletAddress}`);
      
      const busdBalance = await this.pancakeswap.getTokenBalance(BSC_ADDRESSES.BUSD);
      const bnbBalance = await this.pancakeswap.getBNBBalance();
      
      // Get BNB price in USD
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
        logger.warn('Failed to fetch BNB price from CoinGecko:', error.message);
        // Fallback: use approximate price (will be inaccurate but better than nothing)
        bnbPriceUSD = 300; // Approximate BNB price
      }
      
      // Calculate total value in USD
      const busdValue = parseFloat(busdBalance);
      const bnbValue = parseFloat(bnbBalance) * bnbPriceUSD;
      const totalValueUSD = busdValue + bnbValue;
      
      logger.info(`Balance retrieved - BUSD: ${busdBalance}, BNB: ${bnbBalance}, Total USD: ${totalValueUSD.toFixed(2)}`);
      
      return {
        busd: busdBalance,
        bnb: bnbBalance,
        walletAddress: walletAddress,
        totalValueUSD: totalValueUSD,
      };
    } catch (error: any) {
      logger.error('Error getting wallet balance:', error);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  /**
   * Get balance by address (read-only, no private key needed)
   */
  async getBalanceByAddress(address: string): Promise<{ busd: string; bnb: string; walletAddress: string; totalValueUSD: number }> {
    try {
      const { ethers } = await import('ethers');
      const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Validate address
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid address format');
      }

      const normalizedAddress = ethers.getAddress(address); // Get checksum address

      // Get BNB balance
      const bnbBalance = await provider.getBalance(normalizedAddress);
      const bnbBalanceFormatted = ethers.formatEther(bnbBalance);

      // Get BUSD balance
      const busdAddress = BSC_ADDRESSES.BUSD;
      const erc20Abi = ['function balanceOf(address account) external view returns (uint256)'];
      const busdContract = new ethers.Contract(busdAddress, erc20Abi, provider);
      const busdBalance = await busdContract.balanceOf(normalizedAddress);
      const busdBalanceFormatted = ethers.formatEther(busdBalance);

      // Get BNB price in USD
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
        logger.warn('Failed to fetch BNB price from CoinGecko:', error.message);
        // Fallback: use approximate price
        bnbPriceUSD = 300; // Approximate BNB price
      }

      // Calculate total value in USD
      const busdValue = parseFloat(busdBalanceFormatted);
      const bnbValue = parseFloat(bnbBalanceFormatted) * bnbPriceUSD;
      const totalValueUSD = busdValue + bnbValue;

      return {
        busd: busdBalanceFormatted,
        bnb: bnbBalanceFormatted,
        walletAddress: normalizedAddress,
        totalValueUSD: totalValueUSD,
      };
    } catch (error: any) {
      logger.error('Error getting balance by address:', error);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  /**
   * Transfer BNB to address
   */
  async transferBNB(toAddress: string, amountBNB: number): Promise<{ txHash: string }> {
    if (!this.pancakeswap) {
      await this.initialize();
      if (!this.pancakeswap) {
        throw new Error('PancakeSwap helper not initialized. Wallet credentials may be missing.');
      }
    }

    try {
      const { ethers } = await import('ethers');
      const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
      const mnemonicOrPrivateKey = process.env.WALLET_MNEMONIC || process.env.WALLET_PRIVATE_KEY;
      const accountIndex = parseInt(process.env.WALLET_ACCOUNT_INDEX || '0');
      
      if (!mnemonicOrPrivateKey) {
        throw new Error('Wallet credentials not found');
      }

      // Create wallet
      let wallet: any;
      if (mnemonicOrPrivateKey.trim().includes(' ')) {
        // Mnemonic
        const { createWalletFromMnemonic } = await import('../../shared/utils/wallet');
        wallet = createWalletFromMnemonic(mnemonicOrPrivateKey, undefined, accountIndex);
      } else {
        // Private key
        wallet = new ethers.Wallet(mnemonicOrPrivateKey);
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      wallet = wallet.connect(provider);
      
      // Validate address
      if (!ethers.isAddress(toAddress)) {
        throw new Error('Invalid recipient address format');
      }

      const normalizedAddress = ethers.getAddress(toAddress);

      // Convert amount to Wei
      const amountWei = ethers.parseEther(amountBNB.toString());

      // Check balance
      const balance = await provider.getBalance(wallet.address);
      if (balance < amountWei) {
        throw new Error(`Insufficient BNB balance. Available: ${ethers.formatEther(balance)} BNB, Required: ${amountBNB} BNB`);
      }

      // Get gas price
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice;
      if (!gasPrice) {
        throw new Error('Unable to fetch gas price');
      }

      const gasLimit = 21000n; // Standard BNB transfer
      
      // Send transaction
      logger.info(`Transferring ${amountBNB} BNB from ${wallet.address} to ${normalizedAddress}`);
      const tx = await wallet.sendTransaction({
        to: normalizedAddress,
        value: amountWei,
        gasLimit: gasLimit,
        gasPrice: gasPrice,
      });

      logger.info(`Transfer transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      logger.info(`Transfer successful: ${tx.hash}`);

      return {
        txHash: tx.hash,
      };
    } catch (error: any) {
      logger.error('Error transferring BNB:', error);
      throw new Error(`Failed to transfer BNB: ${error.message}`);
    }
  }

  /**
   * Get wallet address (supports BSC and Solana)
   */
  getWalletAddress(chainId: number = 56): string | null {
    if (chainId === 999) {
      // Solana - need to create helper to get address
      try {
        const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        const mnemonicOrPrivateKey = process.env.WALLET_MNEMONIC || process.env.WALLET_PRIVATE_KEY;
        const accountIndex = parseInt(process.env.WALLET_ACCOUNT_INDEX || '0');
        
        if (!mnemonicOrPrivateKey) {
          logger.warn('Wallet credentials not found for Solana');
          return null;
        }

        // Dynamically import SolanaJupiterHelper
        try {
          // Try multiple paths - file is TypeScript, so we need to use ts-node or compiled version
          const path = require('path');
          const possiblePaths = [
            // Try from trade-engine dist (compiled)
            '/app/trade-engine/dist/shared/libs/solana-jupiter',
            path.join(process.cwd(), 'trade-engine', 'dist', 'shared', 'libs', 'solana-jupiter'),
            path.join(__dirname, '../../../../trade-engine/dist/shared/libs/solana-jupiter'),
            // Try source TypeScript (might work with ts-node)
            path.join(process.cwd(), 'shared', 'libs', 'solana-jupiter'),
            '/app/shared/libs/solana-jupiter',
            path.join(__dirname, '../../../shared/libs/solana-jupiter'),
          ];
          
          let SolanaJupiterHelper: any = null;
          for (const solanaPath of possiblePaths) {
            try {
              const solanaModule = require(solanaPath);
              SolanaJupiterHelper = solanaModule.SolanaJupiterHelper;
              if (SolanaJupiterHelper) {
                logger.debug(`SolanaJupiterHelper loaded from: ${solanaPath}`);
                break;
              }
            } catch (e: any) {
              // Try next path
              continue;
            }
          }
          
          if (!SolanaJupiterHelper) {
            logger.warn('SolanaJupiterHelper not found in any path. Wallet address will not be displayed for Solana.');
            return null;
          }
          
          const solanaHelper = new SolanaJupiterHelper(solanaRpcUrl, mnemonicOrPrivateKey, accountIndex);
          return solanaHelper.getWalletAddress();
        } catch (error: any) {
          logger.error(`Failed to get Solana wallet address: ${error.message}`);
          logger.error(`Error stack: ${error.stack}`);
          return null;
        }
      } catch (error: any) {
        logger.error(`Error getting Solana wallet address: ${error.message}`);
        return null;
      }
    } else {
      // BSC
      if (!this.pancakeswap) {
        return null;
      }
      return this.pancakeswap.getWalletAddress();
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

  /**
   * Swap BUSD to BNB
   */
  async swapBUSDToBNB(amountBUSD: number, slippage: number = 5): Promise<{ txHash: string; bnbReceived: string }> {
    if (!this.pancakeswap) {
      throw new Error('PancakeSwap helper not initialized. Please check WALLET_MNEMONIC or WALLET_PRIVATE_KEY environment variable.');
    }

    try {
      // Check BUSD balance
      const busdBalance = parseFloat(await this.pancakeswap.getBUSDBalance());
      if (busdBalance < amountBUSD) {
        throw new Error(`Insufficient BUSD balance. Have ${busdBalance.toFixed(2)} BUSD, need ${amountBUSD.toFixed(2)} BUSD.`);
      }

      // Execute swap
      const result = await this.pancakeswap.swapBUSDToBNB(amountBUSD, slippage);
      
      return {
        txHash: result.txHash,
        bnbReceived: result.amountOut,
      };
    } catch (error: any) {
      logger.error(`Error swapping BUSD to BNB: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refresh prices for all open positions
   */
  async refreshPositionsPrices(): Promise<void> {
    try {
      const axios = require('axios');
      const { pool } = await import('../config/database');
      const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';
      
      // Get all open positions
      const positions = await this.positionService.getOpenPositions();
      
      if (positions.length === 0) {
        return;
      }

      logger.info(`Refreshing prices for ${positions.length} positions...`);

      // Update each position price
      for (const position of positions) {
        try {
          const response = await axios.get(`${DEXSCREENER_API}/${position.tokenAddress}`, {
            timeout: 10000,
          });

          if (!response.data?.pairs || response.data.pairs.length === 0) {
            logger.warn(`No price data found for token ${position.tokenAddress}`);
            continue;
          }

          // Find pair on BSC
          const bscPair = response.data.pairs.find(
            (pair: any) => pair.chainId === 'bsc' || pair.chainId === '56'
          );

          if (!bscPair?.priceUsd) {
            logger.warn(`No BSC price found for token ${position.tokenAddress}`);
            continue;
          }

          const currentPrice = parseFloat(bscPair.priceUsd);
          
          // Update highest price if current is higher
          let highestPrice = position.highestPriceEver;
          if (currentPrice > highestPrice) {
            highestPrice = currentPrice;
          }

          // Calculate profit floor (same logic as price-monitor service)
          const investAmount = position.amountUsdInvested || 10;
          // Threshold: highest_price >= 5x invest amount
          const threshold = investAmount * 5;
          let profitFloor: number | null = null;
          
          if (highestPrice >= threshold) {
            // Jika highest_price >= 5x dan < 10x invest: floor = 2x invest
            if (highestPrice >= threshold && highestPrice < investAmount * 10) {
              profitFloor = investAmount * 2;
            } else {
              // Untuk >= 10x invest, gunakan formula: floor = Math.floor(highestPrice / (investAmount * 10)) * (investAmount * 5)
              profitFloor = Math.floor(highestPrice / (investAmount * 10)) * (investAmount * 5);
            }
          }

          // Update database
          if (!position.id) {
            logger.warn(`Position ID is missing for token ${position.tokenAddress}`);
            continue;
          }

          const updateResult = await pool.query(
            `UPDATE positions 
            SET current_price_usd = $1, 
                highest_price_ever = $2, 
                profit_floor = $3,
                updated_at = NOW()
            WHERE id = $4`,
            [currentPrice, highestPrice, profitFloor, position.id]
          );

          if (updateResult.rowCount === 0) {
            logger.warn(`No rows updated for position ${position.id} (${position.tokenAddress})`);
          } else {
            logger.debug(`Updated position ${position.id}: price $${currentPrice}, highest $${highestPrice}`);
          }

          // Small delay to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error: any) {
          logger.warn(`Error refreshing price for position ${position.id} (${position.tokenAddress}): ${error.message}`);
          // Continue with next position
        }
      }

      logger.info(`Price refresh completed for ${positions.length} positions`);
    } catch (error: any) {
      logger.error(`Error refreshing positions prices: ${error.message}`);
      throw error;
    }
  }
}


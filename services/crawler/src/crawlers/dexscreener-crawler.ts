import axios, { AxiosInstance } from 'axios';
import {
  DexScreenerPair,
  NormalizedCoin,
} from '../types';
import { logger } from '../config/logger';
import { isRecentlyCreated } from '../utils/validators';

/**
 * DexScreener API crawler
 * Fetches new meme coins from DexScreener API
 * 
 * API Documentation: https://docs.dexscreener.com/
 */
export class DexScreenerCrawler {
  private apiClient: AxiosInstance;
  private readonly baseUrl = 'https://api.dexscreener.com';

  constructor() {
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Fetch token boosts (latest)
   * Uses /token-boosts/latest/v1 endpoint to get latest boosted tokens
   * These are tokens that have been recently promoted/boosted
   * 
   * Reference: https://docs.dexscreener.com/api/reference
   */
  async fetchTokenBoostsLatest(): Promise<any[]> {
    try {
      logger.info('Fetching latest token boosts from DexScreener...');

      const response = await this.apiClient.get(
        '/token-boosts/latest/v1'
      );

      if (!response.data || !Array.isArray(response.data)) {
        logger.warn('No token boosts returned from DexScreener API');
        return [];
      }

      logger.info(`Fetched ${response.data.length} latest token boosts from DexScreener`);
      return response.data;
    } catch (error: any) {
      logger.error('Error fetching token boosts from DexScreener:', error);
      if (error.response) {
        logger.error(`API Error: ${error.response.status} - ${error.response.statusText}`);
      }
      return [];
    }
  }

  /**
   * Fetch token boosts (top)
   * Uses /token-boosts/top/v1 endpoint to get top boosted tokens
   * These are tokens with the most active boosts
   * 
   * Reference: https://docs.dexscreener.com/api/reference
   */
  async fetchTokenBoostsTop(): Promise<any[]> {
    try {
      logger.info('Fetching top token boosts from DexScreener...');

      const response = await this.apiClient.get(
        '/token-boosts/top/v1'
      );

      if (!response.data || !Array.isArray(response.data)) {
        logger.warn('No top token boosts returned from DexScreener API');
        return [];
      }

      logger.info(`Fetched ${response.data.length} top token boosts from DexScreener`);
      return response.data;
    } catch (error: any) {
      logger.error('Error fetching top token boosts from DexScreener:', error);
      if (error.response) {
        logger.error(`API Error: ${error.response.status} - ${error.response.statusText}`);
      }
      return [];
    }
  }

  /**
   * Fetch recent token profiles from DexScreener
   * Uses /community-takeovers/latest/v1 endpoint to get latest token community takeovers
   * This returns an array of recent tokens
   * 
   * Reference: https://docs.dexscreener.com/api/reference
   */
  async fetchRecentTokenProfiles(): Promise<any[]> {
    try {
      logger.info('Fetching latest token community takeovers from DexScreener...');

      const response = await this.apiClient.get(
        '/community-takeovers/latest/v1'
      );

      if (!response.data || !Array.isArray(response.data)) {
        logger.warn('No token profiles returned from DexScreener API');
        return [];
      }

      logger.info(`Fetched ${response.data.length} token profiles from DexScreener`);
      return response.data;
    } catch (error: any) {
      logger.error('Error fetching token profiles from DexScreener:', error);
      if (error.response) {
        logger.error(`API Error: ${error.response.status} - ${error.response.statusText}`);
      }
      return [];
    }
  }

  /**
   * Fetch pairs by token address
   * Uses /token-pairs/v1/{chainId}/{tokenAddress} endpoint
   * 
   * Reference: https://docs.dexscreener.com/api/reference
   */
  async fetchPairsByToken(chainId: string, tokenAddress: string): Promise<DexScreenerPair[]> {
    try {
      logger.info(`Fetching pairs for token ${tokenAddress} on chain ${chainId}...`);

      const response = await this.apiClient.get<DexScreenerPair[]>(
        `/token-pairs/v1/${chainId}/${tokenAddress}`
      );

      if (!response.data || !Array.isArray(response.data)) {
        logger.warn(`No pairs returned for token ${tokenAddress}`);
        return [];
      }

      logger.info(`Fetched ${response.data.length} pairs for token ${tokenAddress}`);
      return response.data;
    } catch (error: any) {
      logger.error(`Error fetching pairs for token ${tokenAddress}:`, error);
      return [];
    }
  }

  /**
   * Fetch recent pairs using token profiles
   * Gets latest token profiles and then fetches their pairs
   * @param chainId - Chain name (e.g., 'ethereum', 'bsc')
   * @param profiles - Optional: pre-fetched profiles to avoid duplicate API calls
   */
  async fetchRecentPairs(
    chainId: string = 'ethereum',
    profiles?: any[]
  ): Promise<DexScreenerPair[]> {
    try {
      logger.info(`Fetching recent pairs from DexScreener for chain: ${chainId}`);

      // Get profiles if not provided
      const tokenProfiles = profiles || await this.fetchRecentTokenProfiles();
      
      if (tokenProfiles.length === 0) {
        logger.warn('No token profiles found');
        return [];
      }

      // Map chain names to DexScreener format
      const chainNameMap: Record<string, string> = {
        '1': 'ethereum',
        '56': 'bsc',
        '8453': 'base',
        '42161': 'arbitrum',
        '137': 'polygon',
        '10': 'optimism',
      };
      
      const chainName = chainNameMap[chainId] || chainId.toLowerCase();
      const filteredProfiles = tokenProfiles.filter((p: any) => {
        if (!p.chainId) return false;
        return p.chainId.toLowerCase() === chainName.toLowerCase();
      });

      logger.info(`Found ${filteredProfiles.length} token profiles for chain ${chainId} (${chainName})`);

      // Fetch pairs for each token
      const allPairs: DexScreenerPair[] = [];
      for (const profile of filteredProfiles.slice(0, 10)) { // Limit to 10 to avoid rate limiting
        if (!profile.tokenAddress || !profile.chainId) continue;
        
        try {
          const pairs = await this.fetchPairsByToken(profile.chainId, profile.tokenAddress);
          
          // Debug: log pair creation times
          if (pairs.length > 0) {
            const pairsWithTime = pairs.filter(p => p.pairCreatedAt).length;
            const pairsWithoutTime = pairs.length - pairsWithTime;
            logger.info(`Pairs breakdown: ${pairs.length} total, ${pairsWithTime} with createdAt, ${pairsWithoutTime} without createdAt`);
          }
          
          // Filter pairs created in last 24 hours (community takeovers are recent, so we accept all pairs)
          const recentPairs = pairs.filter((pair) => {
            if (!pair.pairCreatedAt) {
              logger.debug(`Pair ${pair.pairAddress} has no pairCreatedAt, accepting it`);
              return true; // Include pairs without creation time (community takeovers are recent)
            }
            const isRecent = isRecentlyCreated(pair.pairCreatedAt, 24 * 60);
            if (!isRecent) {
              logger.debug(`Pair ${pair.pairAddress} created ${Math.round((Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60))} hours ago, filtering out`);
            }
            return isRecent; // Last 24 hours
          });
          
          logger.info(`Filtered ${recentPairs.length} recent pairs out of ${pairs.length} total pairs`);
          allPairs.push(...recentPairs);
          
          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          logger.warn(`Error fetching pairs for token ${profile.tokenAddress}:`, error);
          // Continue with next token
        }
      }

      logger.info(`Found ${allPairs.length} recent pairs (last 24 hours) for chain ${chainId}`);
      return allPairs;
    } catch (error: any) {
      logger.error('Error fetching recent pairs from DexScreener:', error);
      return [];
    }
  }

  /**
   * Fetch pairs from boosted tokens
   * Gets token boosts (latest and top) and fetches their pairs
   * @param chainIds - Array of chain IDs to fetch from
   */
  async fetchBoostedPairs(
    chainIds: string[] = ['ethereum', 'bsc', 'base']
  ): Promise<DexScreenerPair[]> {
    const allPairs: DexScreenerPair[] = [];

    try {
      // Get both latest and top boosts
      const [latestBoosts, topBoosts] = await Promise.all([
        this.fetchTokenBoostsLatest(),
        this.fetchTokenBoostsTop(),
      ]);

      // Combine and deduplicate by tokenAddress
      const allBoosts = [...latestBoosts, ...topBoosts];
      const uniqueBoosts = allBoosts.filter((boost, index, self) =>
        index === self.findIndex((b) => 
          b.tokenAddress?.toLowerCase() === boost.tokenAddress?.toLowerCase() &&
          b.chainId?.toLowerCase() === boost.chainId?.toLowerCase()
        )
      );

      logger.info(`Processing ${uniqueBoosts.length} unique boosted tokens across ${chainIds.length} chains`);

      // Map chain names to DexScreener format
      const chainNameMap: Record<string, string> = {
        '1': 'ethereum',
        '56': 'bsc',
        '8453': 'base',
        '42161': 'arbitrum',
        '137': 'polygon',
        '10': 'optimism',
        'solana': 'solana',
      };

      // Filter boosts by chain and fetch pairs
      for (const chainId of chainIds) {
        const chainName = chainNameMap[chainId] || chainId.toLowerCase();
        const chainBoosts = uniqueBoosts.filter((boost: any) => 
          boost.chainId?.toLowerCase() === chainName.toLowerCase()
        );

        logger.info(`Found ${chainBoosts.length} boosted tokens for chain ${chainId} (${chainName})`);

        // Limit to 10 per chain to avoid rate limiting
        for (const boost of chainBoosts.slice(0, 10)) {
          if (!boost.tokenAddress || !boost.chainId) continue;

          try {
            const pairs = await this.fetchPairsByToken(boost.chainId, boost.tokenAddress);
            
            // Filter pairs created in last 24 hours (boosted tokens are recent/hyped)
            const recentPairs = pairs.filter((pair) => {
              if (!pair.pairCreatedAt) return true; // Include pairs without creation time
              return isRecentlyCreated(pair.pairCreatedAt, 24 * 60); // Last 24 hours
            });

            allPairs.push(...recentPairs);

            // Small delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 200));
          } catch (error) {
            logger.warn(`Error fetching pairs for boosted token ${boost.tokenAddress}:`, error);
            // Continue with next token
          }
        }

        // Small delay between chains
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      logger.info(`Total boosted pairs found: ${allPairs.length}`);
      return allPairs;
    } catch (error: any) {
      logger.error('Error fetching boosted pairs:', error);
      return [];
    }
  }

  /**
   * Fetch new pairs from multiple chains
   * Combines community takeovers and token boosts for better coverage
   * @param chainIds - Array of chain IDs to fetch from (can be chain names like 'ethereum' or numeric IDs like '1')
   * @param includeBoosts - Whether to include boosted tokens (default: true)
   */
  async fetchNewPairs(
    chainIds: string[] = ['ethereum', 'bsc', 'base'],
    includeBoosts: boolean = true
  ): Promise<DexScreenerPair[]> {
    const allPairs: DexScreenerPair[] = [];

    // Get all recent token profiles once (shared across chains) to avoid duplicate API calls
    const profiles = await this.fetchRecentTokenProfiles();
    
    if (profiles.length === 0) {
      logger.warn('No token profiles found from community takeovers');
    } else {
      logger.info(`Processing ${profiles.length} token profiles from community takeovers across ${chainIds.length} chains`);

      // Process each chain (pass profiles to avoid re-fetching)
      for (const chainId of chainIds) {
        try {
          const pairs = await this.fetchRecentPairs(chainId, profiles);
          allPairs.push(...pairs);

          // Small delay between chains to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          logger.error(`Error fetching pairs for chain ${chainId}:`, error);
          // Continue with other chains
        }
      }
    }

    // Also fetch from boosted tokens if enabled
    if (includeBoosts) {
      try {
        const boostedPairs = await this.fetchBoostedPairs(chainIds);
        allPairs.push(...boostedPairs);
        logger.info(`Added ${boostedPairs.length} pairs from boosted tokens`);
      } catch (error) {
        logger.error('Error fetching boosted pairs:', error);
        // Continue even if boosts fail
      }
    }

    // Deduplicate pairs by pairAddress
    const uniquePairs = allPairs.filter((pair, index, self) =>
      index === self.findIndex((p) => 
        p.pairAddress?.toLowerCase() === pair.pairAddress?.toLowerCase()
      )
    );

    logger.info(`Total unique pairs found across all sources: ${uniquePairs.length}`);
    return uniquePairs;
  }

  /**
   * Normalize DexScreener pair data to our coin format
   */
  normalizePair(pair: DexScreenerPair): NormalizedCoin {
    // Extract chain ID from chainId string
    const chainId = this.parseChainId(pair.chainId);
    
    // Solana addresses are case-sensitive, don't lowercase them
    // Ethereum addresses should be lowercase for consistency
    const isSolana = chainId === 999;
    const address = isSolana 
      ? pair.baseToken.address 
      : pair.baseToken.address.toLowerCase();
    const pairAddress = isSolana
      ? pair.pairAddress
      : pair.pairAddress.toLowerCase();

    return {
      address: address,
      chainId: chainId,
      name: pair.baseToken.name || 'Unknown',
      symbol: pair.baseToken.symbol || 'UNKNOWN',
      priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : undefined,
      liquidityUsd: pair.liquidity?.usd,
      volume24h: pair.volume?.h24,
      priceChange24h: pair.priceChange?.h24,
      transactions24h: {
        buys: pair.txns?.h24?.buys || 0,
        sells: pair.txns?.h24?.sells || 0,
      },
      pairAddress: pairAddress,
      pairCreatedAt: pair.pairCreatedAt || Date.now(),
      source: 'dexscreener',
      rawData: pair,
    };
  }

  /**
   * Parse chain ID from DexScreener chainId string
   * Maps chain names/slugs to numeric chain IDs
   */
  private parseChainId(chainId: string): number {
    // Map common chain names to chain IDs
    // Note: Solana doesn't have a numeric chain ID in EVM format
    // Using a placeholder value (999) for Solana
    const chainMap: Record<string, number> = {
      ethereum: 1,
      bsc: 56,
      base: 8453,
      arbitrum: 42161,
      polygon: 137,
      optimism: 10,
      'binance-smart-chain': 56,
      solana: 999, // Placeholder for Solana (non-EVM chain)
    };

    const lowerChainId = chainId.toLowerCase();
    return chainMap[lowerChainId] || 1; // Default to Ethereum
  }
}

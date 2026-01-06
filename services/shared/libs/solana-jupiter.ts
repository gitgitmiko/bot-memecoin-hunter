/**
 * Solana Swap Helper using Jupiter API
 */

// @ts-ignore - Dependencies are available at runtime
import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
// @ts-ignore - Dependencies are available at runtime
import winston from 'winston';
// @ts-ignore - Dependencies are available at runtime
import bs58 from 'bs58';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  defaultMeta: { service: 'solana-jupiter-helper' },
  transports: [new winston.transports.Console()],
});

// Jupiter API endpoints
const JUPITER_API = 'https://quote-api.jup.ag/v6';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap';

// Solana native token (SOL)
const SOL_MINT = 'So11111111111111111111111111111111111111112';

export interface SwapResult {
  txHash: string;
  amountIn: string;
  amountOut: string;
  tokenAmount: string;
}

export class SolanaJupiterHelper {
  private connection: Connection;
  private wallet: Keypair;

  constructor(
    rpcUrl: string,
    mnemonicOrPrivateKey: string,
    accountIndex: number = 0
  ) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    
    // Support both mnemonic and private key
    if (mnemonicOrPrivateKey.trim().includes(' ')) {
      // It's a mnemonic - convert to Solana keypair
      try {
        // @ts-ignore - bip39 is available at runtime
        const bip39 = require('bip39');
        // @ts-ignore - ed25519-hd-key is available at runtime
        const { derivePath } = require('ed25519-hd-key');
        
        // Validate mnemonic
        if (!bip39.validateMnemonic(mnemonicOrPrivateKey.trim())) {
          throw new Error('Invalid mnemonic phrase');
        }
        
        // Solana uses BIP44 path: m/44'/501'/0'/0' for account 0
        // For account index > 0: m/44'/501'/0'/{index}'
        const derivationPath = accountIndex === 0 
          ? "m/44'/501'/0'/0'"
          : `m/44'/501'/0'/${accountIndex}'`;
        
        // Generate seed from mnemonic
        const seed = bip39.mnemonicToSeedSync(mnemonicOrPrivateKey.trim());
        
        // Derive key from seed using Solana derivation path
        const derivedSeed = derivePath(derivationPath, seed.toString('hex')).key;
        
        // Create keypair from derived seed
        this.wallet = Keypair.fromSeed(derivedSeed);
        
        logger.info(`Solana wallet created from mnemonic (account ${accountIndex}), address: ${this.wallet.publicKey.toString()}`);
      } catch (error: any) {
        logger.error(`Failed to create Solana wallet from mnemonic: ${error.message}`);
        throw new Error(`Failed to create Solana wallet from mnemonic: ${error.message}`);
      }
    } else {
      // It's a private key
      try {
        // Try base58 decode first (Solana standard)
        const privateKeyBytes = bs58.decode(mnemonicOrPrivateKey);
        this.wallet = Keypair.fromSecretKey(privateKeyBytes);
      } catch (error) {
        // Try as hex string
        try {
          const privateKeyBytes = Buffer.from(mnemonicOrPrivateKey, 'hex');
          this.wallet = Keypair.fromSecretKey(privateKeyBytes);
        } catch (e) {
          throw new Error('Invalid Solana private key format. Expected base58 or hex string, or mnemonic phrase.');
        }
      }
      logger.info(`Solana wallet created from private key, address: ${this.wallet.publicKey.toString()}`);
    }
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    return this.wallet.publicKey.toString();
  }

  /**
   * Get SOL balance
   */
  async getSOLBalance(): Promise<string> {
    try {
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      return (balance / 1e9).toString(); // Convert lamports to SOL
    } catch (error: any) {
      logger.error('Error getting SOL balance:', error);
      throw error;
    }
  }

  /**
   * Get quote from Jupiter API with retry logic
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50, // 0.5% default slippage
    retries: number = 3
  ): Promise<any> {
    // Convert SOL amount to lamports (9 decimals)
    const amountInSmallestUnit = Math.floor(amount * 1e9);

    const quoteUrl = `${JUPITER_API}/quote?` +
      `inputMint=${inputMint}&` +
      `outputMint=${outputMint}&` +
      `amount=${amountInSmallestUnit}&` +
      `slippageBps=${slippageBps}`;

    let lastError: any = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Try using axios first (more reliable for network issues)
        const axios = require('axios');
        const response = await axios.get(quoteUrl, {
          timeout: 30000, // 30 seconds timeout
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.data) {
          return response.data;
        }
      } catch (axiosError: any) {
        lastError = axiosError;
        
        // If DNS error, wait a bit and retry
        if (axiosError.code === 'ENOTFOUND' && attempt < retries) {
          logger.warn(`DNS resolution failed (attempt ${attempt}/${retries}), retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        // Fallback to fetch if axios fails
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          const response = await fetch(quoteUrl, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
            },
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Jupiter API error: ${response.status} - ${errorText}`);
          }
          
          const quote = await response.json();
          return quote;
        } catch (fetchError: any) {
          lastError = fetchError;
          
          // If DNS error, wait a bit and retry
          if (fetchError.code === 'ENOTFOUND' && attempt < retries) {
            logger.warn(`DNS resolution failed (attempt ${attempt}/${retries}), retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }
      }
    }

    // All retries failed
    logger.error('All attempts failed for Jupiter API:', {
      error: lastError?.message,
      code: lastError?.code,
      url: quoteUrl,
    });
    
    if (lastError?.code === 'ENOTFOUND') {
      throw new Error(`Cannot reach Jupiter API (DNS resolution failed for quote-api.jup.ag after ${retries} attempts). Please check network connectivity, DNS settings, or try again later.`);
    }
    
    throw new Error(`Failed to get quote from Jupiter after ${retries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Swap SOL for Token using Jupiter
   */
  async swapSOLForToken(
    tokenMint: string,
    amountSOL: number,
    slippage: number = 5 // 5% default slippage
  ): Promise<SwapResult> {
    try {
      const slippageBps = slippage * 100; // Convert percentage to basis points

      // Get quote
      logger.info(`Getting quote for ${amountSOL} SOL -> Token ${tokenMint}`);
      const quote = await this.getQuote(SOL_MINT, tokenMint, amountSOL, slippageBps);

      if (!quote || !quote.outAmount) {
        throw new Error('No quote available from Jupiter');
      }

      // Get swap transaction from Jupiter - use axios as primary method
      let swapData: any;
      try {
        const axios = require('axios');
        logger.info(`Fetching swap transaction from Jupiter API...`);
        const swapResponse = await axios.post(
          JUPITER_SWAP_API,
          {
            quoteResponse: quote,
            userPublicKey: this.wallet.publicKey.toString(),
            wrapUnwrapSOL: true,
            slippageBps,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: 'auto',
          },
          {
            timeout: 30000,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        swapData = swapResponse.data;
      } catch (axiosError: any) {
        // Fallback to fetch
        try {
          logger.warn('Axios failed, trying fetch as fallback...');
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          const swapResponse = await fetch(JUPITER_SWAP_API, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              quoteResponse: quote,
              userPublicKey: this.wallet.publicKey.toString(),
              wrapUnwrapSOL: true,
              slippageBps,
              dynamicComputeUnitLimit: true,
              prioritizationFeeLamports: 'auto',
            }),
          });
          
          clearTimeout(timeoutId);
          
          if (!swapResponse.ok) {
            const errorText = await swapResponse.text();
            throw new Error(`Jupiter swap API error: ${swapResponse.status} - ${errorText}`);
          }
          
          swapData = await swapResponse.json();
        } catch (fetchError: any) {
          logger.error('Both axios and fetch failed for Jupiter swap API:', {
            axiosError: axiosError.message,
            fetchError: fetchError.message,
            code: axiosError.code || fetchError.code,
          });
          
          if (axiosError.code === 'ENOTFOUND' || fetchError.code === 'ENOTFOUND') {
            throw new Error(`Cannot reach Jupiter API (DNS resolution failed for quote-api.jup.ag). Please check network connectivity, DNS settings, or try again later. Error: ${axiosError.message || fetchError.message}`);
          }
          
          throw new Error(`Failed to get swap transaction from Jupiter: ${axiosError.message || fetchError.message}`);
        }
      }

      if (!swapData || !swapData.swapTransaction) {
        throw new Error('Invalid swap response from Jupiter API: missing swapTransaction');
      }

      const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');

      // Deserialize and sign transaction
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      transaction.sign([this.wallet]);

      // Send transaction
      logger.info('Sending swap transaction...');
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          maxRetries: 3,
        }
      );

      logger.info(`Swap transaction submitted: ${signature}`);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      logger.info(`Swap successful: ${signature}`);

      // Calculate token amount received (approximate, adjust decimals based on token)
      // For now, use quote outAmount
      const tokenAmount = (parseFloat(quote.outAmount) / 1e9).toString(); // Adjust decimals based on token

      return {
        txHash: signature,
        amountIn: amountSOL.toString(),
        amountOut: tokenAmount,
        tokenAmount: tokenAmount,
      };
    } catch (error: any) {
      logger.error('Error in swapSOLForToken:', error);
      throw new Error(`Solana swap failed: ${error.message || error}`);
    }
  }

  /**
   * Swap Token for SOL using Jupiter (for sell)
   */
  async swapTokenForSOL(
    tokenMint: string,
    tokenAmount: string,
    slippage: number = 5
  ): Promise<SwapResult> {
    try {
      const slippageBps = slippage * 100;

      // Get quote
      logger.info(`Getting quote for Token ${tokenMint} -> SOL`);
      const quote = await this.getQuote(tokenMint, SOL_MINT, parseFloat(tokenAmount), slippageBps);

      if (!quote || !quote.outAmount) {
        throw new Error('No quote available from Jupiter');
      }

      // Get swap transaction from Jupiter
      const swapResponse = await fetch(JUPITER_SWAP_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: this.wallet.publicKey.toString(),
          wrapUnwrapSOL: true,
          slippageBps,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        }),
      });

      if (!swapResponse.ok) {
        const errorText = await swapResponse.text();
        throw new Error(`Jupiter swap API error: ${errorText}`);
      }

      const swapData: any = await swapResponse.json();
      const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');

      // Deserialize and sign transaction
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      transaction.sign([this.wallet]);

      // Send transaction
      logger.info('Sending swap transaction...');
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: false,
          maxRetries: 3,
        }
      );

      logger.info(`Swap transaction submitted: ${signature}`);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      logger.info(`Swap successful: ${signature}`);

      // Calculate SOL amount received
      const solAmount = (parseFloat(quote.outAmount) / 1e9).toString();

      return {
        txHash: signature,
        amountIn: tokenAmount,
        amountOut: solAmount,
        tokenAmount: tokenAmount,
      };
    } catch (error: any) {
      logger.error('Error in swapTokenForSOL:', error);
      throw new Error(`Solana swap failed: ${error.message || error}`);
    }
  }
}


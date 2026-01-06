/**
 * PancakeSwap Router V2 Helper
 * BSC Mainnet Integration
 */

// @ts-ignore - Dependencies are available at runtime from services that use this module
import { ethers } from 'ethers';
// @ts-ignore - Dependencies are available at runtime from services that use this module
import winston from 'winston';
import { createWalletFromMnemonic } from '../utils/wallet';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  defaultMeta: { service: 'pancakeswap-helper' },
  transports: [new winston.transports.Console()],
});

// PancakeSwap Router V2 ABI (minimal functions needed)
const PANCAKESWAP_ROUTER_V2_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
];

// ERC20 ABI (minimal)
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
];

// BSC Mainnet addresses
export const BSC_ADDRESSES = {
  ROUTER_V2: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  FACTORY_V2: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  USDT: '0x55d398326f99059fF775485246999027B3197955',
} as const;

export interface SwapResult {
  txHash: string;
  amountIn: string;
  amountOut: string;
  tokenAmount: string;
}

export class PancakeSwapHelper {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private router: ethers.Contract;

  constructor(
    rpcUrl: string,
    mnemonicOrPrivateKey: string,
    routerAddress: string = BSC_ADDRESSES.ROUTER_V2,
    accountIndex: number = 0
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Support both mnemonic (seed phrase) and private key
    // If it looks like a mnemonic (contains spaces), use mnemonic
    // Otherwise, treat as private key
    if (mnemonicOrPrivateKey.trim().includes(' ')) {
      // It's a mnemonic/seed phrase
      this.wallet = createWalletFromMnemonic(mnemonicOrPrivateKey, this.provider, accountIndex);
      logger.info(`Wallet created from mnemonic, address: ${this.wallet.address}`);
    } else {
      // It's a private key
      this.wallet = new ethers.Wallet(mnemonicOrPrivateKey, this.provider);
      logger.info(`Wallet created from private key, address: ${this.wallet.address}`);
    }
    
    this.router = new ethers.Contract(
      routerAddress,
      PANCAKESWAP_ROUTER_V2_ABI,
      this.wallet
    );
  }

  /**
   * Get token contract instance
   */
  private getTokenContract(tokenAddress: string): ethers.Contract {
    return new ethers.Contract(tokenAddress, ERC20_ABI, this.wallet);
  }

  /**
   * Get token decimals
   */
  async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      const token = this.getTokenContract(tokenAddress);
      const decimals = await token.decimals();
      return Number(decimals);
    } catch (error) {
      logger.error(`Error getting token decimals for ${tokenAddress}:`, error);
      // Default to 18 for most tokens
      return 18;
    }
  }

  /**
   * Get token balance
   */
  async getTokenBalance(tokenAddress: string): Promise<string> {
    const token = this.getTokenContract(tokenAddress);
    const balance = await token.balanceOf(this.wallet.address);
    return ethers.formatEther(balance);
  }

  /**
   * Get BNB balance
   */
  async getBNBBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  /**
   * Get BUSD balance
   */
  async getBUSDBalance(): Promise<string> {
    try {
      const busdContract = this.getTokenContract(BSC_ADDRESSES.BUSD);
      const balance = await busdContract.balanceOf(this.wallet.address);
      const decimals = await busdContract.decimals();
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      logger.error('Error getting BUSD balance:', error);
      throw error;
    }
  }

  /**
   * Swap BUSD to BNB
   */
  async swapBUSDToBNB(
    amountBUSD: number,
    slippage: number = 5,
    deadlineMinutes: number = 20
  ): Promise<SwapResult> {
    try {
      // Path: BUSD -> WBNB (WBNB is native BNB wrapped)
      const path = [BSC_ADDRESSES.BUSD, BSC_ADDRESSES.WBNB];

      // Get BUSD decimals
      const busdDecimals = await this.getTokenDecimals(BSC_ADDRESSES.BUSD);
      const amountIn = ethers.parseUnits(
        amountBUSD.toString(),
        busdDecimals
      );

      // Approve BUSD first
      await this.approveToken(BSC_ADDRESSES.BUSD, amountBUSD.toString());

      // Get expected amount out
      const amounts = await this.getAmountsOutWithDecimals(amountIn, path);
      const expectedAmountOut = amounts[1]; // WBNB amount

      // Calculate minimum amount out with slippage
      const slippageMultiplier = BigInt(100 - slippage);
      const amountOutMin = (expectedAmountOut * slippageMultiplier) / BigInt(100);

      // Deadline
      const deadline = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

      // Execute swap
      logger.info(
        `Swapping ${amountBUSD} BUSD for BNB with ${slippage}% slippage`
      );

      const tx = await this.router.swapExactTokensForETH(
        amountIn,
        amountOutMin,
        path,
        this.wallet.address,
        deadline,
        {
          gasLimit: 300000,
        }
      );

      logger.info(`Swap transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      logger.info(`Swap successful: ${tx.hash}`);

      // Get BNB amount received (WBNB is 1:1 with BNB)
      const bnbAmount = ethers.formatEther(amounts[1]);

      return {
        txHash: tx.hash,
        amountIn: amountBUSD.toString(),
        amountOut: bnbAmount,
        tokenAmount: bnbAmount,
      };
    } catch (error: any) {
      logger.error('Error in swapBUSDToBNB:', error);
      throw new Error(`Swap BUSD to BNB failed: ${error.message || error}`);
    }
  }

  /**
   * Get quote amount out
   */
  async getAmountsOut(
    amountIn: string,
    path: string[]
  ): Promise<bigint[]> {
    try {
      const amounts = await this.router.getAmountsOut(
        ethers.parseEther(amountIn),
        path
      );
      return amounts;
    } catch (error) {
      logger.error('Error getting amounts out:', error);
      throw error;
    }
  }

  /**
   * Get quote amount out with custom decimals
   */
  async getAmountsOutWithDecimals(
    amountIn: bigint,
    path: string[]
  ): Promise<bigint[]> {
    try {
      const amounts = await this.router.getAmountsOut(amountIn, path);
      return amounts;
    } catch (error) {
      logger.error('Error getting amounts out:', error);
      throw error;
    }
  }

  /**
   * Approve token spending
   */
  async approveToken(
    tokenAddress: string,
    amount: string,
    spender?: string
  ): Promise<string> {
    try {
      const token = this.getTokenContract(tokenAddress);
      const decimals = await this.getTokenDecimals(tokenAddress);
      const amountWei = ethers.parseUnits(amount, decimals);
      const spenderAddress = spender || this.router.target;

      // Check current allowance
      const allowance = await token.allowance(
        this.wallet.address,
        spenderAddress
      );

      if (allowance >= amountWei) {
        logger.debug(`Token already approved: ${tokenAddress}`);
        return 'already_approved';
      }

      // Approve
      const tx = await token.approve(spenderAddress, amountWei);
      logger.info(`Approving token ${tokenAddress}, tx: ${tx.hash}`);
      await tx.wait();
      logger.info(`Token approved: ${tokenAddress}`);
      return tx.hash;
    } catch (error) {
      logger.error(`Error approving token ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Swap BNB for Token (using swapExactETHForTokens)
   */
  async swapExactBNBForTokens(
    tokenAddress: string,
    amountBNB: number,
    slippage: number = 5, // 5% default
    deadlineMinutes: number = 20
  ): Promise<SwapResult> {
    try {
      // Path: WBNB -> Token (BNB will be wrapped to WBNB automatically by router)
      const path = [BSC_ADDRESSES.WBNB, tokenAddress];

      // Convert BNB amount to Wei
      const amountInWei = ethers.parseEther(amountBNB.toString());

      // Get expected amount out
      // Path has 2 tokens: [WBNB, Token], so amounts array will have 2 values
      // amounts[0] = input (WBNB), amounts[1] = output (Token)
      const amounts = await this.getAmountsOut(
        amountBNB.toString(),
        path
      );
      const expectedAmountOut = amounts[1]; // Token amount

      // Calculate minimum amount out with slippage
      const slippageMultiplier = BigInt(100 - slippage);
      const amountOutMin = (expectedAmountOut * slippageMultiplier) / BigInt(100);

      // Deadline
      const deadline = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

      // Execute swap using swapExactETHForTokens (BNB = native ETH on BSC)
      logger.info(
        `Swapping ${amountBNB} BNB for token ${tokenAddress} with ${slippage}% slippage`
      );

      const tx = await this.router.swapExactETHForTokens(
        amountOutMin,
        path,
        this.wallet.address,
        deadline,
        {
          value: amountInWei,
          gasLimit: 500000, // Safe gas limit
        }
      );

      logger.info(`Swap transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      logger.info(`Swap successful: ${tx.hash}`);

      // Get token amount
      const tokenDecimals = await this.getTokenDecimals(tokenAddress);
      const tokenAmount = ethers.formatUnits(amounts[1], tokenDecimals);

      return {
        txHash: tx.hash,
        amountIn: amountBNB.toString(),
        amountOut: tokenAmount,
        tokenAmount: tokenAmount,
      };
    } catch (error: any) {
      logger.error('Error in swapExactBNBForTokens:', error);
      throw new Error(`Swap failed: ${error.message || error}`);
    }
  }

  /**
   * Swap BUSD/USDT for Token
   */
  async swapExactTokensForTokens(
    tokenAddress: string,
    amountUsd: number,
    stablecoinAddress: string = BSC_ADDRESSES.BUSD,
    slippage: number = 5, // 5% default
    deadlineMinutes: number = 20
  ): Promise<SwapResult> {
    try {
      // Path: BUSD/USDT -> WBNB -> Token (most tokens pair with WBNB, not stablecoins directly)
      // Using WBNB as intermediate token is the standard approach on PancakeSwap
      const path = [stablecoinAddress, BSC_ADDRESSES.WBNB, tokenAddress];

      // Get stablecoin decimals (usually 18 for BUSD/USDT on BSC)
      const stablecoinDecimals = await this.getTokenDecimals(stablecoinAddress);
      const amountIn = ethers.parseUnits(
        amountUsd.toString(),
        stablecoinDecimals
      );

      // Approve stablecoin first
      await this.approveToken(stablecoinAddress, amountUsd.toString());

      // Get expected amount out
      // Path has 3 tokens: [BUSD, WBNB, Token], so amounts array will have 3 values
      // amounts[0] = input (BUSD), amounts[1] = WBNB, amounts[2] = output (Token)
      const amounts = await this.getAmountsOut(
        amountUsd.toString(),
        path
      );
      const expectedAmountOut = amounts[2]; // Token amount (last in path)

      // Calculate minimum amount out with slippage
      const slippageMultiplier = BigInt(100 - slippage);
      const amountOutMin = (expectedAmountOut * slippageMultiplier) / BigInt(100);

      // Deadline
      const deadline = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

      // Execute swap
      logger.info(
        `Swapping ${amountUsd} USD for token ${tokenAddress} with ${slippage}% slippage`
      );

      const tx = await this.router.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        this.wallet.address,
        deadline,
        {
          gasLimit: 500000, // Safe gas limit
        }
      );

      logger.info(`Swap transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      logger.info(`Swap successful: ${tx.hash}`);

      // Get token amount (from event logs or calculate)
      // Path: [BUSD, WBNB, Token], so amounts[2] is the token amount
      const tokenDecimals = await this.getTokenDecimals(tokenAddress);
      const tokenAmount = ethers.formatUnits(amounts[2], tokenDecimals);

      return {
        txHash: tx.hash,
        amountIn: amountUsd.toString(),
        amountOut: tokenAmount,
        tokenAmount: tokenAmount,
      };
    } catch (error: any) {
      logger.error('Error in swapExactTokensForTokens:', error);
      throw new Error(`Swap failed: ${error.message || error}`);
    }
  }

  /**
   * Swap Token for BUSD/USDT (SELL)
   */
  async swapExactTokensForETH(
    tokenAddress: string,
    tokenAmount: string,
    stablecoinAddress: string = BSC_ADDRESSES.BUSD,
    slippage: number = 5,
    deadlineMinutes: number = 20
  ): Promise<SwapResult> {
    try {
      const tokenDecimals = await this.getTokenDecimals(tokenAddress);
      const amountIn = ethers.parseUnits(tokenAmount, tokenDecimals);

      // Approve token first
      await this.approveToken(tokenAddress, tokenAmount);

      // Try path with WBNB first (most tokens pair with WBNB, not stablecoins directly)
      // Path: Token -> WBNB -> BUSD/USDT
      const pathWithWBNB = [tokenAddress, BSC_ADDRESSES.WBNB, stablecoinAddress];
      const directPath = [tokenAddress, stablecoinAddress];
      
      let amounts: bigint[];
      let expectedAmountOut: bigint;
      let finalPath: string[];
      
      try {
        // Try WBNB path first (standard approach on PancakeSwap)
        amounts = await this.getAmountsOutWithDecimals(amountIn, pathWithWBNB);
        expectedAmountOut = amounts[2]; // BUSD amount (last in path)
        finalPath = pathWithWBNB;
        logger.info(`Using swap path: ${finalPath.join(' -> ')}`);
      } catch (error: any) {
        // Fallback: try direct pair if WBNB path fails
        logger.warn(`Path with WBNB failed, trying direct pair: ${error.message}`);
        try {
          amounts = await this.getAmountsOutWithDecimals(amountIn, directPath);
          expectedAmountOut = amounts[1]; // BUSD amount
          finalPath = directPath;
          logger.info(`Using direct swap path: ${finalPath.join(' -> ')}`);
        } catch (directError: any) {
          logger.error('Both WBNB path and direct pair failed');
          throw new Error(`No valid swap path found. Token may not have liquidity pair. Original error: ${error.message}`);
        }
      }

      // Calculate minimum amount out with slippage
      const slippageMultiplier = BigInt(100 - slippage);
      const amountOutMin = (expectedAmountOut * slippageMultiplier) / BigInt(100);

      // Deadline
      const deadline = Math.floor(Date.now() / 1000) + deadlineMinutes * 60;

      // Execute swap
      logger.info(
        `Selling ${tokenAmount} tokens ${tokenAddress} with ${slippage}% slippage via path: ${finalPath.join(' -> ')}`
      );

      const tx = await this.router.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        finalPath,
        this.wallet.address,
        deadline,
        {
          gasLimit: 500000,
        }
      );

      logger.info(`Sell transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      logger.info(`Sell successful: ${tx.hash}`);

      // Get USD amount received
      const stablecoinDecimals = await this.getTokenDecimals(stablecoinAddress);
      // amounts array length depends on path length
      const outputIndex = finalPath.length - 1;
      const usdAmount = ethers.formatUnits(amounts[outputIndex], stablecoinDecimals);

      return {
        txHash: tx.hash,
        amountIn: tokenAmount,
        amountOut: usdAmount,
        tokenAmount: tokenAmount,
      };
    } catch (error: any) {
      logger.error('Error in swapExactTokensForETH (sell):', error);
      
      // Provide more informative error messages
      let errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('execution reverted') || errorMessage.includes('require(false)')) {
        errorMessage = 'Swap path tidak valid atau tidak ada liquidity pair. Token mungkin tidak memiliki pair dengan BUSD/WBNB.';
      } else if (errorMessage.includes('insufficient funds') || errorMessage.includes('balance')) {
        errorMessage = 'Saldo token tidak mencukupi untuk melakukan swap.';
      } else if (errorMessage.includes('allowance')) {
        errorMessage = 'Gagal approve token. Pastikan wallet memiliki cukup BNB untuk gas.';
      }
      
      throw new Error(`Sell failed: ${errorMessage}`);
    }
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    return this.wallet.address;
  }
}


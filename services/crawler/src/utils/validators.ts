import { NormalizedCoin } from '../types';

/**
 * Validate Ethereum address format (0x + 40 hex chars)
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate Solana address format (Base58, 32-44 chars)
 */
export function isValidSolanaAddress(address: string): boolean {
  // Solana addresses are Base58 encoded, typically 32-44 characters
  // Base58 uses: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Validate address format (supports both Ethereum and Solana)
 */
export function isValidAddress(address: string, chainId?: number): boolean {
  if (!address) return false;
  
  // Solana uses chain_id 999
  if (chainId === 999) {
    return isValidSolanaAddress(address);
  }
  
  // Default to Ethereum format for EVM chains
  return isValidEthereumAddress(address);
}

/**
 * Validate coin data before storing
 */
export function validateCoinData(coin: NormalizedCoin): boolean {
  // Must have valid address (supports both Ethereum and Solana)
  if (!coin.address || !isValidAddress(coin.address, coin.chainId)) {
    return false;
  }

  // Must have valid chain ID
  if (!coin.chainId || coin.chainId <= 0) {
    return false;
  }

  // Must have name and symbol
  if (!coin.name || !coin.symbol) {
    return false;
  }

  // Must have pair address (supports both Ethereum and Solana)
  if (!coin.pairAddress || !isValidAddress(coin.pairAddress, coin.chainId)) {
    return false;
  }

  // Must have pair created timestamp
  if (!coin.pairCreatedAt || coin.pairCreatedAt <= 0) {
    return false;
  }

  return true;
}

/**
 * Check if coin was created in the last N minutes
 */
export function isRecentlyCreated(
  createdAt: number,
  minutesAgo: number = 60
): boolean {
  const now = Date.now();
  const timeDiff = now - createdAt;
  const minutesDiff = timeDiff / (1000 * 60);
  return minutesDiff <= minutesAgo;
}


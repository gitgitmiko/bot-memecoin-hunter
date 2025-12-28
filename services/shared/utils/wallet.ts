/**
 * Wallet Utility
 * Helper untuk membuat wallet dari mnemonic/seed phrase
 */

import { ethers } from 'ethers';

/**
 * Create wallet from mnemonic (seed phrase)
 * @param mnemonic 12 atau 24 words seed phrase
 * @param provider Optional provider (will be attached to wallet)
 * @param accountIndex Account index (default: 0 for first account)
 * @returns ethers.Wallet instance
 */
export function createWalletFromMnemonic(
  mnemonic: string,
  provider?: ethers.Provider,
  accountIndex: number = 0
): ethers.Wallet {
  try {
    // Trim mnemonic (don't lowercase, as mnemonic validation is case-sensitive for some wordlists)
    const normalizedMnemonic = mnemonic.trim();
    
    // Validate mnemonic
    if (!ethers.Mnemonic.isValidMnemonic(normalizedMnemonic)) {
      throw new Error('Invalid mnemonic phrase. Must be 12 or 24 words.');
    }

    // Create HD wallet from mnemonic
    // BIP44 path: m/44'/60'/0'/0/{accountIndex}
    // 44' = BIP44
    // 60' = Ethereum (BSC uses same derivation path as Ethereum)
    // 0' = Account
    // 0 = External chain
    // accountIndex = Account index (0 for first account)
    const hdNode = ethers.HDNodeWallet.fromPhrase(
      normalizedMnemonic,
      `m/44'/60'/0'/0/${accountIndex}`
    );

    // Create wallet from private key
    const wallet = new ethers.Wallet(hdNode.privateKey, provider);

    return wallet;
  } catch (error: any) {
    throw new Error(`Failed to create wallet from mnemonic: ${error.message}`);
  }
}

/**
 * Validate mnemonic phrase
 */
export function isValidMnemonic(mnemonic: string): boolean {
  try {
    return ethers.Mnemonic.isValidMnemonic(mnemonic.trim());
  } catch {
    return false;
  }
}

/**
 * Get wallet address from mnemonic (without provider)
 */
export function getAddressFromMnemonic(
  mnemonic: string,
  accountIndex: number = 0
): string {
  const wallet = createWalletFromMnemonic(mnemonic, undefined, accountIndex);
  return wallet.address;
}


#!/usr/bin/env node
/**
 * Script to generate a new wallet with mnemonic
 * Usage: node scripts/generate_wallet.js
 */

const { ethers } = require('ethers');

console.log('🔐 Generating new wallet...\n');

// Generate random mnemonic (12 words)
const mnemonic = ethers.Mnemonic.entropyToPhrase(ethers.randomBytes(16));

// Validate mnemonic
if (!ethers.Mnemonic.isValidMnemonic(mnemonic)) {
  console.error('❌ Invalid mnemonic generated');
  process.exit(1);
}

// Create wallet from mnemonic (index 0)
const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic, "m/44'/60'/0'/0/0");
const wallet = new ethers.Wallet(hdNode.privateKey);

console.log('✅ Wallet generated successfully!\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 MNEMONIC (Recovery Phrase):');
console.log(mnemonic);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📍 WALLET ADDRESS:');
console.log(wallet.address);
console.log('');

console.log('🔑 PRIVATE KEY (optional, keep secret!):');
console.log(wallet.privateKey);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📝 LANGKAH SELANJUTNYA:');
console.log('');
console.log('1. ⚠️  BACKUP MNEMONIC DI ATAS! (Sangat penting!)');
console.log('   - Simpan di tempat aman (password manager, dll)');
console.log('   - Jangan screenshot atau kirim ke siapapun');
console.log('');
console.log('2. Import wallet baru ke Trust Wallet:');
console.log('   - Buka Trust Wallet app');
console.log('   - Tap "+" atau "Add Wallet"');
console.log('   - Pilih "Import Wallet"');
console.log('   - Pilih "Recovery Phrase" atau "Mnemonic"');
console.log('   - Paste mnemonic: ' + mnemonic);
console.log('   - Beri nama wallet (misal: "bot wallet")');
console.log('');
console.log('3. Transfer BNB ke wallet baru:');
console.log('   - Buka wallet "airdrop gitgit" di Trust Wallet');
console.log('   - Tap Send → Pilih BNB (Smart Chain)');
console.log('   - Paste address: ' + wallet.address);
console.log('   - Masukkan jumlah BNB');
console.log('   - Konfirmasi dan kirim');
console.log('');
console.log('4. Update .env file:');
console.log('   WALLET_MNEMONIC="' + mnemonic + '"');
console.log('   WALLET_ACCOUNT_INDEX=0');
console.log('');
console.log('5. Restart bot:');
console.log('   docker-compose restart telegram-bot');
console.log('');
console.log('✅ Selesai! Bot akan menggunakan wallet baru.');
console.log('');


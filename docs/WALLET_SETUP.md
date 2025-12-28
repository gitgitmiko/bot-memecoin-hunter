# Wallet Setup dengan Seed Phrase (Mnemonic)

## 📝 Overview

Sistem sekarang mendukung penggunaan **seed phrase (mnemonic)** dari Trust Wallet atau wallet lainnya, bukan hanya private key.

## 🔐 Environment Variables

### Required

```bash
# Seed Phrase (12 atau 24 words)
WALLET_MNEMONIC="word1 word2 word3 ... word12"
```

### Optional

```bash
# Account Index (default: 0)
# Gunakan index berbeda jika ingin menggunakan account yang berbeda dari wallet
WALLET_ACCOUNT_INDEX=0

# Private Key (fallback, untuk backward compatibility)
# Sistem akan prioritize WALLET_MNEMONIC jika kedua-duanya ada
WALLET_PRIVATE_KEY=your_private_key_here
```

## 📋 Setup Steps

### 1. Dapatkan Seed Phrase dari Trust Wallet

1. Buka Trust Wallet app
2. Settings → Security → Show Recovery Phrase
3. Masukkan PIN/Password
4. Copy 12 atau 24 words seed phrase

### 2. Tambahkan ke .env File

```bash
# .env file
WALLET_MNEMONIC="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
WALLET_ACCOUNT_INDEX=0
```

**⚠️ PENTING:**
- Jangan commit `.env` file ke repository
- Simpan seed phrase dengan aman
- Jangan share seed phrase ke siapa pun

### 3. Verifikasi Address

Untuk memverifikasi bahwa address yang digunakan benar, bisa menggunakan script berikut:

```typescript
import { getAddressFromMnemonic } from './services/shared/utils/wallet';

const mnemonic = process.env.WALLET_MNEMONIC!;
const address = getAddressFromMnemonic(mnemonic, 0);
console.log('Wallet Address:', address);
```

Atau bisa cek langsung di Trust Wallet, address pertama (index 0) harus sama dengan yang digunakan oleh bot.

## 🔄 Account Index

Jika ingin menggunakan account yang berbeda dari wallet:

```bash
# Account pertama (default)
WALLET_ACCOUNT_INDEX=0

# Account kedua
WALLET_ACCOUNT_INDEX=1

# Account ketiga
WALLET_ACCOUNT_INDEX=2
```

**Note:** Trust Wallet menggunakan BIP44 derivation path:
- Path: `m/44'/60'/0'/0/{accountIndex}`
- Account 0 = address pertama di Trust Wallet
- Account 1 = address kedua (jika ada)
- dst.

## 🔒 Security Best Practices

1. **Jangan commit seed phrase ke repository**
   - Pastikan `.env` ada di `.gitignore`
   - Jangan hardcode seed phrase di code

2. **Gunakan environment variables**
   - Simpan di `.env` file (local)
   - Gunakan secrets management di production (Vault, AWS Secrets Manager, dll)

3. **Limit wallet funds**
   - Untuk testing, gunakan wallet dengan funds terbatas
   - Jangan gunakan wallet utama dengan semua funds

4. **Backup seed phrase**
   - Simpan seed phrase di tempat yang aman
   - Jangan simpan di cloud tanpa encryption

## 🔧 Troubleshooting

### Error: "Invalid mnemonic phrase"

- Pastikan seed phrase lengkap (12 atau 24 words)
- Pastikan tidak ada typo
- Pastikan format benar (spasi antar words)

### Error: "Failed to create wallet from mnemonic"

- Cek bahwa seed phrase valid
- Pastikan seed phrase tidak ada extra spaces di awal/akhir
- Cek account index (default 0)

### Address berbeda dengan Trust Wallet

- Verify account index yang digunakan
- Trust Wallet account pertama = index 0
- Jika menggunakan account kedua, set `WALLET_ACCOUNT_INDEX=1`

## 📚 Related Documentation

- [Trading System Documentation](./TRADING_SYSTEM.md)
- [README Trading](./../README_TRADING.md)


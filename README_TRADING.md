# 🚀 Memecoin Hunter Bot - Trading System

## 📋 Overview

Sistem trading otomatis untuk memecoin dengan profit floor logic yang mengunci profit ketika harga mencapai threshold tertentu.

**Core Strategy:**
- **BUY**: $10 per coin, sekali per token
- **HOLD**: Tidak ada sell selama highest_price < $50
- **PROFIT FLOOR**: Aktif jika highest_price >= $50, floor = 50% dari kelipatan 100
- **SELL**: Trigger otomatis jika current_price <= profit_floor

## 🏗️ Services

1. **trade-engine** - Service utama untuk BUY dan SELL operations via PancakeSwap
2. **dex-price-monitor** - Monitor harga setiap 30-60 detik dari DexScreener
3. **telegram-bot** - Interface kontrol via Telegram commands

## 🚀 Quick Start

### 1. Setup Database

```bash
# Run migrations
./scripts/run_migrations.sh

# Atau manual:
psql -h localhost -U memecoin_user -d memecoin_hunter -f scripts/migrations/create_positions_table.sql
```

### 2. Configure Environment

Tambahkan ke `.env`:

```bash
# Wallet - Seed Phrase (REQUIRED)
# Dapatkan dari Trust Wallet: Settings → Security → Show Recovery Phrase
WALLET_MNEMONIC="word1 word2 word3 ... word12"

# Account Index (optional, default: 0)
# Gunakan index berbeda untuk account berbeda di wallet yang sama
WALLET_ACCOUNT_INDEX=0

# Private Key (optional, fallback untuk backward compatibility)
# Sistem akan prioritize WALLET_MNEMONIC jika kedua-duanya ada
WALLET_PRIVATE_KEY=your_private_key_here

# BSC RPC (optional, default provided)
BSC_RPC_URL=https://bsc-dataseed1.binance.org/

# Price Monitor Interval (optional, default 45s)
PRICE_MONITOR_INTERVAL_MS=45000
```

**📝 Note:** Sistem sekarang menggunakan **seed phrase (mnemonic)** dari Trust Wallet. Lihat [Wallet Setup Documentation](docs/WALLET_SETUP.md) untuk detail lengkap.

### 3. Start Services

```bash
# Start all trading services
docker-compose up -d trade-engine dex-price-monitor telegram-bot

# View logs
docker-compose logs -f trade-engine
docker-compose logs -f dex-price-monitor
docker-compose logs -f telegram-bot
```

## 🤖 Telegram Commands

| Command | Description |
|---------|-------------|
| `/positions` | List semua open positions |
| `/buy <token_address>` | Buy $10 token (BSC only) |
| `/status <token_address>` | Status position per token |
| `/sell <token_address>` | Force sell position |
| `/balance` | Cek saldo wallet (BUSD & BNB) |
| `/pnl` | Total profit & loss |

### Examples

```
/buy 0x1234567890123456789012345678901234567890
/positions
/status 0x1234567890123456789012345678901234567890
/sell 0x1234567890123456789012345678901234567890
/balance
/pnl
```

## 📊 Profit Floor Logic

**Aktif HANYA jika `highest_price_ever >= $50`**

| Highest Price | Profit Floor | Sell Trigger |
|--------------|--------------|--------------|
| ≥ $50 | $20 | Jika current ≤ $20 |
| ≥ $100 | $50 | Jika current ≤ $50 |
| ≥ $200 | $100 | Jika current ≤ $100 |
| ≥ $300 | $150 | Jika current ≤ $150 |
| ≥ $400 | $200 | Jika current ≤ $200 |
| ≥ $500 | $250 | Jika current ≤ $250 |

**Formula:** `floor = Math.floor(highestPrice / 100) * 50`

## 🔄 Trading Flow

1. **BUY**: User execute `/buy <token>` via Telegram
   - System check: Position sudah ada?
   - Get price dari DexScreener
   - Execute swap BUSD → Token via PancakeSwap
   - Save position ke database

2. **MONITOR**: dex-price-monitor service (setiap 30-60 detik)
   - Get all open positions
   - Update current_price_usd dari DexScreener
   - Update highest_price_ever jika harga lebih tinggi
   - Calculate profit_floor jika needed
   - Check sell conditions

3. **SELL**: Triggered automatically atau manual via `/sell`
   - Check: current_price <= profit_floor?
   - Execute swap Token → BUSD via PancakeSwap
   - Calculate PnL
   - Update position status = CLOSED

## ⚠️ Important Notes

1. **One Position Per Token**: Hanya satu open position per token address
2. **Network**: Hanya BSC (Binance Smart Chain) untuk saat ini
3. **Stablecoin**: Menggunakan BUSD untuk swap
4. **Slippage**: Default 5%, bisa diubah di code
5. **Gas Limit**: Default 500000 untuk swap operations

## 🔧 Troubleshooting

### Position tidak ter-update

```bash
# Check price monitor logs
docker-compose logs dex-price-monitor

# Verify DexScreener API
curl https://api.dexscreener.com/latest/dex/tokens/YOUR_TOKEN_ADDRESS
```

### Swap failed

- Cek wallet balance: `/balance`
- Verify token address valid
- Check liquidity di PancakeSwap
- Review gas settings

### Sell tidak trigger

- Verify `highest_price_ever >= $50`
- Check `current_price <= profit_floor`
- Review logs untuk error messages

## 📚 Documentation

- Full documentation: [docs/TRADING_SYSTEM.md](docs/TRADING_SYSTEM.md)
- Database schema: [scripts/migrations/create_positions_table.sql](scripts/migrations/create_positions_table.sql)

## 🔐 Security

⚠️ **PENTING**: Jangan commit `WALLET_PRIVATE_KEY` ke repository!

Pastikan:
- `.env` file ada di `.gitignore`
- Private key disimpan dengan aman
- Gunakan wallet dengan modal terbatas untuk testing

---

**Happy Trading! 📈🚀**


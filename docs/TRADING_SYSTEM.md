# Trading System Documentation

## 🎯 Overview

Sistem trading otomatis untuk memecoin dengan profit floor logic yang mengunci profit ketika harga sudah mencapai threshold tertentu.

## 🏗️ Arsitektur

### Services

1. **trade-engine** - Service utama untuk BUY dan SELL operations
2. **dex-price-monitor** - Service untuk monitoring harga setiap 30-60 detik
3. **telegram-bot** - Interface untuk kontrol via Telegram commands

### Components

1. **PancakeSwap Helper** (`services/shared/libs/pancakeswap.ts`)
   - Integrasi dengan PancakeSwap Router V2
   - Fungsi: swapExactTokensForTokens, approve, getAmountsOut
   - Handle slippage dan gas limit

2. **Position Service** (`services/trade-engine/src/services/position.service.ts`)
   - CRUD operations untuk positions table
   - Query open/closed positions

3. **Trade Service** (`services/trade-engine/src/services/trade.service.ts`)
   - BUY logic: $10 per coin, sekali per token
   - SELL logic: Triggered by profit floor

4. **Profit Floor Logic** (`services/trade-engine/src/utils/profit-floor.ts`)
   - Calculate profit floor berdasarkan highest_price_ever
   - Check sell conditions

## 📊 Database Schema

### Table: positions

```sql
CREATE TABLE positions (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(100) NOT NULL,
  symbol VARCHAR(50),
  chain_id INTEGER NOT NULL DEFAULT 56,
  buy_price_usd NUMERIC(20, 8) NOT NULL,
  current_price_usd NUMERIC(20, 8),
  highest_price_ever NUMERIC(20, 8) NOT NULL DEFAULT 0,
  profit_floor NUMERIC(20, 8),
  amount_token NUMERIC(30, 18) NOT NULL,
  amount_usd_invested NUMERIC(20, 8) NOT NULL DEFAULT 10.0,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  buy_tx_hash VARCHAR(100),
  sell_tx_hash VARCHAR(100),
  pnl NUMERIC(20, 8),
  pnl_percentage NUMERIC(10, 4),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  coin_id INTEGER REFERENCES coins(id) ON DELETE SET NULL,
  UNIQUE(token_address, chain_id, status)
);
```

## 🔄 Trading Logic

### BUY Logic

1. Check jika position sudah ada untuk token (satu position per token)
2. Get current price dari DexScreener
3. Execute swap via PancakeSwap (BUSD -> Token)
4. Simpan position ke database dengan:
   - buy_price_usd
   - amount_token
   - buy_tx_hash
   - highest_price_ever = buy_price (initial)
   - status = OPEN

### HOLD Logic

- Tidak ada SELL selama `highest_price_ever < $50`
- Biarkan harga naik turun bebas

### Profit Floor Logic

**Aktif HANYA jika `highest_price_ever >= $50`**

Tabel Profit Floor:
- Highest Price ≥ $50 → Floor $20
- Highest Price ≥ $100 → Floor $50
- Highest Price ≥ $200 → Floor $100
- Highest Price ≥ $300 → Floor $150
- Highest Price ≥ $400 → Floor $200
- Highest Price ≥ $500 → Floor $250
- dst: `floor = Math.floor(highestPrice / 100) * 50`

### SELL Logic

**Trigger:** `current_price <= profit_floor`

1. Execute swap via PancakeSwap (Token -> BUSD)
2. Calculate PnL
3. Update position:
   - status = CLOSED
   - sell_tx_hash
   - pnl, pnl_percentage
   - closed_at

## 🤖 Telegram Commands

| Command | Fungsi |
|---------|--------|
| `/positions` | List semua open positions |
| `/buy <token_address>` | Buy $10 token |
| `/status <token_address>` | Status position per token |
| `/sell <token_address>` | Force sell position |
| `/balance` | Cek saldo wallet (BUSD & BNB) |
| `/pnl` | Total profit & loss |

## 📈 Price Monitoring

**Service:** `dex-price-monitor`

**Interval:** 30-60 detik (default: 45 detik)

**Process:**
1. Get all open positions
2. Fetch current price dari DexScreener untuk setiap token
3. Update `current_price_usd` dan `highest_price_ever`
4. Calculate `profit_floor` jika needed
5. Check sell conditions (current_price <= profit_floor)
6. Log positions yang perlu di-sell (execution via trade-engine/telegram)

## 🔐 Environment Variables

### Required

```bash
# Wallet - Seed Phrase (REQUIRED)
# Dapatkan dari Trust Wallet: Settings → Security → Show Recovery Phrase
WALLET_MNEMONIC="word1 word2 word3 ... word12"

# Account Index (optional, default: 0)
WALLET_ACCOUNT_INDEX=0

# Private Key (optional, fallback untuk backward compatibility)
WALLET_PRIVATE_KEY=your_private_key_here

# BSC RPC
BSC_RPC_URL=https://bsc-dataseed1.binance.org/

# Database (already configured in docker-compose)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=memecoin_hunter
POSTGRES_USER=memecoin_user
POSTGRES_PASSWORD=your_password

# Price Monitor
PRICE_MONITOR_INTERVAL_MS=45000  # 45 seconds
```

**📝 Note:** Sistem sekarang menggunakan **seed phrase (mnemonic)** dari Trust Wallet. Lihat [Wallet Setup Documentation](./WALLET_SETUP.md) untuk detail lengkap.

## 🚀 Setup & Deployment

### 1. Run Migrations

```bash
./scripts/run_migrations.sh
```

Atau manual:
```bash
psql -h localhost -U memecoin_user -d memecoin_hunter -f scripts/migrations/create_positions_table.sql
```

### 2. Configure Environment

Update `.env` file dengan:
- `WALLET_PRIVATE_KEY`
- `BSC_RPC_URL` (optional, default provided)
- Database credentials (jika berbeda)

### 3. Start Services

```bash
docker-compose up -d trade-engine dex-price-monitor telegram-bot
```

### 4. Verify Services

```bash
docker-compose logs -f trade-engine
docker-compose logs -f dex-price-monitor
docker-compose logs -f telegram-bot
```

## 📝 Usage Examples

### Buy Token via Telegram

```
/buy 0x1234567890123456789012345678901234567890
```

### Check Positions

```
/positions
```

### Check Status

```
/status 0x1234567890123456789012345678901234567890
```

### Sell Position

```
/sell 0x1234567890123456789012345678901234567890
```

## ⚠️ Important Notes

1. **One Position Per Token**: Sistem hanya membolehkan satu open position per token
2. **Slippage**: Default 5%, bisa diubah di code jika diperlukan
3. **Gas Limit**: Default 500000 untuk swap operations
4. **Network**: Hanya BSC (Binance Smart Chain) untuk saat ini
5. **Stablecoin**: Menggunakan BUSD sebagai stablecoin untuk swap

## 🔧 Troubleshooting

### Position tidak ter-update

- Cek logs dex-price-monitor: `docker-compose logs dex-price-monitor`
- Verify DexScreener API response
- Check database connection

### Swap failed

- Cek wallet balance (BUSD/BNB)
- Verify token address
- Check liquidity di PancakeSwap
- Review gas limit settings

### Sell tidak trigger

- Verify highest_price_ever sudah >= $50
- Check current_price vs profit_floor
- Review logs untuk error messages


# Phase 5 - Automation with n8n

## Overview

Workflow n8n untuk memantau hasil analyzer dan mengirim notifikasi Telegram ketika ditemukan meme coin dengan score tinggi.

## Workflow Features

1. **Cron Trigger**: Berjalan setiap 2 menit
2. **Database Query**: Query analyses terbaru (last 2 minutes) dengan score >= threshold
3. **Conditional Logic**: Hanya kirim notifikasi jika ada hasil
4. **Telegram Notification**: Kirim alert dengan detail coin

## Setup Instructions

### 1. Import Workflow ke n8n

1. Buka n8n di browser (http://your-n8n-url)
2. Login ke n8n
3. Klik **"Workflows"** di sidebar
4. Klik **"Import from File"** atau **"Import from URL"**
5. Pilih file: `workflows/n8n-memecoin-monitor-simple.json`
6. Workflow akan di-import dan muncul di daftar workflows

### 2. Configure Credentials

#### PostgreSQL Credential

1. Klik workflow yang baru di-import
2. Klik node **"Query High Score Coins"**
3. Di bagian **"Credential to connect with"**, klik **"Create New Credential"**
4. Pilih **"PostgreSQL"**
5. Isi dengan data berikut:

```
Host: postgres (atau IP container postgres)
Database: memecoin_hunter
User: memecoin_user
Password: [POSTGRES_PASSWORD dari .env]
Port: 5432
SSL: Disable (atau sesuai konfigurasi)
```

6. Klik **"Save"**

#### Telegram Credential

1. Klik node **"Send Telegram"**
2. Di bagian **"Credential to connect with"**, klik **"Create New Credential"**
3. Pilih **"Telegram"**
4. Isi dengan:

```
Access Token: [TELEGRAM_BOT_TOKEN dari .env]
```

5. Klik **"Save"**

### 3. Configure Environment Variables (Optional)

Jika ingin menggunakan environment variables untuk threshold:

1. Di n8n, buka **Settings** → **Environment Variables**
2. Tambahkan:

```
HIGH_SCORE_THRESHOLD=70
TELEGRAM_CHAT_ID=your_chat_id
```

3. Update query di node **"Query High Score Coins"**:

```sql
SELECT a.id, a.coin_id, a.overall_score, a.price_score, a.volume_score, a.social_score, a.risk_score, a.created_at, c.address, c.symbol, c.name, c.chain_id, c.liquidity, c.volume24h 
FROM analyses a 
INNER JOIN coins c ON a.coin_id = c.id 
WHERE a.created_at >= NOW() - INTERVAL '2 minutes' 
  AND a.overall_score >= {{ $env.HIGH_SCORE_THRESHOLD || 70 }} 
ORDER BY a.created_at DESC 
LIMIT 10
```

### 4. Configure Telegram Chat ID

1. Klik node **"Send Telegram"**
2. Di field **"Chat ID"**, isi dengan chat ID Telegram Anda

   Cara mendapatkan Chat ID:
   - Kirim pesan ke bot Telegram Anda
   - Buka URL: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Cari `"chat":{"id":123456789}` - angka ini adalah Chat ID

   Atau gunakan environment variable: `{{ $env.TELEGRAM_CHAT_ID }}`

### 5. Activate Workflow

1. Klik tombol **"Active"** di kanan atas workflow
2. Workflow akan mulai berjalan setiap 2 menit

## Workflow Flow

```
[Cron Trigger: Every 2 minutes]
         ↓
[Query High Score Coins from DB]
         ↓
[Check If Has Results]
    ↓           ↓
 Yes          No
    ↓           ↓
[Format Message] [Skip]
    ↓
[Send Telegram]
```

## Customization

### Change Cron Interval

1. Klik node **"Every 2 Minutes"**
2. Ubah **"Minutes Interval"** sesuai kebutuhan (misalnya 5 untuk 5 menit)

### Change Score Threshold

1. Klik node **"Query High Score Coins"**
2. Ubah nilai `70` di query SQL menjadi threshold yang diinginkan:

```sql
WHERE ... AND a.overall_score >= 75  -- Ubah 70 menjadi 75
```

### Customize Message Format

1. Klik node **"Format Message"**
2. Edit JavaScript code sesuai format yang diinginkan

### Add More Filters

Anda bisa menambahkan filter tambahan di SQL query, misalnya:

```sql
-- Hanya coin dengan liquidity > $10000
AND c.liquidity::numeric > 10000

-- Hanya coin dari chain tertentu
AND c.chain_id = 1  -- 1 = Ethereum

-- Hanya coin dengan volume 24h > threshold
AND c.volume24h::numeric > 50000
```

## Environment Variables Mapping

| n8n Variable | Description | Default | Source |
|-------------|-------------|---------|--------|
| `HIGH_SCORE_THRESHOLD` | Minimum score untuk notifikasi | 70 | `.env` (optional) |
| `TELEGRAM_CHAT_ID` | Chat ID untuk mengirim notifikasi | - | `.env` |
| `POSTGRES_HOST` | PostgreSQL host | postgres | Docker network |
| `POSTGRES_DB` | Database name | memecoin_hunter | `.env` |
| `POSTGRES_USER` | Database user | memecoin_user | `.env` |
| `POSTGRES_PASSWORD` | Database password | - | `.env` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | - | `.env` |

## Troubleshooting

### Workflow tidak berjalan

1. Pastikan workflow sudah di-activate (tombol Active ON)
2. Check execution history di n8n untuk melihat error

### Database connection error

1. Pastikan credential PostgreSQL sudah benar
2. Pastikan n8n bisa akses database (same Docker network)
3. Test connection di node PostgreSQL

### Telegram not sent

1. Pastikan Telegram credential sudah benar (bot token valid)
2. Pastikan Chat ID sudah benar
3. Pastikan bot sudah dikirim pesan terlebih dahulu (untuk initiate chat)

### No results found

1. Pastikan analyzer sudah running dan menghasilkan data
2. Check database apakah ada data di table `analyses`
3. Coba ubah threshold score lebih rendah untuk testing
4. Check query SQL di node untuk memastikan filter benar

## Advanced: Webhook-based Workflow (Optional)

Jika ingin workflow yang lebih real-time, bisa menggunakan webhook:

1. Ganti Cron Trigger dengan Webhook trigger
2. Analyzer service bisa call webhook setelah menyelesaikan analysis
3. Webhook URL bisa di-expose via Cloudflared atau reverse proxy

Untuk implementasi ini, perlu modifikasi analyzer service untuk call webhook.

## Files

- `workflows/n8n-memecoin-monitor-simple.json` - Workflow utama (recommended)
- `workflows/n8n-memecoin-monitor.json` - Workflow dengan environment variables

## Next Steps

Setelah workflow berjalan:
1. Monitor execution history di n8n
2. Adjust threshold sesuai kebutuhan
3. Customize message format sesuai preferensi
4. Add additional filters atau logic sesuai kebutuhan


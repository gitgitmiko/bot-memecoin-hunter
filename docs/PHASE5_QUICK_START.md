# Phase 5 - n8n Workflow Quick Start

Quick start guide untuk setup n8n workflow automation.

## Prerequisites

- n8n sudah running (Phase 2)
- Database sudah ada data analyses
- Telegram bot token sudah ada

## Quick Setup

### 1. Import Workflow

1. Buka n8n di browser
2. Login ke n8n
3. Klik **"Workflows"** → **"Import from File"**
4. Pilih: `workflows/n8n-memecoin-monitor-simple.json`

### 2. Setup Credentials

#### PostgreSQL

1. Klik node **"Query High Score Coins"**
2. Create credential:
   - Host: `postgres`
   - Database: `memecoin_hunter`
   - User: `memecoin_user`
   - Password: (dari .env)
   - Port: `5432`

#### Telegram

1. Klik node **"Send Telegram"**
2. Create credential:
   - Access Token: (dari .env `TELEGRAM_BOT_TOKEN`)

### 3. Configure Chat ID

1. Klik node **"Send Telegram"**
2. Set Chat ID (atau gunakan `{{ $env.TELEGRAM_CHAT_ID }}`)
3. Untuk mendapatkan Chat ID:
   ```bash
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```

### 4. Activate

1. Klik **"Active"** button di kanan atas
2. Workflow akan berjalan setiap 2 menit

## Customization

### Change Interval

Edit node **"Every 2 Minutes"** → ubah **"Minutes Interval"**

### Change Score Threshold

Edit node **"Query High Score Coins"** → ubah query SQL:

```sql
WHERE ... AND a.overall_score >= 75  -- Ubah 70 menjadi 75
```

## Troubleshooting

Lihat dokumentasi lengkap: [PHASE5_N8N_WORKFLOW.md](./docs/PHASE5_N8N_WORKFLOW.md)


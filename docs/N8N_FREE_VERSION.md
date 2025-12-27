# n8n Free/Community Version - Configuration Guide

## 🎯 Informasi Penting

Anda menggunakan **n8n versi gratis/self-hosted** yang tidak memiliki fitur Environment Variables seperti versi berbayar.

## ✅ Workflow yang Tepat

Untuk versi gratis, gunakan workflow **"n8n-memecoin-monitor-simple.json"** yang **TIDAK menggunakan environment variables**.

### Workflow Simple (Recommended untuk Free Version)

**File:** `workflows/n8n-memecoin-monitor-simple.json`

**Keuntungan:**
- ✅ Tidak menggunakan environment variables
- ✅ Semua nilai hardcoded atau manual input
- ✅ Compatible dengan versi gratis n8n
- ✅ Lebih mudah setup

**Konfigurasi:**
- Score threshold: **Hardcoded** di SQL query (`>= 70`)
- Chat ID: **Manual input** di node "Send Telegram"
- Database credentials: **Manual setup** di n8n UI
- Telegram credentials: **Manual setup** di n8n UI

### Workflow dengan Env Vars (TIDAK DIGUNAKAN)

**File:** `workflows/n8n-memecoin-monitor.json`

**Note:** Workflow ini menggunakan `{{ $env.HIGH_SCORE_THRESHOLD }}` yang tidak tersedia di versi gratis.

**Jangan gunakan** workflow ini untuk versi gratis n8n.

## 📋 Setup untuk Free Version

### 1. Import Workflow

1. Buka n8n UI
2. Klik **"Workflows"** → **"Import from File"**
3. Pilih: `workflows/n8n-memecoin-monitor-simple.json`
4. **JANGAN** import `n8n-memecoin-monitor.json` (pakai env vars)

### 2. Setup PostgreSQL Credential

1. Klik node **"Query High Score Coins"**
2. Create credential PostgreSQL:
   ```
   Host: postgres
   Database: memecoin_hunter
   User: memecoin_user
   Password: [dari .env file POSTGRES_PASSWORD]
   Port: 5432
   SSL: Disable
   ```

### 3. Setup Telegram Credential

1. Klik node **"Send Telegram"**
2. Create credential Telegram:
   ```
   Access Token: [dari .env file TELEGRAM_BOT_TOKEN]
   ```

### 4. Setup Chat ID (Manual Input)

1. Klik node **"Send Telegram"**
2. Di field **"Chat ID"**, isi dengan chat ID Anda (contoh: `123456789`)
3. **Bukan expression**, tapi langsung angka
4. Untuk mendapatkan Chat ID:
   ```bash
   ./scripts/get_telegram_chat_id.sh
   ```
   Atau gunakan `@userinfobot` di Telegram

### 5. Configure Score Threshold (Jika Perlu)

Jika ingin mengubah score threshold (default: 70):

1. Klik node **"Query High Score Coins"**
2. Edit SQL query, ubah nilai `70`:
   ```sql
   WHERE ... AND a.overall_score >= 75  -- Ubah 70 menjadi 75
   ```
3. Save workflow (Publish)

### 6. Activate Workflow

1. Klik toggle **"Active"** di kanan atas (harus hijau/ON)
2. Workflow akan jalan setiap 2 menit

## 🔍 Perbedaan Workflow Simple vs Non-Simple

### Workflow Simple (Free Version)

```sql
-- Score threshold hardcoded
WHERE ... AND a.overall_score >= 70
```

```json
{
  "chatId": "",  // Manual input di UI
  "text": "={{ $json.message }}"
}
```

### Workflow Non-Simple (Paid Version)

```sql
-- Score threshold dari env var
WHERE ... AND a.overall_score >= {{ $env.HIGH_SCORE_THRESHOLD || 70 }}
```

```json
{
  "chatId": "={{ $env.TELEGRAM_CHAT_ID }}",  // Dari env var
  "text": "={{ $json.message }}"
}
```

## ✅ Checklist untuk Free Version

- [ ] Import workflow: `n8n-memecoin-monitor-simple.json` (bukan yang pakai env vars)
- [ ] PostgreSQL credential sudah di-set (manual)
- [ ] Telegram credential sudah di-set (manual)
- [ ] Chat ID sudah diisi (manual input, bukan expression)
- [ ] Score threshold di-hardcode di SQL query (default: 70)
- [ ] Workflow aktif (toggle Active ON)
- [ ] Cron trigger: "Every 2 Minutes"

## 🎯 Konfigurasi Manual yang Diperlukan

Karena tidak ada environment variables, semua harus di-set manual:

| Item | Cara Setup | Lokasi |
|------|------------|--------|
| **Database Connection** | Manual credential | Node "Query High Score Coins" |
| **Telegram Bot Token** | Manual credential | Node "Send Telegram" |
| **Chat ID** | Manual input | Node "Send Telegram" → Chat ID field |
| **Score Threshold** | Hardcode di SQL | Node "Query High Score Coins" → SQL query |
| **Cron Interval** | Hardcode di node | Node "Every 2 Minutes" → Minutes Interval |

## ⚠️ Common Mistakes dengan Free Version

### ❌ SALAH: Menggunakan Expression dengan Env Var

```json
// TIDAK BEKERJA di free version
"chatId": "={{ $env.TELEGRAM_CHAT_ID }}"
"query": "WHERE score >= {{ $env.HIGH_SCORE_THRESHOLD }}"
```

### ✅ BENAR: Manual Input atau Hardcoded

```json
// BEKERJA di free version
"chatId": "123456789"  // Langsung value
"query": "WHERE score >= 70"  // Hardcoded
```

## 🔧 Cara Mengubah Konfigurasi

Karena tidak ada env vars, untuk mengubah konfigurasi:

### Mengubah Score Threshold

1. Buka workflow di n8n
2. Klik node **"Query High Score Coins"**
3. Edit SQL query, ubah `70` menjadi nilai yang diinginkan
4. Save workflow (Publish)

### Mengubah Chat ID

1. Buka workflow di n8n
2. Klik node **"Send Telegram"**
3. Edit field **"Chat ID"**, ganti dengan chat ID baru
4. Save workflow (Publish)

### Mengubah Cron Interval

1. Buka workflow di n8n
2. Klik node **"Every 2 Minutes"**
3. Edit **"Minutes Interval"**, ubah dari `2` menjadi nilai yang diinginkan
4. Save workflow (Publish)

## 📝 Notes

1. **Tidak perlu setup environment variables** di n8n untuk workflow simple
2. **Semua nilai di-hardcode atau manual input** di n8n UI
3. **Workflow simple sudah optimized** untuk free version
4. **Jika perlu ubah config**, edit langsung di workflow node

## 🔗 Related Documentation

- Setup Workflow: `docs/PHASE5_N8N_WORKFLOW.md`
- Aktivasi Workflow: `docs/N8N_ACTIVATE_WORKFLOW.md`
- Troubleshooting Cron: `docs/N8N_CRON_NOT_RUNNING.md`


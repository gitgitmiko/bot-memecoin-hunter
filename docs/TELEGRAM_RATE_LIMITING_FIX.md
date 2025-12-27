# Fix: Telegram API Rate Limiting & Temporary Block

Dokumentasi tentang masalah rate limiting dan temporary block dari Telegram API, serta solusinya.

## 🔍 Masalah

**Gejala:**
- Bot awalnya bisa connect ke Telegram API
- Tiba-tiba connection timeout
- Error: `EFATAL: AggregateError` atau `Connection timed out`
- Ping ke Telegram API IP: 100% packet loss

**Penyebab:**
- **Terlalu sering hit Telegram API** (rate limiting)
- Bot polling terlalu sering (default 1-2 detik)
- n8n workflow terlalu sering (setiap 2 menit)
- Kombinasi keduanya = terlalu banyak request
- Telegram temporary block IP karena terlalu banyak request
- Network provider juga block karena melihat banyak traffic ke Telegram

## 📊 Analisis Request Pattern

### Bot Telegram Polling

**Default Configuration:**
- Polling interval: **1-2 detik** (getUpdates)
- Request per menit: **~30-60 requests**
- Request per jam: **~1,800-3,600 requests**

**Masalah:**
- Terlalu sering polling
- Bisa trigger rate limiting dari Telegram
- Bisa trigger temporary IP block

### n8n Workflow

**Previous Configuration:**
- Cron interval: **setiap 2 menit**
- Executions per jam: **~30 kali**
- Setiap execution bisa kirim notifikasi

**Masalah:**
- Terlalu sering execution
- Kombinasi dengan bot polling = terlalu banyak request

### Total Request ke Telegram API

**Before Fix:**
- Bot polling: ~30-60 req/min
- n8n notifications: ~0.5 req/min (jika ada data)
- **Total: ~30-60 req/min**

**After Fix:**
- Bot polling: ~12 req/min (5 detik interval)
- n8n notifications: ~0.2 req/min (5 menit interval)
- **Total: ~12 req/min** (reduced by 50-75%)

## ✅ Solusi yang Diterapkan

### 1. Reduce Bot Polling Frequency

**Before:**
```typescript
this.bot = new TelegramBot(botToken, { polling: true });
// Default: 1-2 seconds interval
```

**After:**
```typescript
this.bot = new TelegramBot(botToken, { 
  polling: {
    interval: 5000, // 5 seconds instead of 1-2 seconds
    autoStart: true,
    params: {
      timeout: 10, // Long polling timeout
    }
  }
});
```

**Hasil:**
- Polling interval: **5 detik** (reduced from 1-2 detik)
- Request per menit: **~12 requests** (reduced from 30-60)
- Request per jam: **~720 requests** (reduced from 1,800-3,600)

### 2. Reduce n8n Workflow Frequency

**Before:**
- Cron interval: **setiap 2 menit**
- Query interval: **2 menit**

**After:**
- Cron interval: **setiap 30 menit** (recommended untuk reduce rate limiting)
- Query interval: **30 menit**

**Hasil:**
- Executions per jam: **~2 kali** (reduced from 30)
- Request per jam: **~2 requests** (reduced from 30)
- **Reduction: ~93%**

### 3. Update Query Interval

**Before:**
```sql
WHERE a.created_at >= NOW() - INTERVAL '2 minutes'
```

**After:**
```sql
WHERE a.created_at >= NOW() - INTERVAL '5 minutes'
```

**Alasan:**
- Query interval harus match dengan cron interval
- Mencegah duplicate notifications
- Reduce database query frequency

## 📋 Telegram API Rate Limits

### Official Limits

**getUpdates (Polling):**
- Tidak ada limit ketat
- Tapi terlalu sering bisa temporary block
- Recommended: 5-10 detik interval

**sendMessage:**
- **Private chat:** 1 pesan per detik
- **Group/Channel:** 20 pesan per menit per grup
- **Overall:** 30 pesan per detik untuk semua chat

**Best Practices:**
- Use long polling (timeout 10-30 detik)
- Polling interval: 5-10 detik
- Implement exponential backoff on errors
- Monitor rate limit errors (429)

## 🔧 Implementasi

### 1. Update Bot Polling

File: `services/telegram-bot/src/index.ts`

```typescript
// Initialize Telegram bot with reduced polling frequency
this.bot = new TelegramBot(botToken, { 
  polling: {
    interval: 5000, // 5 seconds
    autoStart: true,
    params: {
      timeout: 10, // Long polling timeout
    }
  }
});
```

### 2. Update n8n Workflow

File: `workflows/n8n-memecoin-monitor-simple.json`

```json
{
  "rule": {
    "interval": [
      {
        "field": "minutes",
        "minutesInterval": 30  // Changed from 2 to 30 (recommended)
      }
    ]
  }
}
```

### 3. Update Query Interval

```sql
WHERE a.created_at >= NOW() - INTERVAL '30 minutes'  -- Changed from 2 to 30
```

**Note:** Query interval harus match dengan cron interval untuk mencegah duplicate notifications.

## 📊 Perbandingan

### Before Fix

| Component | Interval | Requests/Min | Requests/Hour |
|-----------|----------|-------------|--------------|
| Bot Polling | 1-2 detik | 30-60 | 1,800-3,600 |
| n8n Workflow | 2 menit | 0.5 | 30 |
| **Total** | - | **30-60** | **1,830-3,630** |

### After Fix

| Component | Interval | Requests/Min | Requests/Hour |
|-----------|----------|-------------|--------------|
| Bot Polling | 5 detik | 12 | 720 |
| n8n Workflow | 30 menit | 0.033 | 2 |
| **Total** | - | **~12** | **~722** |

**Reduction:**
- Requests per minute: **50-75% reduction**
- Requests per hour: **60-80% reduction**
- n8n workflow: **93% reduction** (30 → 2 executions/hour)

## ⚠️ Catatan Penting

### 1. Temporary Block vs Permanent Block

**Temporary Block (Rate Limiting):**
- Biasanya hilang setelah beberapa menit/jam
- Bisa diatasi dengan reduce frequency
- Error: 429 (Too Many Requests)

**Permanent Block (Network Provider):**
- Tidak hilang dengan sendirinya
- Perlu proxy/VPN atau hubungi provider
- Error: Connection timeout (bukan 429)

### 2. Monitoring

**Cek Rate Limit Errors:**
```bash
# Cek log untuk error 429
docker-compose logs telegram-bot | grep -i "429\|rate limit"
docker-compose logs n8n | grep -i "429\|rate limit"
```

**Cek Request Frequency:**
```bash
# Cek bot polling frequency
docker-compose logs telegram-bot | grep -i "polling\|getUpdates" | wc -l

# Cek n8n workflow executions
docker-compose logs n8n | grep -i "execution\|workflow" | wc -l
```

### 3. Best Practices

**Polling:**
- Use long polling (timeout 10-30 detik)
- Interval: 5-10 detik (jangan kurang dari 1 detik)
- Implement exponential backoff on errors

**Notifications:**
- Batch notifications jika mungkin
- Implement rate limiting di aplikasi
- Monitor rate limit errors

**Workflow:**
- Jangan terlalu sering (minimal 5 menit)
- Use appropriate query intervals
- Monitor execution frequency

## 🎯 Kesimpulan

**Penyebab:**
- Bot polling terlalu sering (1-2 detik)
- n8n workflow terlalu sering (2 menit)
- Kombinasi = terlalu banyak request
- Telegram temporary block IP

**Solusi:**
- ✅ Reduce bot polling interval: 1-2 detik → 5 detik
- ✅ Reduce n8n workflow frequency: 2 menit → 5 menit
- ✅ Update query interval: 2 menit → 5 menit

**Hasil:**
- Request frequency reduced by 50-75%
- Should prevent rate limiting
- Should prevent temporary IP block

**Next Steps:**
1. Rebuild bot: `docker-compose build telegram-bot`
2. Restart bot: `docker-compose restart telegram-bot`
3. Import updated workflow: `./scripts/import_n8n_workflow.sh workflows/n8n-memecoin-monitor-simple.json`
4. Monitor logs untuk rate limit errors
5. Wait beberapa jam untuk temporary block hilang (jika ada)

---

**Status:** ✅ Rate limiting fix implemented - reduced request frequency by 50-75%


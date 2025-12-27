# Cara Mengecek Log Services

Dokumentasi lengkap tentang cara mengecek log dari semua services di Bot Memecoin Hunter.

## 📋 Services yang Tersedia

- **crawler** - Service untuk crawl data dari DexScreener
- **analyzer** - Service untuk menganalisis coin
- **telegram-bot** - Service Telegram bot
- **postgres** - Database PostgreSQL
- **redis** - Redis queue
- **n8n** - n8n workflow automation

## 🔍 Cara Mengecek Log

### 1. Log Crawler

**Real-time (follow):**
```bash
docker-compose logs -f crawler
```

**Log terakhir (50 baris):**
```bash
docker-compose logs --tail 50 crawler
```

**Log dengan timestamp:**
```bash
docker-compose logs -f --timestamps crawler
```

**Log dengan filter:**
```bash
# Cari error
docker-compose logs crawler | grep -i error

# Cari coin yang ditemukan
docker-compose logs crawler | grep -i "found\|discovered"

# Cari API calls
docker-compose logs crawler | grep -i "api\|fetch"
```

### 2. Log Analyzer

**Real-time (follow):**
```bash
docker-compose logs -f analyzer
```

**Log terakhir (50 baris):**
```bash
docker-compose logs --tail 50 analyzer
```

**Log dengan timestamp:**
```bash
docker-compose logs -f --timestamps analyzer
```

**Log dengan filter:**
```bash
# Cari analysis results
docker-compose logs analyzer | grep -i "score\|analysis"

# Cari error
docker-compose logs analyzer | grep -i error

# Cari coin yang sedang dianalisis
docker-compose logs analyzer | grep -i "analyzing\|processing"

# Cari analysis yang selesai
docker-compose logs analyzer | grep -i "complete\|stored"

# Cari score tertentu
docker-compose logs analyzer | grep -E "Score [0-9]+"
```

**Save log ke file:**
```bash
docker-compose logs analyzer > analyzer_$(date +%Y%m%d_%H%M%S).log
```

### 3. Log Telegram Bot

**Real-time:**
```bash
docker-compose logs -f telegram-bot
```

**Log terakhir:**
```bash
docker-compose logs --tail 50 telegram-bot
```

### 4. Log Semua Services

**Real-time semua services:**
```bash
docker-compose logs -f
```

**Log terakhir semua services:**
```bash
docker-compose logs --tail 50
```

**Log dengan timestamp:**
```bash
docker-compose logs -f --timestamps
```

### 5. Log n8n

**Real-time:**
```bash
docker-compose logs -f n8n
```

**Log terakhir:**
```bash
docker-compose logs --tail 100 n8n
```

### 6. Log Database (PostgreSQL)

**Real-time:**
```bash
docker-compose logs -f postgres
```

**Log dengan filter:**
```bash
# Cari error
docker-compose logs postgres | grep -i error

# Cari query
docker-compose logs postgres | grep -i "query\|statement"
```

### 7. Log Redis

**Real-time:**
```bash
docker-compose logs -f redis
```

## 🔧 Tips & Tricks

### Filter Log dengan grep

**Cari error di semua services:**
```bash
docker-compose logs | grep -i error
```

**Cari pattern tertentu:**
```bash
docker-compose logs crawler | grep -E "Found|Error|API"
```

**Cari dengan context (5 baris sebelum/sesudah):**
```bash
docker-compose logs crawler | grep -A 5 -B 5 "error"
```

### Save Log ke File

**Save log crawler:**
```bash
docker-compose logs crawler > crawler.log
```

**Save log dengan timestamp:**
```bash
docker-compose logs --timestamps crawler > crawler_$(date +%Y%m%d_%H%M%S).log
```

### Clear Log (Hati-hati!)

**Clear log container (tidak disarankan):**
```bash
# Hanya clear log di memory, tidak menghapus file
docker-compose logs --tail 0 crawler
```

**Note:** Log di Docker biasanya disimpan di `/var/lib/docker/containers/`. Untuk clear log, lebih baik restart container.

## 📊 Contoh Output Log

### Crawler Log
```
crawler  | [2025-12-27 09:00:00] INFO: Starting crawler cycle...
crawler  | [2025-12-27 09:00:01] INFO: Fetching new pairs from DexScreener...
crawler  | [2025-12-27 09:00:02] INFO: Found 5 new pairs
crawler  | [2025-12-27 09:00:03] INFO: Stored 5 coins to database
crawler  | [2025-12-27 09:00:04] INFO: Published 5 coins to queue
```

### Analyzer Log
```
analyzer | [2025-12-27 09:00:05] INFO: Processing coin: 0x1234...
analyzer | [2025-12-27 09:00:06] INFO: Analysis complete: Score 75
analyzer | [2025-12-27 09:00:07] INFO: Stored analysis to database
```

## 🐛 Troubleshooting

### Problem: Log tidak muncul

**Penyebab:**
- Container tidak running
- Log level terlalu tinggi

**Solusi:**
```bash
# Cek status container
docker-compose ps

# Cek log dengan detail
docker-compose logs --details crawler
```

### Problem: Log terlalu banyak

**Solusi:**
```bash
# Hanya tampilkan log terakhir
docker-compose logs --tail 20 crawler

# Filter dengan grep
docker-compose logs crawler | grep -i "error\|warn"
```

### Problem: Log hilang setelah restart

**Penyebab:**
- Log hanya di memory container
- Tidak ada log rotation

**Solusi:**
- Gunakan Docker log driver untuk persistent logs
- Atau save log ke file sebelum restart

## 📝 Best Practices

1. **Gunakan `-f` untuk real-time monitoring**
   ```bash
   docker-compose logs -f crawler
   ```

2. **Gunakan `--tail` untuk limit output**
   ```bash
   docker-compose logs --tail 50 crawler
   ```

3. **Gunakan `--timestamps` untuk melihat waktu**
   ```bash
   docker-compose logs -f --timestamps crawler
   ```

4. **Filter dengan grep untuk fokus**
   ```bash
   docker-compose logs crawler | grep -i error
   ```

5. **Save log penting ke file**
   ```bash
   docker-compose logs crawler > crawler_$(date +%Y%m%d).log
   ```

## 🎯 Quick Reference

| Command | Description |
|---------|-------------|
| `docker-compose logs -f crawler` | Real-time log crawler |
| `docker-compose logs --tail 50 crawler` | 50 baris terakhir |
| `docker-compose logs crawler \| grep error` | Filter error |
| `docker-compose logs -f --timestamps` | Log dengan timestamp |
| `docker-compose logs > all.log` | Save semua log |

---

**Status:** ✅ Dokumentasi lengkap untuk mengecek log semua services


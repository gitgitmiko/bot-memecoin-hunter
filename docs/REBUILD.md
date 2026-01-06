# 🔨 Panduan Rebuild Services

Dokumentasi ini menjelaskan cara rebuild service setelah melakukan perubahan kode.

## 📋 Daftar Services

- `telegram-bot` - Telegram bot service
- `trade-engine` - Trading engine service
- `dex-price-monitor` - Price monitoring service
- `crawler` - Data crawler service
- `analyzer` - Coin analyzer service

## 🚀 Cara Rebuild

### 1. Rebuild Service Tertentu

```bash
# Rebuild telegram-bot
docker-compose build telegram-bot
docker-compose restart telegram-bot

# Rebuild trade-engine
docker-compose build trade-engine
docker-compose restart trade-engine

# Rebuild dex-price-monitor
docker-compose build dex-price-monitor
docker-compose restart dex-price-monitor

# Rebuild crawler
docker-compose build crawler
docker-compose restart crawler

# Rebuild analyzer
docker-compose build analyzer
docker-compose restart analyzer
```

### 2. Menggunakan Script Otomatis

```bash
# Rebuild telegram-bot (sudah tersedia)
./scripts/rebuild-telegram-bot.sh

# Atau dengan path lengkap
bash scripts/rebuild-telegram-bot.sh
```

### 3. Rebuild Semua Services

```bash
# Rebuild semua services
docker-compose build

# Restart semua services
docker-compose restart
```

## 📝 Verifikasi Setelah Rebuild

### Cek Status Container

```bash
docker-compose ps
```

### Cek Logs

```bash
# Logs service tertentu
docker-compose logs --tail=50 telegram-bot

# Logs semua services
docker-compose logs --tail=50
```

### Cek Health Status

```bash
# Health check untuk semua services
docker-compose ps
```

## ⚠️ Catatan Penting

1. **Setelah perubahan kode TypeScript**, selalu rebuild service yang diubah
2. **Restart container** setelah rebuild untuk menerapkan perubahan
3. **Cek logs** setelah restart untuk memastikan tidak ada error
4. **Volume mounting**: Beberapa service menggunakan volume mounting untuk source code, tapi untuk production build harus di-rebuild

## 🔍 Troubleshooting

### Container tidak start setelah rebuild

```bash
# Cek logs untuk error
docker-compose logs telegram-bot

# Cek apakah image berhasil di-build
docker images | grep telegram-bot

# Rebuild tanpa cache
docker-compose build --no-cache telegram-bot
```

### Perubahan tidak terlihat

```bash
# Pastikan container sudah di-restart
docker-compose restart telegram-bot

# Cek apakah file dist sudah ter-update
docker-compose exec telegram-bot ls -la /app/dist
```

## 📚 Referensi

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Dockerfile Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)


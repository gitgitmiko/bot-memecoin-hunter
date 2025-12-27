# Phase 2 - Docker Infrastructure Checklist

Gunakan checklist ini untuk memastikan semua langkah Phase 2 sudah dilakukan dengan benar.

## Pre-Setup
- [ ] Phase 1 sudah selesai (Docker terinstall)
- [ ] File `.env.example` sudah ada
- [ ] Direktori `services/` sudah dibuat

## Environment Configuration
- [ ] File `.env` sudah dibuat dari `.env.example`
- [ ] Semua password sudah di-generate atau diisi
- [ ] `TELEGRAM_BOT_TOKEN` sudah diisi (dari @BotFather)
- [ ] `TELEGRAM_CHAT_ID` sudah diisi (jika diperlukan)
- [ ] Semua environment variables sudah dikonfigurasi

## Docker Setup
- [ ] `docker-compose.yml` sudah ada
- [ ] Semua services sudah didefinisikan
- [ ] Network `memecoin-network` sudah dikonfigurasi
- [ ] Volumes sudah didefinisikan
- [ ] Resource limits sudah dikonfigurasi

## Service Files
- [ ] Dockerfile untuk setiap service sudah ada
- [ ] `package.json` untuk setiap service sudah ada
- [ ] `index.js` untuk setiap service sudah ada
- [ ] `healthcheck.js` untuk setiap service sudah ada
- [ ] `.dockerignore` untuk setiap service sudah ada

## Build & Start
- [ ] Semua Docker images sudah di-build
- [ ] Semua services sudah di-start
- [ ] Semua services status `healthy` atau `running`

## Verification
- [ ] PostgreSQL dapat diakses
- [ ] Redis dapat diakses
- [ ] n8n dapat diakses via browser
- [ ] Crawler service running
- [ ] Analyzer service running
- [ ] Telegram Bot service running

## Network & Volumes
- [ ] Network `memecoin-network` sudah dibuat
- [ ] Volume `postgres_data` sudah dibuat
- [ ] Volume `redis_data` sudah dibuat
- [ ] Volume `n8n_data` sudah dibuat
- [ ] Volume logs untuk setiap service sudah dibuat

## Security
- [ ] File `.env` tidak di-commit ke repository
- [ ] `.gitignore` sudah dikonfigurasi
- [ ] Password sudah kuat dan unik
- [ ] Services tidak expose port yang tidak diperlukan

## Documentation
- [ ] Dokumentasi Phase 2 sudah dibaca
- [ ] Service README sudah dibaca
- [ ] Environment variables sudah dipahami

## Testing Commands

Jalankan perintah berikut untuk verifikasi:

```bash
# Check service status
docker compose ps

# Check logs
docker compose logs -f

# Test PostgreSQL
docker compose exec postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT version();"

# Test Redis
docker compose exec redis redis-cli -a $REDIS_PASSWORD ping

# Check resource usage
docker stats

# Check network
docker network inspect memecoin-network

# Check volumes
docker volume ls | grep memecoin
```

## Notes
- Tanggal setup: ___________
- n8n URL: ___________
- PostgreSQL Password: ___________
- Redis Password: ___________
- n8n Password: ___________
- Issues/Notes: ___________

---

**Status**: ⬜ Not Started | 🟡 In Progress | ✅ Complete


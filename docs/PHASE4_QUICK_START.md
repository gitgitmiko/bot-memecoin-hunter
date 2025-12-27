# Phase 4 Quick Start Guide

Panduan cepat untuk setup Phase 4 tanpa masalah Docker permission.

## ⚡ Quick Setup (Recommended)

### Option 1: Jika sudah dalam docker group

```bash
# Jalankan script langsung
./scripts/quick_setup_phase4.sh

# Start services
docker compose up -d --build

# Check status
docker compose ps

# Monitor logs
docker compose logs -f
```

### Option 2: Jika belum dalam docker group

```bash
# Gunakan newgrp (akan membuat subshell baru)
# Perintah akan berjalan di subshell tersebut
newgrp docker

# Setelah masuk subshell baru, jalankan:
./scripts/quick_setup_phase4.sh
docker compose up -d --build
docker compose ps
```

### Option 3: Manual Step-by-Step

```bash
# 1. Start PostgreSQL
docker compose up -d postgres
sleep 10

# 2. Create schema
docker compose exec -T postgres psql -U memecoin_user -d memecoin_hunter < scripts/create_database_schema.sql

# 3. Install & Build (tidak perlu docker)
cd services/crawler && npm install && npm run build && cd ../..
cd services/analyzer && npm install && npm run build && cd ../..
cd services/telegram-bot && npm install && npm run build && cd ../..

# 4. Start services
docker compose up -d --build
```

## 🔍 Troubleshooting

### newgrp tidak menampilkan output

`newgrp docker` membuat subshell baru, jadi output akan muncul di subshell tersebut. Gunakan Option 1 (quick_setup_phase4.sh) atau Option 3 (manual).

### Check Docker Permission

```bash
# Cek apakah bisa akses docker
docker ps

# Jika error, cek apakah dalam docker group
groups | grep docker

# Jika belum, tambahkan ke group (perlu logout/login)
sudo usermod -aG docker $USER
```

### Check Services Status

```bash
# Check all services
docker compose ps

# Check specific service
docker compose ps crawler
docker compose ps analyzer
docker compose ps telegram-bot

# Check logs
docker compose logs crawler
docker compose logs analyzer
docker compose logs telegram-bot
```

## ✅ Verification

Setelah setup, verify dengan:

```bash
# 1. Check database tables
docker compose exec -T postgres psql -U memecoin_user -d memecoin_hunter -c "\dt"

# 2. Check services are running
docker compose ps

# 3. Check logs for errors
docker compose logs --tail 50
```

## 📝 Notes

- Script `quick_setup_phase4.sh` akan otomatis detect apakah perlu sudo atau tidak
- Jika sudah dalam docker group, akan menggunakan docker langsung
- Jika belum, akan menggunakan sudo (jika tersedia)
- Install dependencies dan build tidak memerlukan docker


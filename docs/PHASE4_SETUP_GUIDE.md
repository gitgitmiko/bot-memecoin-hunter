# Phase 4 Setup Guide

Panduan lengkap untuk setup Phase 4 - Coding Implementation.

## 📋 Prerequisites

- ✅ Phase 1 & 2 sudah selesai
- ✅ Docker & Docker Compose terinstall
- ✅ PostgreSQL & Redis containers running
- ✅ File `.env` sudah dikonfigurasi

## 🚀 Setup Steps

### 1. Setup Database Schema

**Option A: Menggunakan Docker Compose (Recommended)**

```bash
# Pastikan PostgreSQL container running
docker compose up -d postgres

# Tunggu beberapa detik untuk PostgreSQL ready
sleep 5

# Create schema menggunakan script
newgrp docker ./scripts/create_schema.sh
```

**Option B: Manual**

```bash
# Jika sudah dalam docker group
docker compose exec -T postgres psql -U memecoin_user -d memecoin_hunter < scripts/create_database_schema.sql

# Atau jika belum dalam docker group
newgrp docker docker compose exec -T postgres psql -U memecoin_user -d memecoin_hunter < scripts/create_database_schema.sql
```

**Option C: Menggunakan init_databases.sh (untuk create databases juga)**

```bash
newgrp docker ./scripts/init_databases.sh
```

### 2. Install Dependencies & Build

```bash
# Install dependencies untuk semua services
cd services/crawler && npm install
cd ../analyzer && npm install
cd ../telegram-bot && npm install
cd ../..

# Build TypeScript
cd services/crawler && npm run build
cd ../analyzer && npm run build
cd ../telegram-bot && npm run build
cd ../..
```

**Atau gunakan script:**

```bash
newgrp docker ./scripts/setup_phase4.sh
```

### 3. Configure Environment Variables

Pastikan `.env` sudah dikonfigurasi dengan benar:

```env
# Telegram Bot Token (REQUIRED)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Optional: Specific chat ID for alerts
TELEGRAM_CHAT_ID=your_chat_id_here

# PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=memecoin_hunter
POSTGRES_USER=memecoin_user
POSTGRES_PASSWORD=your_password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_password
```

### 4. Start Services

```bash
# Build and start all services
newgrp docker docker compose up -d --build

# Or if already in docker group
docker compose up -d --build
```

### 5. Verify Services

```bash
# Check service status
docker compose ps

# Check logs
docker compose logs -f

# Check specific service logs
docker compose logs -f crawler
docker compose logs -f analyzer
docker compose logs -f telegram-bot
```

## 🔧 Troubleshooting

### Docker Permission Error

Jika mendapat error "permission denied":

```bash
# Gunakan newgrp docker
newgrp docker ./scripts/create_schema.sh

# Atau untuk docker compose commands
newgrp docker docker compose up -d
```

### PostgreSQL Not Running

```bash
# Start PostgreSQL
docker compose up -d postgres

# Wait for it to be ready
sleep 10

# Then run schema creation
docker compose exec -T postgres psql -U memecoin_user -d memecoin_hunter < scripts/create_database_schema.sql
```

### TypeScript Build Errors

```bash
# Check if TypeScript is installed
cd services/crawler
npm list typescript

# If not installed, install dependencies
npm install

# Try building again
npm run build
```

### Missing Dependencies

```bash
# Install dependencies for each service
cd services/crawler && npm install
cd ../analyzer && npm install
cd ../telegram-bot && npm install
```

## 📊 Verify Database Schema

```bash
# List tables
docker compose exec -T postgres psql -U memecoin_user -d memecoin_hunter -c "\dt"

# Check coins table structure
docker compose exec -T postgres psql -U memecoin_user -d memecoin_hunter -c "\d coins"

# Check analyses table structure
docker compose exec -T postgres psql -U memecoin_user -d memecoin_hunter -c "\d analyses"
```

## 🎯 Quick Start Commands

```bash
# Full setup (if PostgreSQL already running)
newgrp docker ./scripts/create_schema.sh
newgrp docker ./scripts/setup_phase4.sh
newgrp docker docker compose up -d --build

# Check everything
docker compose ps
docker compose logs -f
```

## ✅ Verification Checklist

- [ ] Database schema created (`\dt` shows coins, analyses, users, notifications)
- [ ] Dependencies installed (node_modules exists in each service)
- [ ] TypeScript compiled (dist/ folder exists in each service)
- [ ] Environment variables configured (TELEGRAM_BOT_TOKEN set)
- [ ] Services started (docker compose ps shows all services Up)
- [ ] No errors in logs (docker compose logs)

## 📝 Next Steps

Setelah setup selesai:
1. Monitor logs untuk memastikan semua service running
2. Test Telegram bot dengan command `/start`
3. Monitor crawler untuk coin discovery
4. Check analyzer untuk analysis results
5. Verify alerts dikirim ke Telegram

---

**Last Updated**: $(date)


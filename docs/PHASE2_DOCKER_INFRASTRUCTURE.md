# PHASE 2 – DOCKERIZED INFRASTRUCTURE

Dokumentasi lengkap untuk setup infrastruktur Docker yang production-ready untuk Bot Memecoin Hunter.

## 📋 Overview

Infrastruktur ini terdiri dari:
- **PostgreSQL**: Database utama untuk menyimpan data coin, analisis, dan history
- **Redis**: Cache dan message queue untuk komunikasi antar services
- **n8n**: Workflow automation untuk otomasi proses
- **Crawler Service**: Service untuk crawling data meme coin
- **Analyzer Service**: Service untuk menganalisis data yang di-crawl
- **Telegram Bot Service**: Service untuk bot Telegram

## 🏗️ Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│                  Docker Network                         │
│              (memecoin-network)                         │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │PostgreSQL│  │  Redis   │  │   n8n    │            │
│  │  :5432   │  │  :6379   │  │  :5678   │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │             │             │                   │
│       └─────┬───────┴───────┬─────┘                   │
│             │               │                         │
│  ┌──────────▼───┐  ┌────────▼────┐  ┌──────────────┐ │
│  │   Crawler    │  │  Analyzer   │  │ Telegram Bot │ │
│  │   Service    │  │  Service    │  │   Service    │ │
│  └──────────────┘  └─────────────┘  └──────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 📦 Services Detail

### 1. PostgreSQL

**Image**: `postgres:15-alpine`

**Fungsi**:
- Menyimpan data coin yang di-crawl
- Menyimpan hasil analisis
- Menyimpan history dan logs
- Database untuk n8n

**Resource Limits**:
- CPU: 0.5 cores (limit), 0.25 cores (reservation)
- Memory: 512MB (limit), 256MB (reservation)

**Port**: 5432

**Volume**: `postgres_data` - Persistent storage untuk database

**Health Check**: Menggunakan `pg_isready` untuk memastikan database siap

### 2. Redis

**Image**: `redis:7-alpine`

**Fungsi**:
- Cache untuk data yang sering diakses
- Message queue untuk komunikasi antar services
- Session storage
- Rate limiting

**Resource Limits**:
- CPU: 0.25 cores (limit), 0.1 cores (reservation)
- Memory: 256MB (limit), 128MB (reservation)
- Max Memory: 256MB dengan policy `allkeys-lru`

**Port**: 6379

**Volume**: `redis_data` - Persistent storage untuk Redis data

**Health Check**: Menggunakan `redis-cli ping`

### 3. n8n

**Image**: `n8nio/n8n:latest`

**Fungsi**:
- Workflow automation
- Integration dengan external APIs
- Scheduled tasks
- Webhook handling

**Resource Limits**:
- CPU: 1.0 cores (limit), 0.5 cores (reservation)
- Memory: 1GB (limit), 512MB (reservation)

**Port**: 5678

**Volume**: `n8n_data` - Persistent storage untuk workflows dan credentials

**Health Check**: HTTP check ke `/healthz` endpoint

**Authentication**: Basic Auth (username/password)

### 4. Crawler Service

**Image**: Custom build dari `./services/crawler`

**Fungsi**:
- Crawling data meme coin dari berbagai sumber
- Menyimpan data ke PostgreSQL
- Mengirim notifikasi ke Redis queue

**Resource Limits**:
- CPU: 1.0 cores (limit), 0.5 cores (reservation)
- Memory: 1GB (limit), 512MB (reservation)

**Volume**: 
- `crawler_logs` - Log files
- `./services/crawler` - Source code (development)

**Dependencies**: PostgreSQL, Redis

**Health Check**: Custom healthcheck script

### 5. Analyzer Service

**Image**: Custom build dari `./services/analyzer`

**Fungsi**:
- Menganalisis data yang di-crawl
- Menghitung metrics dan scores
- Mengidentifikasi opportunities
- Mengirim hasil ke Telegram bot

**Resource Limits**:
- CPU: 1.0 cores (limit), 0.5 cores (reservation)
- Memory: 1GB (limit), 512MB (reservation)

**Volume**: 
- `analyzer_logs` - Log files
- `./services/analyzer` - Source code (development)

**Dependencies**: PostgreSQL, Redis

**Health Check**: Custom healthcheck script

### 6. Telegram Bot Service

**Image**: Custom build dari `./services/telegram-bot`

**Fungsi**:
- Menangani command dari user Telegram
- Mengirim notifikasi hasil analisis
- Menyediakan dashboard dan reports

**Resource Limits**:
- CPU: 0.5 cores (limit), 0.25 cores (reservation)
- Memory: 512MB (limit), 256MB (reservation)

**Volume**: 
- `telegram_bot_logs` - Log files
- `./services/telegram-bot` - Source code (development)

**Dependencies**: PostgreSQL, Redis

**Health Check**: Custom healthcheck script

## 🔧 Setup

### 1. Persiapan Environment

```bash
# Copy file .env.example ke .env
cp .env.example .env

# Edit file .env dengan konfigurasi Anda
nano .env
```

**PENTING**: Ganti semua password dan token dengan nilai yang kuat!

### 2. Generate Strong Passwords

```bash
# Generate password untuk PostgreSQL
openssl rand -base64 32

# Generate password untuk Redis
openssl rand -base64 32

# Generate password untuk n8n
openssl rand -base64 32
```

### 3. Setup Telegram Bot

1. Buka Telegram dan cari `@BotFather`
2. Kirim command `/newbot`
3. Ikuti instruksi untuk membuat bot
4. Copy token yang diberikan
5. Masukkan token ke file `.env` sebagai `TELEGRAM_BOT_TOKEN`

### 4. Build dan Start Services

```bash
# Build semua custom services
docker compose build

# Start semua services
docker compose up -d

# Cek status semua services
docker compose ps

# Lihat logs
docker compose logs -f
```

### 5. Verifikasi Services

```bash
# Cek health status
docker compose ps

# Test PostgreSQL connection
docker compose exec postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT version();"

# Test Redis connection
docker compose exec redis redis-cli -a $REDIS_PASSWORD ping

# Cek n8n (buka browser)
# http://your-server-ip:5678
```

## 🌐 Network Configuration

### Network: `memecoin-network`

- **Type**: Bridge network
- **Subnet**: 172.28.0.0/16
- **Purpose**: Isolasi network untuk semua services
- **DNS**: Automatic service discovery menggunakan service names

### Service Discovery

Services dapat saling berkomunikasi menggunakan service names:
- `postgres` - untuk PostgreSQL
- `redis` - untuk Redis
- `n8n` - untuk n8n
- `crawler` - untuk Crawler service
- `analyzer` - untuk Analyzer service
- `telegram-bot` - untuk Telegram Bot service

**Contoh koneksi**:
```javascript
// Dari aplikasi Node.js
const postgresHost = process.env.POSTGRES_HOST; // 'postgres'
const postgresPort = process.env.POSTGRES_PORT; // 5432
```

## 💾 Volume Management

### Persistent Volumes

1. **postgres_data**: Data PostgreSQL (tidak akan hilang saat container restart)
2. **redis_data**: Data Redis (persistent jika diperlukan)
3. **n8n_data**: Workflows dan credentials n8n
4. **crawler_logs**: Log files dari crawler service
5. **analyzer_logs**: Log files dari analyzer service
6. **telegram_bot_logs**: Log files dari telegram bot service

### Backup Volumes

```bash
# Backup PostgreSQL data
docker run --rm -v memecoin-postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup-$(date +%Y%m%d).tar.gz /data

# Backup Redis data
docker run --rm -v memecoin-redis-data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup-$(date +%Y%m%d).tar.gz /data

# Backup n8n data
docker run --rm -v memecoin-n8n-data:/data -v $(pwd):/backup alpine tar czf /backup/n8n-backup-$(date +%Y%m%d).tar.gz /data
```

### Restore Volumes

```bash
# Restore PostgreSQL data
docker run --rm -v memecoin-postgres-data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup-YYYYMMDD.tar.gz -C /

# Restore Redis data
docker run --rm -v memecoin-redis-data:/data -v $(pwd):/backup alpine tar xzf /backup/redis-backup-YYYYMMDD.tar.gz -C /

# Restore n8n data
docker run --rm -v memecoin-n8n-data:/data -v $(pwd):/backup alpine tar xzf /backup/n8n-backup-YYYYMMDD.tar.gz -C /
```

## 📊 Resource Limits & Recommendations

### Total Resource Allocation

Berdasarkan VPS dengan **4 vCPU** dan **8 GB RAM**:

| Service | CPU Limit | CPU Reserve | Memory Limit | Memory Reserve |
|---------|-----------|-------------|--------------|----------------|
| PostgreSQL | 0.5 | 0.25 | 512MB | 256MB |
| Redis | 0.25 | 0.1 | 256MB | 128MB |
| n8n | 1.0 | 0.5 | 1GB | 512MB |
| Crawler | 1.0 | 0.5 | 1GB | 512MB |
| Analyzer | 1.0 | 0.5 | 1GB | 512MB |
| Telegram Bot | 0.5 | 0.25 | 512MB | 256MB |
| **TOTAL** | **4.25** | **2.1** | **4.25GB** | **2.17GB** |

**Note**: 
- CPU limits sedikit melebihi 4 cores karena Docker menggunakan CPU shares
- Memory limits total ~4.25GB, masih aman untuk 8GB RAM
- Sistem operasi dan overhead memerlukan ~2-3GB RAM

### Optimization Tips

1. **Jika memory terbatas**:
   - Kurangi memory limit untuk services yang tidak kritis
   - Gunakan swap space (sudah di-setup di Phase 1)

2. **Jika CPU terbatas**:
   - Kurangi CPU limit untuk services yang tidak intensif CPU
   - Prioritaskan Crawler dan Analyzer untuk CPU

3. **Monitoring**:
   - Gunakan `docker stats` untuk monitor resource usage
   - Setup monitoring dengan Prometheus/Grafana (Phase 5)

## 🔒 Security Best Practices

### 1. Environment Variables

- ✅ Jangan commit file `.env` ke repository
- ✅ Gunakan password yang kuat dan unik
- ✅ Rotate password secara berkala
- ✅ Gunakan secrets management untuk production

### 2. Network Security

- ✅ Services hanya expose port yang diperlukan
- ✅ Gunakan firewall (UFW) untuk membatasi akses
- ✅ Hanya expose n8n dan Telegram bot ke internet (jika diperlukan)
- ✅ PostgreSQL dan Redis hanya accessible dari internal network

### 3. Container Security

- ✅ Gunakan official images dari Docker Hub
- ✅ Update images secara berkala
- ✅ Scan images untuk vulnerabilities
- ✅ Run containers sebagai non-root user (akan diimplementasikan di Phase 3)

### 4. Data Security

- ✅ Encrypt sensitive data di database
- ✅ Backup data secara berkala
- ✅ Test restore procedure
- ✅ Monitor access logs

## 🚀 Common Commands

### Management Commands

```bash
# Start semua services
docker compose up -d

# Stop semua services
docker compose down

# Restart service tertentu
docker compose restart crawler

# Rebuild dan restart service
docker compose up -d --build crawler

# View logs
docker compose logs -f crawler

# View logs dari semua services
docker compose logs -f

# Execute command di dalam container
docker compose exec postgres psql -U memecoin_user -d memecoin_hunter

# View resource usage
docker stats

# Clean up unused resources
docker system prune -a
```

### Debugging Commands

```bash
# Cek status semua services
docker compose ps

# Cek health status
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"

# Inspect service
docker compose inspect postgres

# View service logs dengan timestamp
docker compose logs -f --timestamps crawler

# Access container shell
docker compose exec crawler sh
```

## 📝 Health Checks

Semua services memiliki health checks untuk memastikan mereka berjalan dengan baik:

- **PostgreSQL**: `pg_isready` check setiap 10 detik
- **Redis**: `redis-cli ping` check setiap 10 detik
- **n8n**: HTTP check ke `/healthz` setiap 30 detik
- **Application Services**: Custom healthcheck script setiap 30 detik

Health checks memungkinkan Docker untuk:
- Restart container yang unhealthy
- Wait untuk dependencies sebelum start
- Monitor service status

## 🔄 Dependencies & Startup Order

Services akan start dalam urutan berikut:

1. **PostgreSQL** dan **Redis** (infrastructure)
2. **n8n** (setelah PostgreSQL healthy)
3. **Crawler**, **Analyzer**, **Telegram Bot** (setelah PostgreSQL dan Redis healthy)

Docker Compose menggunakan `depends_on` dengan `condition: service_healthy` untuk memastikan dependencies siap sebelum service start.

## 📚 Next Steps

Setelah Phase 2 selesai, lanjutkan ke:
- **Phase 3**: Application Coding - Implementasi logic untuk setiap service
- **Phase 4**: Automation & Workflows - Setup n8n workflows
- **Phase 5**: Deployment & Optimization - Monitoring dan optimization

---

**Status**: ✅ Phase 2 Complete
**Last Updated**: $(date)


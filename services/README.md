# Services

Struktur services untuk Bot Memecoin Hunter.

## 📁 Struktur Direktori

```
services/
├── crawler/          # Crawler service untuk crawling data meme coin
├── analyzer/         # Analyzer service untuk menganalisis data
└── telegram-bot/     # Telegram bot service untuk notifikasi
```

## 🔧 Setup Development

### Prerequisites

- Node.js 20 LTS
- Docker & Docker Compose
- PostgreSQL (via Docker)
- Redis (via Docker)

### Development Setup

1. **Install dependencies untuk setiap service**:

```bash
cd services/crawler
npm install

cd ../analyzer
npm install

cd ../telegram-bot
npm install
```

2. **Setup environment variables**:

Copy `.env.example` ke root project dan isi dengan konfigurasi yang benar.

3. **Run dengan Docker Compose**:

```bash
# Dari root project
docker compose up -d
```

4. **Development mode** (jika diperlukan):

```bash
# Install nodemon untuk hot reload
npm install -g nodemon

# Run service secara manual (dengan Docker services running)
cd services/crawler
npm run dev
```

## 📝 Service Details

### Crawler Service

**Fungsi**: Crawling data meme coin dari berbagai sumber

**Dependencies**:
- PostgreSQL
- Redis
- Axios (untuk HTTP requests)

**Environment Variables**:
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `CRAWLER_INTERVAL` (default: 300000ms = 5 menit)
- `LOG_LEVEL`

### Analyzer Service

**Fungsi**: Menganalisis data yang di-crawl dan mengidentifikasi opportunities

**Dependencies**:
- PostgreSQL
- Redis

**Environment Variables**:
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `ANALYZER_INTERVAL` (default: 60000ms = 1 menit)
- `LOG_LEVEL`

### Telegram Bot Service

**Fungsi**: Menangani command dari user dan mengirim notifikasi

**Dependencies**:
- PostgreSQL
- Redis
- node-telegram-bot-api

**Environment Variables**:
- `TELEGRAM_BOT_TOKEN` (required)
- `TELEGRAM_CHAT_ID` (optional)
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `LOG_LEVEL`

## 🚀 Build & Deploy

### Build Individual Service

```bash
# Build crawler
docker compose build crawler

# Build analyzer
docker compose build analyzer

# Build telegram-bot
docker compose build telegram-bot
```

### Rebuild and Restart

```bash
# Rebuild dan restart service tertentu
docker compose up -d --build crawler

# Rebuild semua services
docker compose up -d --build
```

## 📊 Logs

### View Logs

```bash
# Logs dari semua services
docker compose logs -f

# Logs dari service tertentu
docker compose logs -f crawler
docker compose logs -f analyzer
docker compose logs -f telegram-bot

# Logs dengan timestamp
docker compose logs -f --timestamps
```

### Log Files

Log files disimpan di:
- `services/crawler/logs/`
- `services/analyzer/logs/`
- `services/telegram-bot/logs/`

## 🧪 Testing

Testing akan diimplementasikan di Phase 3.

## 📚 Next Steps

- **Phase 3**: Implementasi logic untuk setiap service
- **Phase 4**: Setup n8n workflows
- **Phase 5**: Monitoring dan optimization


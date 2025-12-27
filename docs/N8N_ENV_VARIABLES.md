# n8n Environment Variables Configuration

Dokumentasi untuk environment variables yang digunakan di n8n workflows.

## Required Environment Variables

Tambahkan environment variables berikut di n8n settings:

### 1. Database Configuration

| Variable | Description | Example | Source |
|----------|-------------|---------|--------|
| `POSTGRES_HOST` | PostgreSQL hostname | `postgres` | Docker network |
| `POSTGRES_PORT` | PostgreSQL port | `5432` | Default |
| `POSTGRES_DB` | Database name | `memecoin_hunter` | `.env` |
| `POSTGRES_USER` | Database user | `memecoin_user` | `.env` |
| `POSTGRES_PASSWORD` | Database password | `your_password` | `.env` |

### 2. Telegram Configuration

| Variable | Description | Example | Source |
|----------|-------------|---------|--------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | `123456:ABC-DEF...` | `.env` |
| `TELEGRAM_CHAT_ID` | Chat ID untuk notifikasi | `123456789` | Manual setup |

### 3. Workflow Configuration

| Variable | Description | Default | Usage |
|----------|-------------|---------|-------|
| `HIGH_SCORE_THRESHOLD` | Minimum score untuk alert | `70` | Query filter |

## Setup di n8n

### Method 1: Via n8n UI

1. Login ke n8n
2. Klik **Settings** (⚙️) di sidebar
3. Klik **Environment Variables**
4. Klik **"Add Variable"**
5. Tambahkan variables satu per satu:
   - Name: `HIGH_SCORE_THRESHOLD`
   - Value: `70`
   - Click **Save**

### Method 2: Via Docker Compose

Edit `docker-compose.yml` untuk menambahkan environment variables ke n8n service:

```yaml
n8n:
  environment:
    # ... existing vars ...
    - HIGH_SCORE_THRESHOLD=70
    - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
```

Lalu restart n8n:
```bash
docker compose restart n8n
```

### Method 3: Via .env file

n8n akan membaca environment variables dari host jika di-pass melalui docker-compose.

Pastikan `.env` file memiliki:
```bash
HIGH_SCORE_THRESHOLD=70
TELEGRAM_CHAT_ID=your_chat_id
```

Dan di `docker-compose.yml`:
```yaml
n8n:
  environment:
    - HIGH_SCORE_THRESHOLD=${HIGH_SCORE_THRESHOLD:-70}
    - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
```

## Usage di Workflow

### Access Environment Variables

Di n8n workflow, gunakan syntax:
```
{{ $env.VARIABLE_NAME }}
```

Contoh:
```
{{ $env.HIGH_SCORE_THRESHOLD || 70 }}
```

### Example: SQL Query dengan Environment Variable

```sql
SELECT * 
FROM analyses 
WHERE overall_score >= {{ $env.HIGH_SCORE_THRESHOLD || 70 }}
```

### Example: Telegram Chat ID

```
Chat ID: {{ $env.TELEGRAM_CHAT_ID }}
```

## Verification

Untuk verify environment variables ter-load dengan benar:

1. Buat test workflow dengan Code node:
```javascript
return {
  json: {
    threshold: $env.HIGH_SCORE_THRESHOLD,
    chatId: $env.TELEGRAM_CHAT_ID
  }
};
```

2. Run workflow dan check output

## Troubleshooting

### Variable not found

- Pastikan variable sudah di-set di n8n Settings
- Pastikan syntax benar: `{{ $env.VARIABLE_NAME }}`
- Restart n8n container setelah menambah variables via docker-compose

### Default values

Gunakan fallback value jika variable tidak ada:
```
{{ $env.HIGH_SCORE_THRESHOLD || 70 }}
```

### Case sensitivity

Environment variables di n8n case-sensitive. Pastikan nama variable sesuai.


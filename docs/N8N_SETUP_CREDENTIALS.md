# Setup Credentials di n8n

Setelah import workflow, Anda perlu setup credentials untuk PostgreSQL dan Telegram.

## Setup PostgreSQL Credential

### 1. Buka Workflow

1. Login ke n8n
2. Klik workflow "Memecoin High Score Monitor"
3. Klik node **"Query High Score Coins"** (node PostgreSQL)

### 2. Create PostgreSQL Credential

1. Di bagian **"Credential to connect with"**, klik **"Create New Credential"**
2. Pilih **"PostgreSQL"**
3. Isi dengan data berikut:

```
Name: Memecoin PostgreSQL (atau nama lain yang mudah diingat)

Connection:
  Host: postgres
  Database: memecoin_hunter
  User: memecoin_user
  Password: [POSTGRES_PASSWORD dari .env]
  Port: 5432
  SSL: Disable (atau sesuai konfigurasi)
  
Options (optional):
  - Timezone: Asia/Jakarta (atau timezone yang diinginkan)
```

4. Klik **"Save"**

### 3. Test Connection

1. Setelah save, n8n akan otomatis test connection
2. Jika berhasil, akan muncul pesan "Connection successful"
3. Jika error, cek:
   - Password sudah benar
   - Database sudah dibuat (`memecoin_hunter`)
   - User sudah dibuat (`memecoin_user`)

## Setup Telegram Credential

### 1. Buka Node Telegram

1. Di workflow yang sama, klik node **"Send Telegram"**

### 2. Create Telegram Credential

1. Di bagian **"Credential to connect with"**, klik **"Create New Credential"**
2. Pilih **"Telegram"**
3. Isi dengan data berikut:

```
Name: Telegram Bot (atau nama lain)

Access Token: [TELEGRAM_BOT_TOKEN dari .env]
```

4. Klik **"Save"**

### 3. Setup Chat ID

1. Di node **"Send Telegram"**, isi **Chat ID**:
   - Bisa langsung isi dengan chat ID Anda
   - Atau gunakan expression: `{{ $env.TELEGRAM_CHAT_ID }}`

2. **Cara mendapatkan Chat ID:**
   ```bash
   # Method 1: Via Telegram Bot API
   curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   
   # Method 2: Via bot @userinfobot di Telegram
   # Kirim pesan ke bot @userinfobot, akan dapat chat ID
   
   # Method 3: Tambahkan ke .env
   TELEGRAM_CHAT_ID=your_chat_id_here
   ```

## Setup Environment Variables (Optional)

Jika ingin menggunakan environment variables di n8n:

### 1. Setup di n8n UI

1. Klik **Settings** (⚙️) di sidebar
2. Klik **Environment Variables**
3. Klik **"Add Variable"**
4. Tambahkan variables:

```
Name: TELEGRAM_CHAT_ID
Value: your_chat_id_here

Name: HIGH_SCORE_THRESHOLD (untuk non-simple version)
Value: 70
```

### 2. Setup via Docker Compose

Tambahkan ke `docker-compose.yml`:

```yaml
n8n:
  environment:
    - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
    - HIGH_SCORE_THRESHOLD=${HIGH_SCORE_THRESHOLD:-70}
```

Lalu restart:
```bash
docker compose restart n8n
```

## Verifikasi Setup

### 1. Test PostgreSQL Connection

1. Klik node **"Query High Score Coins"**
2. Klik **"Test step"** atau **"Execute Node"**
3. Jika berhasil, akan muncul data dari database

### 2. Test Telegram

1. Klik node **"Send Telegram"**
2. Klik **"Test step"** atau **"Execute Node"**
3. Cek Telegram apakah pesan terkirim

### 3. Test Full Workflow

1. Klik **"Execute Workflow"** (button di kanan atas)
2. Workflow akan berjalan manual
3. Cek apakah:
   - Query berhasil
   - Message terformat dengan benar
   - Telegram notification terkirim

## Troubleshooting

### Error: "Credential with ID '1' does not exist"

**Penyebab:** Workflow menggunakan hardcoded credential ID yang tidak ada di n8n instance Anda.

**Solusi:**
1. Setup credential baru seperti di atas
2. n8n akan otomatis assign credential ID baru
3. Error akan hilang setelah credential di-setup

### Error: "Connection refused" (PostgreSQL)

**Penyebab:** 
- Host salah
- Port salah
- Database container tidak running

**Solusi:**
```bash
# Check postgres container
docker compose ps postgres

# Check postgres logs
docker compose logs postgres

# Test connection dari host
docker compose exec postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT 1;"
```

### Error: "Invalid Telegram token"

**Penyebab:**
- Bot token salah
- Bot token expired
- Bot tidak diaktifkan

**Solusi:**
1. Cek token di `.env` file
2. Test token via API:
   ```bash
   curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe
   ```
3. Buat bot baru di @BotFather jika perlu

### Error: "Chat ID not found" (Telegram)

**Penyebab:**
- Chat ID salah
- Bot belum pernah chat dengan user tersebut

**Solusi:**
1. Pastikan bot sudah di-start (kirim `/start` ke bot)
2. Dapatkan chat ID yang benar (lihat cara di atas)
3. Update Chat ID di node Telegram

## Quick Reference

### PostgreSQL Connection Details

Dari `.env` file atau `docker-compose.yml`:

```bash
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=memecoin_hunter
POSTGRES_USER=memecoin_user
POSTGRES_PASSWORD=<dari .env>
```

### Telegram Connection Details

```bash
TELEGRAM_BOT_TOKEN=<dari .env>
TELEGRAM_CHAT_ID=<dari .env atau manual setup>
```

### Check Credentials di n8n

1. Klik **Settings** → **Credentials**
2. Lihat semua credentials yang sudah dibuat
3. Bisa edit/delete dari sini


# Mengakses Environment Variables di n8n

## Masalah: "access to env vars denied"

Error ini terjadi ketika n8n tidak mengizinkan akses ke environment variables melalui expression `{{ $env.VARIABLE_NAME }}`.

## Solusi

### Cara 1: Isi Chat ID Langsung (Recommended untuk Simple Version)

1. Buka workflow di n8n
2. Klik node **"Send Telegram"**
3. Di field **Chat ID**, isi langsung dengan chat ID Anda (bukan expression)
4. Contoh: `123456789` (number atau string)

**Keuntungan:**
- Tidak perlu setup environment variables
- Lebih mudah dan langsung bekerja
- Cocok untuk single user/single chat ID

### Cara 2: Setup Environment Variables di n8n (Untuk Production)

Jika ingin menggunakan environment variables:

#### Step 1: Enable Environment Variables di n8n

n8n perlu dikonfigurasi untuk mengizinkan akses environment variables:

1. **Via Docker Compose** - Tambahkan env vars ke n8n service:

```yaml
n8n:
  environment:
    - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
    - HIGH_SCORE_THRESHOLD=${HIGH_SCORE_THRESHOLD:-70}
```

2. **Restart n8n:**
```bash
docker compose restart n8n
```

#### Step 2: Gunakan Expression di Workflow

Setelah env vars di-setup, bisa menggunakan expression:

```
{{ $env.TELEGRAM_CHAT_ID }}
```

**Catatan:** 
- Expression harus menggunakan `{{ }}` (double curly braces)
- Tidak semua n8n instance mengizinkan akses `$env`
- Lebih reliable untuk langsung isi value

### Cara 3: Menggunakan n8n Settings → Environment Variables

1. Login ke n8n
2. Klik **Settings** → **Environment Variables**
3. Tambahkan variable:
   - **Name:** `TELEGRAM_CHAT_ID`
   - **Value:** `your_chat_id_here`
4. Save
5. Di workflow, gunakan expression: `{{ $env.TELEGRAM_CHAT_ID }}`

## Cara Mendapatkan Telegram Chat ID

### Method 1: Via Telegram Bot API

```bash
# Ganti YOUR_BOT_TOKEN dengan token bot Anda
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates

# Cari di response, field "chat": { "id": 123456789 }
```

### Method 2: Via @userinfobot

1. Buka Telegram
2. Cari bot `@userinfobot`
3. Kirim pesan apapun ke bot
4. Bot akan reply dengan Chat ID Anda

### Method 3: Start Bot dan Check Updates

1. Start bot Anda (kirim `/start`)
2. Kirim pesan apapun ke bot
3. Gunakan getUpdates untuk melihat chat ID:

```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
```

## Rekomendasi

### Untuk Quick Start / Testing:
- **Gunakan Cara 1**: Isi Chat ID langsung di node Telegram
- Tidak perlu setup environment variables
- Langsung bisa test

### Untuk Production / Multiple Users:
- **Gunakan Cara 2 atau 3**: Setup environment variables
- Lebih fleksibel untuk multiple environments
- Bisa diubah tanpa edit workflow

## Troubleshooting

### Error: "access to env vars denied"

**Penyebab:**
- n8n tidak dikonfigurasi untuk expose environment variables
- Expression `$env` tidak diizinkan di instance n8n Anda

**Solusi:**
1. Isi Chat ID langsung (Cara 1) - **Paling mudah**
2. Atau setup environment variables via Docker Compose (Cara 2)
3. Atau setup via n8n Settings (Cara 3)

### Error: "Chat ID not found"

**Penyebab:**
- Chat ID salah
- Bot belum pernah chat dengan user tersebut

**Solusi:**
1. Pastikan bot sudah di-start (kirim `/start`)
2. Dapatkan Chat ID yang benar
3. Update Chat ID di node Telegram

### Chat ID Format

- Bisa berupa number: `123456789`
- Bisa berupa string: `"123456789"`
- Untuk group chat, gunakan negative number: `-123456789`
- Untuk channel, gunakan format: `@channel_username` atau `-1001234567890`


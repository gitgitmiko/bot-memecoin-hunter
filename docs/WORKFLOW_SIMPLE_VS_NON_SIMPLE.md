# Perbedaan Workflow Simple vs Non-Simple

## Perbandingan

| Fitur | Simple Version | Non-Simple Version |
|-------|---------------|-------------------|
| **File** | `n8n-memecoin-monitor-simple.json` | `n8n-memecoin-monitor.json` |
| **Score Threshold** | Hardcoded: `70` | Environment Variable: `{{ $env.HIGH_SCORE_THRESHOLD \|\| 70 }}` |
| **Fleksibilitas** | ⚠️ Harus edit workflow untuk ubah threshold | ✅ Bisa ubah via environment variable |
| **Kompleksitas** | 🟢 Lebih sederhana | 🟡 Sedikit lebih kompleks |
| **Use Case** | Quick start, testing, fixed threshold | Production, dynamic configuration |

## Detail Perbedaan

### 1. Score Threshold Configuration

#### Simple Version
```sql
WHERE ... AND a.overall_score >= 70
```
- **Threshold hardcoded**: Nilai `70` langsung di query SQL
- **Mudah setup**: Tidak perlu setup environment variable
- **Tidak fleksibel**: Harus edit workflow untuk ubah threshold

#### Non-Simple Version
```sql
WHERE ... AND a.overall_score >= {{ $env.HIGH_SCORE_THRESHOLD || 70 }}
```
- **Threshold dinamis**: Menggunakan environment variable
- **Fleksibel**: Bisa ubah threshold tanpa edit workflow
- **Fallback**: Default ke `70` jika env var tidak ada

### 2. Naming Node

#### Simple Version
- Node names lebih singkat: `"Query High Score Coins"`, `"Has Results?"`, `"Send Telegram"`

#### Non-Simple Version  
- Node names lebih deskriptif: `"Query Recent High Score Coins"`, `"Check If Any High Score Coins"`, `"Send Telegram Notification"`

### 3. Credential Names

#### Simple Version
- PostgreSQL credential: `"id": "1"`, `"name": "Memecoin PostgreSQL"`
- Telegram credential: `"id": "1"`, `"name": "Telegram Bot"`

#### Non-Simple Version
- PostgreSQL credential: `"id": "postgres-credential"`, `"name": "PostgreSQL Memecoin DB"`
- Telegram credential: `"id": "telegram-credential"`, `"name": "Telegram Bot"`

## Kapan Menggunakan Masing-Masing?

### ✅ Gunakan Simple Version Jika:

1. **Quick Start / Testing**
   - Ingin langsung test workflow tanpa setup tambahan
   - Threshold sudah pasti dan tidak akan berubah

2. **Development / Prototype**
   - Sedang develop dan test workflow
   - Tidak perlu fleksibilitas tinggi

3. **Fixed Requirements**
   - Threshold selalu `70` dan tidak perlu diubah-ubah

### ✅ Gunakan Non-Simple Version Jika:

1. **Production Environment**
   - Ingin bisa ubah threshold tanpa restart workflow
   - Perlu flexibility untuk adjust threshold

2. **Multiple Environments**
   - Development: threshold 60
   - Production: threshold 75
   - Bisa set berbeda per environment

3. **A/B Testing**
   - Ingin test threshold berbeda
   - Bisa ubah via env var tanpa deploy ulang workflow

## Cara Setup Environment Variable (Non-Simple)

### Method 1: Via n8n UI

1. Login ke n8n
2. Klik **Settings** → **Environment Variables**
3. Klik **"Add Variable"**
4. Isi:
   - **Name**: `HIGH_SCORE_THRESHOLD`
   - **Value**: `75` (atau nilai yang diinginkan)
5. Klik **Save**

### Method 2: Via Docker Compose

Tambahkan ke `docker-compose.yml`:

```yaml
n8n:
  environment:
    - HIGH_SCORE_THRESHOLD=75
```

Lalu restart:
```bash
docker compose restart n8n
```

### Method 3: Via .env File

Tambahkan ke `.env`:
```bash
HIGH_SCORE_THRESHOLD=75
```

Dan pastikan di `docker-compose.yml`:
```yaml
n8n:
  environment:
    - HIGH_SCORE_THRESHOLD=${HIGH_SCORE_THRESHOLD:-70}
```

## Migrasi dari Simple ke Non-Simple

Jika sudah menggunakan Simple version dan ingin migrasi ke Non-Simple:

1. **Export workflow yang sudah dikonfigurasi** dari n8n UI
2. **Import Non-Simple version**
3. **Setup credentials** (PostgreSQL & Telegram)
4. **Setup environment variable** `HIGH_SCORE_THRESHOLD` jika ingin threshold berbeda dari default 70
5. **Aktifkan workflow**

Atau langsung edit query di Simple version untuk menambahkan env var:
```sql
-- Ganti ini:
AND a.overall_score >= 70

-- Menjadi ini:
AND a.overall_score >= {{ $env.HIGH_SCORE_THRESHOLD || 70 }}
```

## Rekomendasi

- **Untuk mulai**: Gunakan **Simple Version** untuk quick start
- **Untuk production**: Gunakan **Non-Simple Version** untuk flexibility

Kedua workflow sebenarnya sama fungsinya, hanya berbeda dalam cara konfigurasi threshold. Simple version lebih mudah untuk mulai, tapi Non-Simple version lebih fleksibel untuk jangka panjang.


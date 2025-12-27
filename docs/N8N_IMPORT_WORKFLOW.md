# Cara Import Workflow ke n8n

Ada beberapa cara untuk mengimport workflow ke n8n:

## Metode 1: Import via UI (Recommended - Paling Mudah)

1. **Buka n8n di browser**
   - Akses n8n melalui URL yang sudah di-setup (Cloudflared tunnel atau localhost:5678)

2. **Login ke n8n**
   - Jika belum ada user, buat user pertama saat pertama kali akses

3. **Klik 'Workflows' di sidebar kiri**

4. **Klik tombol 'Import from File'** atau menu `...` → `Import from File`

5. **Pilih file workflow**
   - Lokasi file: `workflows/n8n-memecoin-monitor-simple.json`
   - Atau: `workflows/n8n-memecoin-monitor.json`

6. **Workflow akan ter-import dan siap digunakan**

7. **Aktifkan workflow** dengan mengklik toggle switch di kanan atas workflow

## Metode 2: Import via API (Otomatis)

Untuk import otomatis via API, diperlukan API Key dari n8n.

### Setup API Key

1. **Buka n8n Settings**
   - Login ke n8n
   - Klik 'Settings' → 'API' di sidebar

2. **Buat API Key**
   - Klik 'Create API Key'
   - Copy API Key yang di-generate

3. **Tambahkan ke .env file**
   ```bash
   N8N_API_KEY=your_api_key_here
   ```

4. **Jalankan script import**
   ```bash
   ./scripts/import_n8n_workflow.sh
   ```

### Manual API Import

Atau bisa import langsung dengan curl:

```bash
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: your_api_key_here" \
  -d @workflows/n8n-memecoin-monitor-simple.json
```

**Note:** Ganti `localhost:5678` dengan URL n8n Anda jika menggunakan Cloudflared atau akses remote.

## Metode 3: Copy-Paste Manual

1. Buka file workflow JSON di editor:
   ```bash
   cat workflows/n8n-memecoin-monitor-simple.json
   ```

2. Copy seluruh isi file

3. Buka n8n UI → Workflows → New Workflow

4. Klik menu `...` → `Import from URL or File` → Pilih tab "Paste"

5. Paste JSON yang sudah di-copy

6. Klik Import

## Troubleshooting

### Error: 'X-N8N-API-KEY' header required

- **Penyebab**: API Key tidak dikirim dalam header
- **Solusi**: 
  - Gunakan Metode 1 (Import via UI) - paling mudah
  - Atau setup API Key terlebih dahulu (Metode 2)

### Error: Connection refused / Cannot connect

- **Penyebab**: n8n tidak running atau URL salah
- **Solusi**:
  ```bash
  # Check n8n status
  docker compose ps n8n
  
  # Start n8n jika belum running
  docker compose up -d n8n
  
  # Check logs
  docker compose logs n8n
  ```

### Error: Invalid workflow JSON

- **Penyebab**: File workflow JSON corrupt atau format salah
- **Solusi**:
  ```bash
  # Validate JSON
  python3 -m json.tool workflows/n8n-memecoin-monitor-simple.json
  ```

## Workflow Files

Tersedia 2 file workflow:

1. **n8n-memecoin-monitor-simple.json**
   - Versi sederhana dengan threshold 70
   - Recommended untuk mulai

2. **n8n-memecoin-monitor.json**
   - Versi lengkap dengan environment variable untuk threshold
   - Lebih fleksibel untuk production

## Setelah Import

1. **Configure credentials** (jika belum):
   - PostgreSQL credential
   - Telegram Bot credential

2. **Configure environment variables**:
   - `TELEGRAM_CHAT_ID`: Chat ID untuk menerima notifikasi
   - `HIGH_SCORE_THRESHOLD`: Minimum score (default: 70)

3. **Aktifkan workflow** dengan toggle switch

4. **Test workflow** dengan menjalankan manual sekali

## Quick Start Script

Jalankan script helper:
```bash
./scripts/import_n8n_workflow.sh
```

Script ini akan:
- Cek apakah API Key tersedia
- Coba import via API jika API Key ada
- Memberikan instruksi manual jika API Key tidak ada


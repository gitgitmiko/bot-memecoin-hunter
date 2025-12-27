# Cara Mengaktifkan n8n Workflow untuk Auto-Run

## 🎯 Masalah

Workflow sudah di-publish dan cron sudah di-set "Every 2 minutes", tapi workflow tidak jalan otomatis.

## ✅ Solusi: Aktifkan Workflow

Workflow harus diaktifkan (Active toggle ON) agar cron trigger bisa jalan otomatis.

## 📋 Langkah-Langkah

### Step 1: Buka Workflow di n8n

1. Login ke n8n (http://your-n8n-url)
2. Klik **"Workflows"** di sidebar kiri
3. Klik workflow yang ingin diaktifkan (contoh: "Memecoin High Score Monitor")

### Step 2: Aktifkan Workflow

1. Di kanan atas workflow editor, cari tombol **"Active"** (toggle switch)
2. Klik toggle **"Active"** untuk mengaktifkan
3. Toggle harus berubah menjadi **hijau/ON** (bukan abu-abu/OFF)

**Visual:**
```
[OFF] Active  ← Workflow TIDAK aktif (cron tidak jalan)
[ON]  Active  ← Workflow AKTIF (cron jalan otomatis)
```

### Step 3: Verifikasi Workflow Aktif

Setelah mengaktifkan, pastikan:

1. **Toggle "Active" berwarna hijau/ON**
2. **Status workflow menunjukkan "Active"** (bukan "Inactive")
3. **Tidak ada error di workflow** (semua node harus valid)

### Step 4: Verifikasi Cron Trigger

1. Klik node **"Every 2 Minutes"** (Cron Trigger)
2. Pastikan konfigurasi:
   - **Mode:** "Every X Minutes" atau "Cron"
   - **Minutes Interval:** `2` (atau cron expression `*/2 * * * *`)
   - **Trigger Times:** KOSONG (tidak ada "Every Day" yang di-set)
3. Node harus menunjukkan status **"Active"** atau **"Listening"**

### Step 5: Test dan Monitor

1. **Tunggu 2 menit** setelah mengaktifkan
2. Klik tab **"Executions"** di n8n
3. Harus ada execution baru setiap 2 menit
4. Jika ada execution, workflow sudah jalan dengan benar!

## 🔍 Cara Cek Workflow Aktif atau Tidak

### Method 1: Via n8n UI

1. Buka daftar workflows (Workflows → All Workflows)
2. Cek kolom **"Status"** atau **"Active"**
3. Workflow aktif akan menunjukkan:
   - ✅ Icon hijau
   - Status "Active"
   - Toggle "Active" ON

### Method 2: Via Execution History

1. Buka workflow
2. Klik tab **"Executions"**
3. Jika ada execution baru setiap 2 menit → Workflow aktif ✅
4. Jika tidak ada execution → Workflow tidak aktif ❌

### Method 3: Via n8n API (Optional)

```bash
# Get workflow status
curl -X GET "http://your-n8n-url/api/v1/workflows" \
  -H "X-N8N-API-KEY: YOUR_API_KEY"

# Response akan menunjukkan "active: true/false"
```

## ⚠️ Troubleshooting

### Masalah 1: Workflow Tidak Jalan Meski Sudah Aktif

**Cek:**
1. ✅ Workflow sudah diaktifkan (toggle ON)
2. ✅ Cron trigger sudah di-set dengan benar
3. ✅ Tidak ada error di workflow
4. ✅ Credentials sudah di-set (PostgreSQL & Telegram)
5. ✅ Chat ID sudah diisi di node "Send Telegram"

**Solusi:**
- Cek execution history untuk error
- Test manual dengan klik "Execute Workflow"
- Cek n8n logs: `docker-compose logs n8n`

### Masalah 2: Execution Ada Tapi Error

**Cek execution detail:**
1. Klik execution yang error
2. Cek node mana yang error
3. Lihat error message
4. Perbaiki sesuai error

**Common errors:**
- Database connection error → Cek PostgreSQL credential
- Telegram error → Cek Telegram credential & Chat ID
- Query error → Cek SQL query di node

### Masalah 3: Workflow Jalan Tapi Tidak Setiap 2 Menit

**Cek:**
1. Cron trigger configuration
2. Pastikan "Trigger Times" KOSONG (tidak ada "Every Day")
3. Pastikan interval = 2 minutes

**Solusi:**
- Lihat dokumentasi: `docs/N8N_CRON_TRIGGER_TROUBLESHOOTING.md`

### Masalah 4: Workflow Aktif Tapi Tidak Ada Execution

**Kemungkinan:**
1. Cron trigger belum trigger (tunggu 2 menit)
2. Workflow baru diaktifkan (tunggu trigger pertama)
3. n8n container restart (cron perlu waktu untuk re-register)

**Solusi:**
- Tunggu 2-3 menit setelah aktivasi
- Test manual dengan "Execute Workflow"
- Restart n8n: `docker-compose restart n8n`

## 📊 Monitoring Workflow

### Cara Monitor Execution

1. **Via n8n UI:**
   - Buka workflow
   - Klik tab **"Executions"**
   - Lihat daftar execution (terbaru di atas)
   - Klik execution untuk detail

2. **Via n8n Logs:**
   ```bash
   docker-compose logs -f n8n | grep -i "workflow\|execution\|cron"
   ```

3. **Via Execution Status:**
   - ✅ Success (hijau) = Workflow berjalan sukses
   - ⚠️ Warning (kuning) = Ada warning tapi masih jalan
   - ❌ Error (merah) = Ada error, perlu diperbaiki

### Expected Behavior

Setelah workflow aktif:
- ✅ Execution baru muncul setiap 2 menit
- ✅ Execution status: Success (jika ada data) atau Success dengan no results (jika tidak ada data)
- ✅ Telegram notification terkirim (jika ada high score coin)

## 🎯 Checklist Aktivasi

Sebelum workflow bisa jalan otomatis, pastikan:

- [ ] Workflow sudah di-import ke n8n
- [ ] PostgreSQL credential sudah di-set
- [ ] Telegram credential sudah di-set
- [ ] Chat ID sudah diisi di node "Send Telegram"
- [ ] Cron trigger sudah di-set "Every 2 Minutes"
- [ ] Trigger Times KOSONG (tidak ada "Every Day")
- [ ] Workflow sudah diaktifkan (toggle Active ON)
- [ ] Tidak ada error di workflow
- [ ] n8n container running: `docker-compose ps n8n`

## 🚀 Quick Start

Jika semua sudah setup, langkah cepat:

1. **Buka workflow di n8n**
2. **Klik toggle "Active"** (pastikan ON/hijau)
3. **Tunggu 2 menit**
4. **Cek tab "Executions"** → Harus ada execution baru
5. **Done!** ✅

## 📝 Catatan Penting

1. **Workflow harus diaktifkan** agar cron trigger jalan
2. **Publish workflow** tidak sama dengan **aktifkan workflow**
   - Publish = Simpan workflow
   - Active = Aktifkan cron trigger
3. **Cron trigger** hanya jalan jika workflow aktif
4. **Execution history** menunjukkan apakah workflow jalan atau tidak

## 🔗 Referensi

- Dokumentasi n8n: https://docs.n8n.io/workflows/triggers/schedule-trigger/
- Troubleshooting Cron: `docs/N8N_CRON_TRIGGER_TROUBLESHOOTING.md`
- Setup Workflow: `docs/PHASE5_N8N_WORKFLOW.md`


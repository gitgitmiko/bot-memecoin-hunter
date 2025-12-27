# Troubleshooting: Cron Job Tidak Jalan (Manual Execute Berhasil)

## 🎯 Masalah

- ✅ Workflow bisa di-execute **manual** (berhasil)
- ❌ **Cron job tidak jalan** (tidak ada execution otomatis setiap 2 menit)

## 🔍 Penyebab

Ini berarti workflow sudah benar, tapi **cron trigger tidak aktif**. Beberapa kemungkinan:

### 1. **Workflow Tidak Aktif** ⭐ (PALING UMUM!)

Workflow harus diaktifkan agar cron trigger jalan.

**Cek:**
- Toggle "Active" harus **hijau/ON** (bukan abu-abu/OFF)

### 2. **n8n Cron Process Tidak Aktif**

n8n perlu process khusus untuk menjalankan cron trigger.

**Cek:** Environment variable `EXECUTIONS_PROCESS` atau `N8N_DISABLE_PRODUCTION_MAIN_PROCESS`

### 3. **Timezone Mismatch**

Timezone n8n tidak sesuai, menyebabkan cron schedule tidak match.

### 4. **n8n Instance Mode**

n8n perlu running dalam mode yang mendukung cron trigger.

## ✅ Solusi Step-by-Step

### Step 1: Pastikan Workflow Aktif (PALING PENTING!)

1. Buka workflow di n8n
2. Cek toggle **"Active"** di kanan atas
3. **Harus hijau/ON**, bukan abu-abu/OFF
4. Jika OFF, klik untuk mengaktifkan

**Visual:**
```
❌ [OFF] Active  ← Tidak aktif, cron tidak jalan
✅ [ON]  Active  ← Aktif, cron akan jalan
```

### Step 2: Cek n8n Environment Variables

Cek apakah n8n dikonfigurasi dengan benar untuk cron trigger.

```bash
# Cek docker-compose.yml
cat docker-compose.yml | grep -A 20 "n8n:"

# Atau cek environment variables n8n container
docker-compose exec n8n env | grep -i "execution\|cron\|process"
```

**Yang harus ada:**
- `EXECUTIONS_PROCESS=main` (atau tidak ada, default = main)
- `N8N_DISABLE_PRODUCTION_MAIN_PROCESS` tidak boleh `true`

### Step 3: Cek n8n Logs

Cek logs untuk error atau warning terkait cron:

```bash
# Cek logs n8n
docker-compose logs n8n | grep -i "cron\|schedule\|trigger"

# Atau real-time logs
docker-compose logs -f n8n
```

**Yang dicari:**
- Error terkait cron/schedule
- Warning tentang workflow tidak aktif
- Info tentang cron trigger registered

### Step 4: Restart n8n Container

Kadang n8n perlu restart untuk register cron trigger:

```bash
# Restart n8n
docker-compose restart n8n

# Tunggu n8n ready (30-60 detik)
docker-compose logs -f n8n

# Setelah ready, cek workflow masih aktif
# (Kadang workflow jadi tidak aktif setelah restart)
```

### Step 5: Cek Timezone

Pastikan timezone n8n sesuai:

```bash
# Cek timezone di docker-compose.yml
cat docker-compose.yml | grep -i "timezone\|tz"

# Atau cek di container
docker-compose exec n8n date
```

**Standard:**
- Timezone: `Asia/Jakarta` atau `UTC`
- Environment variable: `GENERIC_TIMEZONE` atau `TZ`

### Step 6: Verifikasi Cron Configuration

Di n8n UI, cek node "Every 2 Minutes":

1. Klik node "Every 2 Minutes"
2. Pastikan:
   - Mode: "Every X Minutes" atau "Cron"
   - Minutes Interval: `2`
   - Trigger Times: **KOSONG** (tidak ada "Every Day")
3. Save workflow (klik "Publish")

### Step 7: Test dengan Execution Manual

1. Klik "Execute Workflow" (manual)
2. Setelah execution sukses
3. Aktifkan workflow lagi (pastikan toggle Active ON)
4. Tunggu 2 menit
5. Cek tab "Executions"

## 🔧 Quick Fix Script

Buat script untuk troubleshoot:

```bash
#!/bin/bash
# Script untuk troubleshoot n8n cron tidak jalan

echo "=== n8n Cron Troubleshooting ==="
echo ""

echo "1. Cek n8n container status:"
docker-compose ps n8n
echo ""

echo "2. Cek n8n environment variables:"
docker-compose exec -T n8n env | grep -E "EXECUTIONS_PROCESS|N8N_DISABLE|TIMEZONE|TZ" || echo "Not found"
echo ""

echo "3. Cek n8n logs (last 50 lines):"
docker-compose logs --tail=50 n8n | grep -i "cron\|schedule\|trigger\|error" || echo "No relevant logs"
echo ""

echo "4. Cek timezone:"
docker-compose exec -T n8n date
echo ""

echo "5. Restart n8n (optional):"
echo "   docker-compose restart n8n"
echo ""

echo "=== Checklist ==="
echo "- [ ] Workflow aktif (toggle Active ON)"
echo "- [ ] Cron trigger di-set 'Every 2 Minutes'"
echo "- [ ] Trigger Times KOSONG"
echo "- [ ] n8n container running"
echo "- [ ] No error di logs"
```

## 🎯 Common Issues & Solutions

### Issue 1: Workflow Tidak Aktif Setelah Restart

**Gejala:**
- Workflow aktif sebelum restart
- Setelah restart, workflow jadi tidak aktif

**Solusi:**
- Aktifkan workflow lagi setelah restart
- Atau gunakan n8n API untuk auto-activate (advanced)

### Issue 2: n8n Main Process Disabled

**Gejala:**
- Error di logs: "main process disabled"
- Cron trigger tidak jalan

**Solusi:**
- Pastikan `N8N_DISABLE_PRODUCTION_MAIN_PROCESS` tidak di-set atau `false`
- Restart n8n

### Issue 3: Timezone Mismatch

**Gejala:**
- Cron trigger terlihat aktif
- Tapi execution tidak sesuai waktu yang diharapkan

**Solusi:**
- Set timezone di docker-compose.yml:
  ```yaml
  environment:
    - GENERIC_TIMEZONE=Asia/Jakarta
    - TZ=Asia/Jakarta
  ```
- Restart n8n

### Issue 4: Multiple n8n Instances

**Gejala:**
- Workflow aktif di instance A
- Tapi cron trigger jalan di instance B

**Solusi:**
- Pastikan hanya ada 1 n8n instance running
- Atau pastikan workflow aktif di instance yang benar

## ✅ Verification Checklist

Setelah semua perbaikan, verifikasi:

- [ ] Workflow aktif (toggle Active hijau/ON)
- [ ] Cron trigger di-set "Every 2 Minutes"
- [ ] Trigger Times KOSONG
- [ ] n8n container running: `docker-compose ps n8n`
- [ ] No error di logs: `docker-compose logs n8n | grep -i error`
- [ ] Timezone sesuai
- [ ] Tunggu 2-4 menit
- [ ] Cek tab "Executions" → Harus ada execution baru

## 🚀 Quick Fix (Most Common)

Jika manual execute berhasil tapi cron tidak jalan:

1. **Aktifkan workflow:**
   - Buka workflow di n8n
   - Pastikan toggle "Active" **hijau/ON**

2. **Restart n8n:**
   ```bash
   docker-compose restart n8n
   ```

3. **Aktifkan workflow lagi** (kadang jadi tidak aktif setelah restart)

4. **Tunggu 2 menit**

5. **Cek tab "Executions"** → Harus ada execution baru

## 📊 Debugging Workflow Status via API

Jika ingin cek via API:

```bash
# Get workflow list
curl -X GET "http://your-n8n-url/api/v1/workflows" \
  -H "X-N8N-API-KEY: YOUR_API_KEY" | jq '.[] | {id, name, active}'

# Get specific workflow
curl -X GET "http://your-n8n-url/api/v1/workflows/WORKFLOW_ID" \
  -H "X-N8N-API-KEY: YOUR_API_KEY" | jq '{id, name, active}'
```

## 🔗 Related Documentation

- Aktivasi Workflow: `docs/N8N_ACTIVATE_WORKFLOW.md`
- Troubleshooting Cron: `docs/N8N_CRON_TRIGGER_TROUBLESHOOTING.md`
- UI Guide: `docs/N8N_UI_GUIDE.md`


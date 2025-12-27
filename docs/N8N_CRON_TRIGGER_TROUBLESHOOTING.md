# Troubleshooting n8n Cron Trigger

## Masalah: Trigger Tidak Berjalan Setiap 2 Menit

### Gejala
- Trigger tidak berjalan setiap 2 menit
- Tidak ada log execution
- Workflow hanya jalan sekali sehari atau tidak jalan sama sekali

### Penyebab Umum

#### 1. **Trigger Times Override Interval** ⚠️

Jika Anda menambahkan "Trigger Times" dengan mode "Every Day" pada jam tertentu, itu akan **mengoverride** konfigurasi interval.

**SALAH:**
- Mode: "Every Day"
- Hour: 0
- Minute: 2
- **Hasil:** Trigger hanya jalan sekali sehari pada jam 00:02, bukan setiap 2 menit!

**BENAR:**
- Mode: "Every X Minutes" (atau kosongkan Trigger Times)
- Minutes Interval: 2
- **Hasil:** Trigger jalan setiap 2 menit

#### 2. **Workflow Tidak Aktif**

Pastikan workflow sudah diaktifkan (Active toggle ON).

#### 3. **Timezone Mismatch**

Pastikan timezone n8n sesuai dengan timezone server.

## Solusi: Konfigurasi Trigger yang Benar

### Method 1: Menggunakan Interval (Recommended)

1. **Buka workflow di n8n**
2. **Klik node "Every 2 Minutes" (Cron Trigger)**
3. **Di tab "Trigger Times":**
   - **KOSONGKAN** atau **HAPUS** semua trigger times
   - Atau pastikan tidak ada "Every Day" yang di-set
4. **Di tab "Schedule Trigger":**
   - Pilih **"Every X Minutes"**
   - Set **"Minutes Interval"** = `2`
5. **Save workflow**
6. **Aktifkan workflow** (toggle Active ON)

### Method 2: Menggunakan Cron Expression

Jika ingin lebih kontrol, gunakan cron expression:

1. **Buka node Cron Trigger**
2. **Pilih mode "Cron"**
3. **Masukkan cron expression:**
   ```
   */2 * * * *
   ```
   Artinya: setiap 2 menit, setiap jam, setiap hari

4. **Save dan aktifkan workflow**

### Method 3: Menggunakan Schedule Trigger (n8n versi baru)

1. **Buka node Cron Trigger**
2. **Pilih "Schedule Trigger"**
3. **Pilih "Every X Minutes"**
4. **Set interval = 2**
5. **Save dan aktifkan**

## Verifikasi Konfigurasi

### 1. Cek Node Configuration

Di n8n UI, node Cron Trigger harus menunjukkan:
- **Mode:** "Every X Minutes" atau "Cron"
- **Interval:** 2 minutes
- **Trigger Times:** KOSONG (atau tidak ada "Every Day")

### 2. Cek Workflow Status

- Workflow harus **Active** (toggle hijau)
- Tidak ada error di node Cron Trigger
- Execution history menunjukkan trigger berjalan

### 3. Test Manual

1. Klik **"Execute Workflow"** manual
2. Cek apakah workflow berjalan
3. Tunggu 2 menit, cek apakah trigger otomatis jalan

## Konfigurasi JSON yang Benar

### Untuk Interval Setiap 2 Menit:

```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "minutes",
          "minutesInterval": 2
        }
      ]
    }
  }
}
```

### Untuk Cron Expression:

```json
{
  "parameters": {
    "rule": {
      "cronExpression": "*/2 * * * *"
    }
  }
}
```

## Common Mistakes

### ❌ SALAH: Menggunakan Trigger Times dengan Every Day

```json
{
  "parameters": {
    "rule": {
      "interval": [...],
      "triggerTimes": {
        "mode": "everyDay",
        "hour": 0,
        "minute": 2
      }
    }
  }
}
```

**Hasil:** Trigger hanya jalan sekali sehari pada jam 00:02

### ❌ SALAH: Interval Tidak Di-set

```json
{
  "parameters": {
    "rule": {
      "interval": []
    }
  }
}
```

**Hasil:** Trigger tidak jalan sama sekali

### ✅ BENAR: Interval Setiap 2 Menit

```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "minutes",
          "minutesInterval": 2
        }
      ]
    }
  }
}
```

**Hasil:** Trigger jalan setiap 2 menit

## Troubleshooting Step-by-Step

### Step 1: Cek Workflow Status

1. Buka n8n UI
2. Cek workflow list
3. Pastikan workflow **Active** (toggle hijau)
4. Jika tidak aktif, klik toggle untuk mengaktifkan

### Step 2: Cek Node Configuration

1. Buka workflow
2. Klik node Cron Trigger
3. Cek konfigurasi:
   - **Interval:** Harus ada "Every 2 Minutes" atau cron `*/2 * * * *`
   - **Trigger Times:** Harus KOSONG atau tidak ada "Every Day"
4. Jika ada "Every Day", **HAPUS** atau **KOSONGKAN**

### Step 3: Cek Execution History

1. Di n8n UI, klik **"Executions"** tab
2. Cek apakah ada execution baru setiap 2 menit
3. Jika tidak ada, lanjut ke Step 4

### Step 4: Test Manual Execution

1. Klik **"Execute Workflow"** button
2. Cek apakah workflow berjalan dengan benar
3. Jika manual berhasil tapi auto tidak, masalah di trigger configuration

### Step 5: Restart n8n (Jika Perlu)

Jika semua sudah benar tapi masih tidak jalan:

```bash
# Restart n8n container
docker-compose restart n8n

# Atau check logs
docker-compose logs -f n8n
```

### Step 6: Cek n8n Logs

```bash
# Check n8n logs untuk error
docker-compose logs n8n | grep -i "cron\|trigger\|schedule"

# Check execution logs
docker-compose exec n8n ls -la /home/node/.n8n/logs/
```

## Konfigurasi yang Disarankan

### Untuk Production (Setiap 2 Menit):

**Option 1: Interval (Paling Simple)**
- Mode: "Every X Minutes"
- Minutes Interval: 2
- Trigger Times: KOSONG

**Option 2: Cron Expression (Lebih Fleksibel)**
- Mode: "Cron"
- Cron Expression: `*/2 * * * *`
- Trigger Times: KOSONG

### Untuk Testing (Setiap 1 Menit):

- Minutes Interval: 1
- Atau Cron: `* * * * *`

### Untuk Production (Setiap 5 Menit):

- Minutes Interval: 5
- Atau Cron: `*/5 * * * *`

## FAQ

### Q: Kenapa trigger tidak jalan setiap 2 menit?

**A:** Kemungkinan besar Anda menambahkan "Trigger Times" dengan mode "Every Day". Ini akan mengoverride interval dan membuat trigger hanya jalan sekali sehari. **Hapus atau kosongkan Trigger Times.**

### Q: Apakah perlu set Trigger Times?

**A:** **TIDAK**, untuk interval setiap 2 menit, Trigger Times harus **KOSONG**. Trigger Times hanya digunakan untuk scheduled time (misalnya: jalan setiap hari jam 10:00).

### Q: Bagaimana cara cek apakah trigger berjalan?

**A:** 
1. Cek **Executions** tab di n8n
2. Harus ada execution baru setiap 2 menit
3. Atau tambahkan log node di awal workflow untuk debugging

### Q: Workflow aktif tapi tidak jalan, kenapa?

**A:** 
1. Cek konfigurasi Cron Trigger node
2. Pastikan interval sudah di-set (bukan kosong)
3. Pastikan Trigger Times KOSONG
4. Cek n8n logs untuk error

### Q: Bisa pakai cron expression?

**A:** **YA**, gunakan cron expression `*/2 * * * *` untuk setiap 2 menit. Lebih fleksibel untuk konfigurasi kompleks.

## Quick Fix

Jika trigger tidak jalan setiap 2 menit:

1. **Buka workflow di n8n**
2. **Klik node Cron Trigger**
3. **Di "Trigger Times":**
   - **HAPUS** semua entry
   - Atau pastikan tidak ada "Every Day"
4. **Di "Schedule Trigger":**
   - Pilih **"Every X Minutes"**
   - Set **"Minutes Interval"** = `2`
5. **Save workflow**
6. **Aktifkan workflow** (jika belum aktif)
7. **Tunggu 2 menit** dan cek execution history

## Reference

- n8n Cron Node Documentation: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.cron/
- Cron Expression Generator: https://crontab.guru/
- n8n Schedule Trigger: https://docs.n8n.io/workflows/triggers/schedule-trigger/


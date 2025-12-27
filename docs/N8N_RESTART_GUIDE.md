# Cara Restart n8n

Panduan lengkap untuk restart n8n service.

## 🔄 Cara Restart n8n

### 1. Restart via Docker Compose (Recommended)

```bash
cd /home/ubuntu/project/bot-memecoin-hunter/bot-memecoin-hunter
docker-compose restart n8n
```

**Keuntungan:**
- Cepat dan mudah
- Tidak perlu stop/start manual
- Container tetap running, hanya restart process

### 2. Stop dan Start Ulang

```bash
cd /home/ubuntu/project/bot-memecoin-hunter/bot-memecoin-hunter
docker-compose stop n8n
docker-compose start n8n
```

**Gunakan jika:**
- Restart biasa tidak bekerja
- Ada masalah dengan container

### 3. Rebuild Container (Jika Ada Perubahan)

```bash
cd /home/ubuntu/project/bot-memecoin-hunter/bot-memecoin-hunter
docker-compose up -d --build n8n
```

**Gunakan jika:**
- Ada perubahan environment variables
- Ada perubahan konfigurasi
- Ingin memastikan menggunakan image terbaru

## ✅ Verifikasi Restart Berhasil

### 1. Cek Status Container

```bash
docker-compose ps n8n
```

**Output yang diharapkan:**
```
NAME              STATUS
memecoin-n8n      Up X seconds (healthy)
```

### 2. Cek Logs

```bash
docker-compose logs n8n --tail=20
```

**Output yang diharapkan:**
- Tidak ada error
- "n8n ready on 0.0.0.0, port 5678"
- "Editor is now accessible via: http://localhost:5678"

### 3. Cek Web Interface

Buka browser dan akses:
- Local: `http://localhost:5678`
- Atau sesuai konfigurasi di `docker-compose.yml`

## 🔍 Troubleshooting

### Problem: Container tidak restart

**Solusi:**
```bash
# Force remove dan recreate
docker-compose stop n8n
docker-compose rm -f n8n
docker-compose up -d n8n
```

### Problem: Workflow tidak berjalan setelah restart

**Solusi:**
1. Pastikan workflow aktif (toggle ON di n8n UI)
2. Cek credentials masih valid
3. Cek cron trigger masih terkonfigurasi dengan benar
4. Restart workflow manual di n8n UI

### Problem: Port sudah digunakan

**Solusi:**
```bash
# Cek port yang digunakan
netstat -tulpn | grep 5678

# Stop container yang menggunakan port
docker-compose stop n8n

# Start ulang
docker-compose start n8n
```

## 📝 Catatan

1. **Restart n8n tidak akan menghapus workflow**
   - Workflow tersimpan di database
   - Setelah restart, workflow masih ada

2. **Workflow yang aktif akan tetap aktif**
   - Tapi pastikan workflow benar-benar aktif (toggle ON)
   - Cron trigger akan berjalan setelah restart

3. **Credentials tetap tersimpan**
   - Credentials tersimpan di database
   - Tidak perlu setup ulang setelah restart

4. **Environment variables**
   - Perlu restart jika ada perubahan env vars
   - Atau rebuild container

## 🚀 Quick Commands

```bash
# Restart n8n
docker-compose restart n8n

# Cek status
docker-compose ps n8n

# Cek logs
docker-compose logs n8n --tail=50

# Restart semua services
docker-compose restart

# Restart n8n dan analyzer (jika perlu)
docker-compose restart n8n analyzer
```

---

**Status:** ✅ n8n sudah di-restart dan siap digunakan


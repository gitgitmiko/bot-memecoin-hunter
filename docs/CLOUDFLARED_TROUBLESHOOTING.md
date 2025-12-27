# Troubleshooting Cloudflared dengan n8n

Jika cloudflared menampilkan error "Unable to reach the origin service", ikuti langkah-langkah berikut.

## 🔍 Error yang Terjadi

```
ERR error="Unable to reach the origin service. The service may be down or it may not be responding to traffic from cloudflared: EOF"
```

Ini berarti cloudflared tidak bisa mengakses n8n di `localhost:5678`.

## ✅ Solusi Cepat

### 1. Jalankan Script Fix

```bash
# Pastikan menggunakan docker group
newgrp docker ./scripts/fix_n8n_cloudflared.sh
```

Script ini akan:
- ✅ Cek status n8n container
- ✅ Restart n8n jika tidak running
- ✅ Test koneksi ke n8n
- ✅ Cek health status

### 2. Manual Check

#### A. Cek Status Services

```bash
# Cek semua services
docker compose ps

# Cek n8n khususnya
docker compose ps n8n
```

#### B. Cek n8n Logs

```bash
# View logs
docker compose logs n8n --tail 50

# Follow logs
docker compose logs -f n8n
```

#### C. Test n8n Accessibility

```bash
# Test dari VPS
curl -I http://localhost:5678

# Atau test dengan wget
wget --spider http://localhost:5678
```

#### D. Restart n8n

```bash
# Restart n8n
docker compose restart n8n

# Atau stop dan start ulang
docker compose stop n8n
docker compose up -d n8n
```

## 🔧 Masalah Umum dan Solusi

### Masalah 1: n8n Container Tidak Running

**Gejala**: `docker compose ps n8n` menunjukkan status "Exited" atau "Restarting"

**Solusi**:
```bash
# Start n8n
docker compose up -d n8n

# Cek logs untuk error
docker compose logs n8n
```

### Masalah 2: n8n Belum Fully Started

**Gejala**: Container running tapi tidak merespons

**Solusi**:
```bash
# Tunggu beberapa saat (n8n butuh waktu untuk start)
sleep 30

# Test lagi
curl -I http://localhost:5678
```

### Masalah 3: Port Conflict

**Gejala**: Port 5678 sudah digunakan oleh service lain

**Solusi**:
```bash
# Cek apa yang menggunakan port 5678
sudo netstat -tlnp | grep 5678
# atau
sudo ss -tlnp | grep 5678

# Stop service yang conflict, atau ubah port n8n di .env
```

### Masalah 4: Database Connection Issue

**Gejala**: n8n tidak bisa connect ke PostgreSQL

**Solusi**:
```bash
# Cek PostgreSQL running
docker compose ps postgres

# Cek n8n logs untuk database error
docker compose logs n8n | grep -i "database\|postgres\|connection"

# Restart PostgreSQL jika perlu
docker compose restart postgres
```

### Masalah 5: Cloudflared Config Salah

**Gejala**: Cloudflared tidak pointing ke port yang benar

**Solusi**:
```bash
# Cek port n8n di .env
grep N8N_PORT .env

# Pastikan cloudflared menggunakan port yang sama
cloudflared tunnel --url http://localhost:5678
```

## 🚀 Step-by-Step Fix

### Langkah 1: Pastikan n8n Running

```bash
# Start semua services
docker compose up -d

# Tunggu 30 detik
sleep 30

# Cek status
docker compose ps
```

### Langkah 2: Test n8n Local

```bash
# Test dari VPS
curl -I http://localhost:5678

# Harus dapat response 200, 401, atau 302
```

### Langkah 3: Restart Cloudflared

```bash
# Stop cloudflared yang running
pkill cloudflared

# Start ulang dengan port yang benar
cloudflared tunnel --url http://localhost:5678
```

### Langkah 4: Test dari Browser

Buka URL cloudflared di browser dan cek apakah n8n muncul.

## 📋 Checklist

- [ ] n8n container running (`docker compose ps n8n`)
- [ ] n8n accessible di localhost (`curl http://localhost:5678`)
- [ ] PostgreSQL running (`docker compose ps postgres`)
- [ ] Cloudflared pointing ke port yang benar
- [ ] Tidak ada port conflict
- [ ] n8n logs tidak ada error

## 🔍 Debug Commands

```bash
# Cek semua containers
docker compose ps

# Cek n8n logs
docker compose logs n8n --tail 100

# Test n8n health
docker compose exec n8n wget --spider http://localhost:5678/healthz

# Cek port listening
sudo netstat -tlnp | grep 5678

# Cek cloudflared process
ps aux | grep cloudflared

# Test connection dari cloudflared perspective
curl -v http://localhost:5678
```

## 💡 Tips

1. **Selalu tunggu n8n fully started** sebelum test cloudflared
2. **Cek logs** jika ada masalah
3. **Restart services** jika perlu
4. **Pastikan port mapping** di docker-compose.yml benar

## 🆘 Jika Masih Error

1. **Restart semua services**:
```bash
docker compose down
docker compose up -d
sleep 30
```

2. **Cek environment variables**:
```bash
cat .env | grep N8N
```

3. **Rebuild n8n container**:
```bash
docker compose up -d --build n8n
```

4. **Check system resources**:
```bash
free -h
df -h
docker stats
```

---

**Last Updated**: $(date)


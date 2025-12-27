# Setup Cloudflared untuk n8n

Dokumentasi lengkap untuk setup Cloudflared tunnel agar n8n bisa diakses dari internet.

## ✅ Status Setup

Cloudflared sudah berhasil di-setup dan running!

**URL n8n Anda:**
```
https://priority-what-francis-increasingly.trycloudflare.com
```

## 🚀 Quick Access

1. **Buka browser** dan akses URL di atas
2. **Login** dengan credentials dari file `.env`:
   - Username: `admin` (atau sesuai `N8N_USER` di `.env`)
   - Password: Password dari `N8N_PASSWORD` di `.env`

## 🔧 Setup sebagai Service (Recommended)

Agar tunnel tetap running meskipun SSH disconnect, setup sebagai systemd service:

```bash
./scripts/setup_cloudflared_service.sh
```

Script ini akan:
- ✅ Membuat systemd service untuk cloudflared
- ✅ Auto-start saat boot
- ✅ Auto-restart jika crash
- ✅ Tetap running meskipun SSH disconnect

## 📋 Manual Commands

### Cek Status Tunnel

```bash
# Cek apakah tunnel running
cloudflared tunnel list

# Cek service status
sudo systemctl status cloudflared

# Cek logs
sudo journalctl -u cloudflared -f
```

### Manage Service

```bash
# Start service
sudo systemctl start cloudflared

# Stop service
sudo systemctl stop cloudflared

# Restart service
sudo systemctl restart cloudflared

# Disable auto-start
sudo systemctl disable cloudflared

# Enable auto-start
sudo systemctl enable cloudflared
```

### Update Tunnel URL

Jika URL berubah atau ingin menggunakan custom domain:

1. **Update config file**:
```bash
nano ~/.cloudflared/config.yml
```

2. **Restart service**:
```bash
sudo systemctl restart cloudflared
```

## 🔒 Security Notes

1. **URL adalah temporary** (trycloudflare.com):
   - URL akan berubah jika tunnel di-restart
   - Untuk production, gunakan named tunnel dengan custom domain

2. **Authentication sudah aktif**:
   - n8n menggunakan Basic Auth
   - Pastikan password kuat di `.env`

3. **HTTPS otomatis**:
   - Cloudflare menyediakan SSL/TLS otomatis
   - Tidak perlu setup SSL manual

## 🌐 Setup Custom Domain (Advanced)

Untuk menggunakan domain sendiri:

1. **Login ke Cloudflare Dashboard**
2. **Buat named tunnel**:
```bash
cloudflared tunnel create n8n-tunnel
```

3. **Route DNS**:
```bash
cloudflared tunnel route dns n8n-tunnel n8n.yourdomain.com
```

4. **Update config**:
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/ubuntu/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: n8n.yourdomain.com
    service: http://localhost:5678
  - service: http_status:404
```

5. **Restart service**:
```bash
sudo systemctl restart cloudflared
```

## 📊 Monitoring

### View Logs

```bash
# Real-time logs
sudo journalctl -u cloudflared -f

# Last 50 lines
sudo journalctl -u cloudflared -n 50

# Logs dengan timestamp
sudo journalctl -u cloudflared --since "1 hour ago"
```

### Check Tunnel Status

```bash
# List all tunnels
cloudflared tunnel list

# Check tunnel info
cloudflared tunnel info n8n-tunnel
```

## 🔄 Troubleshooting

### Tunnel Tidak Bisa Diakses

1. **Cek service status**:
```bash
sudo systemctl status cloudflared
```

2. **Cek n8n running**:
```bash
docker compose ps n8n
```

3. **Cek logs**:
```bash
sudo journalctl -u cloudflared -n 100
```

### URL Berubah

URL trycloudflare.com adalah temporary. Jika ingin URL tetap:
- Setup named tunnel dengan custom domain
- Atau gunakan ngrok dengan paid plan

### Service Tidak Start

1. **Cek config file**:
```bash
cat ~/.cloudflared/config.yml
```

2. **Cek credentials**:
```bash
ls -la ~/.cloudflared/*.json
```

3. **Test manual**:
```bash
cloudflared tunnel --config ~/.cloudflared/config.yml run
```

## 📝 Notes

- **Tunnel ID**: `1f52ec9e-62a0-42d2-9076-20292307e43f`
- **Current URL**: `https://priority-what-francis-increasingly.trycloudflare.com`
- **Credentials**: Disimpan di `~/.cloudflared/`
- **Config**: `~/.cloudflared/config.yml`

## 🎯 Next Steps

1. ✅ Setup sebagai service (sudah dijelaskan di atas)
2. ✅ Test akses n8n via URL
3. ✅ Setup workflows di n8n
4. ⬜ (Opsional) Setup custom domain untuk production

---

**Status**: ✅ Cloudflared Running
**Last Updated**: $(date)


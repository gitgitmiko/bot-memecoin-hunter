# Mengakses n8n dari VPS Private

Dokumentasi untuk mengakses n8n dari VPS dengan IP private (tidak bisa diakses langsung dari internet).

## 🎯 Solusi yang Tersedia

### 1. SSH Tunnel (Recommended - Paling Aman) ⭐

**Keuntungan:**
- ✅ Paling aman (enkripsi SSH)
- ✅ Tidak perlu setup tambahan di server
- ✅ Tidak perlu expose port ke internet
- ✅ Gratis

**Cara Setup:**

1. **Di Local Machine Anda**, jalankan perintah SSH tunnel:

```bash
# Basic SSH tunnel
ssh -L 5678:localhost:5678 ubuntu@192.168.15.124

# Jika menggunakan custom SSH port
ssh -L 5678:localhost:5678 -p 2222 ubuntu@192.168.15.124

# Tunnel di background (tidak blocking terminal)
ssh -fN -L 5678:localhost:5678 ubuntu@192.168.15.124
```

2. **Setelah tunnel aktif**, buka browser di local machine:
   - URL: `http://localhost:5678`
   - Login dengan credentials dari `.env` file

3. **Untuk stop tunnel**, tekan `Ctrl+C` atau kill process:
```bash
pkill -f "ssh.*5678:localhost:5678"
```

**Tips:**
- Buat alias di `~/.ssh/config` untuk memudahkan:
```bash
Host n8n-tunnel
    HostName 192.168.15.124
    User ubuntu
    LocalForward 5678 localhost:5678
```

Kemudian cukup jalankan: `ssh n8n-tunnel`

---

### 2. Reverse Proxy dengan Domain

**Keuntungan:**
- ✅ Akses via domain yang mudah diingat
- ✅ SSL/HTTPS otomatis dengan Let's Encrypt
- ✅ Professional setup

**Prasyarat:**
- Domain yang sudah di-point ke VPS (atau bisa setup DNS)
- Public IP atau bisa diakses dari internet

**Cara Setup:**

Jalankan script helper:
```bash
./scripts/setup_n8n_access.sh
# Pilih opsi 2
```

Atau manual setup:

1. **Install Nginx dan Certbot:**
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

2. **Buat konfigurasi Nginx:**
```bash
sudo nano /etc/nginx/sites-available/n8n
```

Isi dengan:
```nginx
server {
    listen 80;
    server_name n8n.yourdomain.com;

    location / {
        proxy_pass http://localhost:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. **Enable site dan test:**
```bash
sudo ln -s /etc/nginx/sites-available/n8n /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

4. **Setup SSL:**
```bash
sudo certbot --nginx -d n8n.yourdomain.com
```

5. **Akses n8n:**
   - URL: `https://n8n.yourdomain.com`

---

### 3. Tunneling Service (ngrok/Cloudflared)

#### A. Cloudflared (Cloudflare Tunnel) - Recommended

**Keuntungan:**
- ✅ Gratis
- ✅ Tidak perlu public IP
- ✅ SSL otomatis
- ✅ Dapat custom domain

**Cara Setup:**

1. **Install Cloudflared:**
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared
sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
```

2. **Login ke Cloudflare:**
```bash
cloudflared tunnel login
```

3. **Buat tunnel:**
```bash
cloudflared tunnel create n8n-tunnel
```

4. **Setup config:**
```bash
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

Isi dengan:
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: n8n.yourdomain.com
    service: http://localhost:5678
  - service: http_status:404
```

5. **Run tunnel:**
```bash
sudo cloudflared tunnel --config /etc/cloudflared/config.yml run
```

6. **Setup systemd service (opsional):**
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

#### B. ngrok

**Keuntungan:**
- ✅ Mudah setup
- ✅ Free tier available
- ✅ Web interface untuk monitoring

**Cara Setup:**

1. **Install ngrok:**
```bash
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
```

2. **Daftar dan dapatkan authtoken:**
   - Daftar di: https://dashboard.ngrok.com
   - Dapatkan authtoken dari dashboard

3. **Setup authtoken:**
```bash
ngrok config add-authtoken <YOUR_AUTHTOKEN>
```

4. **Run ngrok:**
```bash
ngrok http 5678
```

5. **Akses n8n:**
   - URL akan ditampilkan di terminal (contoh: `https://abc123.ngrok.io`)
   - Web interface: `http://localhost:4040`

6. **Setup systemd service (opsional):**
```bash
sudo tee /etc/systemd/system/ngrok.service > /dev/null <<EOF
[Unit]
Description=ngrok
After=network.target

[Service]
Type=simple
User=ubuntu
ExecStart=/usr/bin/ngrok http 5678
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable ngrok
sudo systemctl start ngrok
```

---

### 4. Port Forwarding (Jika ada Public IP)

**Keuntungan:**
- ✅ Akses langsung tanpa tunnel
- ✅ Tidak perlu service pihak ketiga

**Cara Setup:**

1. **Buka firewall untuk port n8n:**
```bash
sudo ufw allow 5678/tcp
```

2. **Pastikan docker-compose.yml sudah expose port:**
```yaml
ports:
  - "5678:5678"
```

3. **Akses n8n:**
   - URL: `http://<PUBLIC_IP>:5678`

**⚠️ PENTING:**
- Pastikan n8n menggunakan authentication (sudah dikonfigurasi di `.env`)
- Gunakan HTTPS jika memungkinkan
- Pertimbangkan menggunakan VPN untuk akses yang lebih aman

---

## 🔒 Security Best Practices

1. **Selalu gunakan authentication:**
   - Pastikan `N8N_BASIC_AUTH_ACTIVE=true` di `.env`
   - Gunakan password yang kuat untuk `N8N_PASSWORD`

2. **Gunakan HTTPS:**
   - Reverse proxy dengan SSL (Let's Encrypt)
   - Cloudflare Tunnel (SSL otomatis)
   - ngrok (SSL otomatis)

3. **Batasi akses:**
   - Gunakan firewall untuk membatasi IP yang bisa akses
   - Pertimbangkan VPN untuk akses internal

4. **Monitor akses:**
   - Cek logs n8n secara berkala
   - Setup alerting untuk aktivitas mencurigakan

---

## 🚀 Quick Start

Untuk setup cepat, jalankan script helper:

```bash
./scripts/setup_n8n_access.sh
```

Script akan memandu Anda melalui proses setup berdasarkan pilihan Anda.

---

## 📝 Troubleshooting

### SSH Tunnel tidak bisa connect
- Pastikan SSH service running di VPS
- Cek firewall tidak block SSH port
- Pastikan user memiliki akses SSH

### n8n tidak bisa diakses via tunnel
- Pastikan n8n container running: `docker compose ps`
- Cek logs n8n: `docker compose logs n8n`
- Pastikan port 5678 sudah benar di `.env`

### Reverse proxy error
- Cek Nginx config: `sudo nginx -t`
- Cek Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Pastikan n8n running di localhost:5678

---

## 📚 Referensi

- [n8n Documentation](https://docs.n8n.io/)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [ngrok Documentation](https://ngrok.com/docs)


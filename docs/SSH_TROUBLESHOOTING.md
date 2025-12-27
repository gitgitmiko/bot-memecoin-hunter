# Troubleshooting SSH Connection untuk VPS Private

Jika Anda mengalami "Connection timed out" saat mencoba SSH tunnel, ikuti langkah-langkah berikut.

## 🔍 Diagnosa Masalah

### 1. Jalankan Script Troubleshoot

Di VPS, jalankan:
```bash
./scripts/troubleshoot_ssh.sh
```

Script ini akan mengecek:
- Status SSH service
- Port SSH yang digunakan
- Firewall rules
- Network configuration

### 2. Masalah Umum dan Solusi

#### A. SSH Service Tidak Running

**Gejala**: Connection refused atau timeout

**Solusi**:
```bash
# Cek status SSH
sudo systemctl status sshd

# Start SSH service
sudo systemctl start sshd
sudo systemctl enable sshd
```

#### B. Firewall Block SSH Port

**Gejala**: Connection timeout

**Solusi**:
```bash
# Cek UFW status
sudo ufw status

# Allow SSH port (default: 22)
sudo ufw allow 22/tcp

# Atau jika menggunakan custom port
sudo ufw allow <PORT>/tcp

# Reload UFW
sudo ufw reload
```

#### C. SSH Port Bukan Default (22)

**Gejala**: Connection timeout ke port 22

**Cek port SSH**:
```bash
sudo grep "^Port" /etc/ssh/sshd_config
# Atau
sudo netstat -tlnp | grep ssh
```

**Gunakan port yang benar**:
```bash
ssh -L 5678:localhost:5678 -p <PORT> ubuntu@192.168.15.124
```

#### D. IP Address Tidak Bisa Diakses dari Local Machine

**Gejala**: Connection timeout

**Kemungkinan penyebab**:
1. VPS di network yang berbeda (tidak bisa diakses langsung)
2. Router/NAT tidak allow inbound connection
3. IP address salah

**Solusi**:
1. **Cek apakah bisa ping dari local machine**:
```bash
# Di local machine (Windows)
ping 192.168.15.124

# Di local machine (Linux/Mac)
ping -c 4 192.168.15.124
```

2. **Jika tidak bisa ping, gunakan alternatif**:
   - Gunakan public IP jika ada
   - Setup VPN untuk akses ke network private
   - Gunakan tunneling service (ngrok/cloudflared) untuk n8n

#### E. SSH Config Block Connection

**Cek SSH config**:
```bash
sudo cat /etc/ssh/sshd_config | grep -E "AllowUsers|DenyUsers|AllowGroups|DenyGroups"
```

**Jika ada restriction, tambahkan user**:
```bash
sudo nano /etc/ssh/sshd_config
# Tambahkan: AllowUsers ubuntu
sudo systemctl restart sshd
```

## 🔧 Solusi Alternatif untuk VPS Private

Jika SSH tunnel tidak memungkinkan, gunakan alternatif berikut:

### 1. Gunakan Tunneling Service untuk n8n

**Cloudflared** (Recommended):
```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared
sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Login dan setup tunnel
cloudflared tunnel login
cloudflared tunnel create n8n-tunnel
cloudflared tunnel route dns n8n-tunnel n8n.yourdomain.com

# Run tunnel
cloudflared tunnel --config ~/.cloudflared/config.yml run
```

**ngrok**:
```bash
# Install ngrok
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# Setup dan run
ngrok config add-authtoken <YOUR_TOKEN>
ngrok http 5678
```

### 2. Setup VPN

Jika VPS di network private, setup VPN untuk akses:
- WireGuard
- OpenVPN
- Tailscale

### 3. Port Forwarding di Router

Jika VPS di belakang router:
1. Setup port forwarding di router
2. Forward external port ke VPS IP:SSH_PORT
3. Gunakan router's public IP untuk SSH

## 📋 Checklist Troubleshooting

- [ ] SSH service running (`sudo systemctl status sshd`)
- [ ] SSH port allowed di firewall (`sudo ufw allow 22/tcp`)
- [ ] Bisa ping VPS dari local machine
- [ ] Menggunakan port SSH yang benar
- [ ] Username dan IP address benar
- [ ] Network routing benar (tidak ada NAT/firewall block)

## 🚀 Quick Fix Commands

```bash
# Di VPS - Pastikan SSH running dan firewall allow
sudo systemctl start sshd
sudo systemctl enable sshd
sudo ufw allow 22/tcp
sudo ufw reload

# Cek SSH port
sudo netstat -tlnp | grep ssh

# Test SSH dari VPS sendiri
ssh localhost
```

## 📞 Informasi untuk Debug

Saat meminta bantuan, sertakan informasi berikut:

1. **Output dari troubleshoot script**:
```bash
./scripts/troubleshoot_ssh.sh
```

2. **SSH config**:
```bash
sudo cat /etc/ssh/sshd_config | grep -v "^#" | grep -v "^$"
```

3. **Network info**:
```bash
hostname -I
ip addr show
```

4. **Firewall status**:
```bash
sudo ufw status verbose
```

5. **SSH service status**:
```bash
sudo systemctl status sshd
```

## 💡 Tips

1. **Test SSH connection dulu tanpa tunnel**:
```bash
ssh ubuntu@192.168.15.124
```

2. **Jika SSH berhasil, baru tambahkan tunnel**:
```bash
ssh -L 5678:localhost:5678 ubuntu@192.168.15.124
```

3. **Gunakan verbose mode untuk debug**:
```bash
ssh -v -L 5678:localhost:5678 ubuntu@192.168.15.124
```

4. **Cek log SSH di VPS**:
```bash
sudo tail -f /var/log/auth.log
```


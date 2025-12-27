# PHASE 1 – VPS INITIAL SETUP

Dokumentasi lengkap untuk setup awal VPS Ubuntu 22.04 LTS dengan konfigurasi production-ready.

**✨ Versi Non-Interaktif (Anti-TUI)**: Script otomatisasi sepenuhnya non-interaktif, tidak memerlukan input manual selama proses setup.

## Prasyarat

- VPS Ubuntu 22.04 LTS
- 4 vCPU, 8 GB RAM
- Non-root user dengan sudo privileges
- Akses SSH ke VPS

## ⚡ Quick Start (Non-Interactive)

Script otomatisasi sepenuhnya non-interaktif - tidak memerlukan input manual:

```bash
chmod +x scripts/phase1_setup.sh
./scripts/phase1_setup.sh
```

**Catatan**: Script menggunakan `DEBIAN_FRONTEND=noninteractive` untuk menghindari semua prompt interaktif.

---

## 1. SYSTEM UPDATE & UPGRADE

### Perintah

```bash
# Set non-interactive mode
export DEBIAN_FRONTEND=noninteractive

# Update package list
sudo -E apt update

# Upgrade semua paket yang tersedia
sudo -E apt upgrade -y

# Install paket yang diperlukan untuk update
sudo -E apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Clean up paket yang tidak terpakai
sudo -E apt autoremove -y
sudo -E apt autoclean
```

### Verifikasi

```bash
# Cek versi Ubuntu
lsb_release -a

# Cek status update
sudo apt list --upgradable
```

---

## 2. INSTALL ESSENTIAL PACKAGES

### Perintah

```bash
# Set non-interactive mode (jika belum)
export DEBIAN_FRONTEND=noninteractive

# Install paket essential untuk development dan sistem
sudo -E apt install -y \
    build-essential \
    git \
    wget \
    curl \
    vim \
    nano \
    htop \
    net-tools \
    software-properties-common \
    unattended-upgrades \
    ufw \
    fail2ban \
    logrotate \
    rsync \
    zip \
    unzip \
    jq \
    tree \
    tmux \
    screen
```

### Verifikasi

```bash
# Cek versi git
git --version

# Cek versi curl
curl --version

# Cek paket yang terinstall
dpkg -l | grep -E 'git|curl|vim|htop'
```

---

## 3. INSTALL DOCKER & DOCKER COMPOSE

### Install Docker Engine

```bash
# Hapus versi lama jika ada
sudo apt remove -y docker docker-engine docker.io containerd runc

# Tambah Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Setup repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index
sudo apt update

# Install Docker Engine, CLI, Containerd, Buildx, Compose
sudo apt install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin
```

### Konfigurasi Docker untuk Non-Root User

```bash
# Tambah user ke docker group (ganti 'ubuntu' dengan username Anda)
sudo usermod -aG docker $USER

# Aktifkan Docker service
sudo systemctl enable docker
sudo systemctl start docker
```

### Install Docker Compose Standalone (Opsional - untuk kompatibilitas)

```bash
# Download Docker Compose v2
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Berikan permission execute
sudo chmod +x /usr/local/bin/docker-compose

# Buat symlink untuk akses global
sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
```

### Verifikasi

```bash
# Cek versi Docker
docker --version

# Cek versi Docker Compose
docker compose version
# atau
docker-compose --version

# Test Docker dengan hello-world
docker run hello-world

# Cek Docker service status
sudo systemctl status docker

# Cek user dalam docker group
groups $USER
```

**Catatan**: Setelah menambahkan user ke docker group, logout dan login kembali agar perubahan berlaku.

---

## 4. INSTALL NODE.JS 20 LTS

### Install Node.js 20 LTS via NodeSource

```bash
# Download dan jalankan setup script dari NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Install build tools (untuk native modules)
sudo apt install -y gcc g++ make
```

### Install Yarn (Opsional - untuk package management)

```bash
# Install Yarn via npm
sudo npm install -g yarn

# Atau via corepack (built-in Node.js)
sudo corepack enable
```

### Verifikasi

```bash
# Cek versi Node.js
node --version

# Cek versi npm
npm --version

# Cek versi Yarn (jika diinstall)
yarn --version

# Cek lokasi instalasi
which node
which npm
```

---

## 5. FIREWALL (UFW) CONFIGURATION

### Konfigurasi Dasar UFW

```bash
# Reset UFW ke default (jika sudah dikonfigurasi sebelumnya)
sudo ufw --force reset

# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (PENTING: lakukan ini sebelum enable UFW!)
sudo ufw allow 22/tcp comment 'SSH'

# Allow HTTP dan HTTPS
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Allow port untuk aplikasi (sesuaikan dengan kebutuhan)
# Contoh: Port untuk API atau aplikasi blockchain
# sudo ufw allow 3000/tcp comment 'API Server'
# sudo ufw allow 8545/tcp comment 'Ethereum RPC'

# Enable UFW
sudo ufw --force enable
```

### Konfigurasi Lanjutan (Opsional)

```bash
# Rate limiting untuk SSH (mencegah brute force)
sudo ufw limit 22/tcp

# Allow dari IP tertentu saja (contoh)
# sudo ufw allow from 192.168.1.0/24 to any port 22

# Logging
sudo ufw logging on
```

### Verifikasi

```bash
# Cek status UFW
sudo ufw status verbose

# Cek rules yang aktif
sudo ufw status numbered

# Test koneksi SSH (pastikan masih bisa login!)
# Jika terputus, gunakan console VPS untuk disable UFW:
# sudo ufw disable
```

---

## 6. FAIL2BAN SETUP

### Install dan Konfigurasi Fail2Ban

```bash
# Install Fail2Ban (sudah diinstall di step 2, tapi pastikan)
sudo apt install -y fail2ban

# Buat konfigurasi local (jangan edit default)
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit konfigurasi
sudo nano /etc/fail2ban/jail.local
```

### Konfigurasi jail.local

Tambahkan atau modifikasi bagian berikut:

```ini
[DEFAULT]
# Ban hosts untuk 1 jam (3600 detik)
bantime = 3600

# Jendela waktu untuk hitungan kegagalan (10 menit)
findtime = 600

# Maksimal kegagalan sebelum ban
maxretry = 5

# Email notification (opsional)
# destemail = admin@yourdomain.com
# sendername = Fail2Ban
# action = %(action_mwl)s

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
```

### Start dan Enable Fail2Ban

```bash
# Start Fail2Ban service
sudo systemctl start fail2ban

# Enable Fail2Ban pada boot
sudo systemctl enable fail2ban

# Reload konfigurasi jika sudah diubah
sudo systemctl restart fail2ban
```

### Verifikasi

```bash
# Cek status Fail2Ban
sudo systemctl status fail2ban

# Cek jail yang aktif
sudo fail2ban-client status

# Cek SSH jail detail
sudo fail2ban-client status sshd

# Test ban (opsional - hati-hati!)
# sudo fail2ban-client set sshd banip <IP_ADDRESS>

# Cek log
sudo tail -f /var/log/fail2ban.log
```

---

## 7. SECURITY BEST PRACTICES

### 7.1. SSH Hardening

```bash
# Backup konfigurasi SSH
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Edit SSH config
sudo nano /etc/ssh/sshd_config
```

Tambahkan atau modifikasi:

```ini
# Disable root login
PermitRootLogin no

# Disable password authentication (gunakan key-based auth)
PasswordAuthentication no
PubkeyAuthentication yes

# Change default port (opsional - pastikan UFW allow port baru!)
# Port 2222

# Limit login attempts
MaxAuthTries 3

# Disable empty passwords
PermitEmptyPasswords no

# Disable X11 forwarding (jika tidak diperlukan)
X11Forwarding no

# Timeout untuk idle connections
ClientAliveInterval 300
ClientAliveCountMax 2
```

Restart SSH service:

```bash
# Test konfigurasi sebelum restart
sudo sshd -t

# Jika tidak ada error, restart SSH
sudo systemctl restart sshd

# Jangan logout sampai memastikan SSH masih bisa login!
```

### 7.2. Automatic Security Updates (Non-Interactive)

```bash
# Buat konfigurasi auto-upgrades (non-interactive)
sudo tee /etc/apt/apt.conf.d/20auto-upgrades > /dev/null <<EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
EOF

# Backup dan update konfigurasi unattended-upgrades
sudo cp /etc/apt/apt.conf.d/50unattended-upgrades /etc/apt/apt.conf.d/50unattended-upgrades.backup 2>/dev/null || true

# Aktifkan opsi yang diperlukan (non-interactive)
sudo sed -i 's/^\/\/Unattended-Upgrade::Automatic-Reboot "false";/Unattended-Upgrade::Automatic-Reboot "false";/' /etc/apt/apt.conf.d/50unattended-upgrades
sudo sed -i 's/^\/\/Unattended-Upgrade::Automatic-Reboot-Time "02:00";/Unattended-Upgrade::Automatic-Reboot-Time "02:00";/' /etc/apt/apt.conf.d/50unattended-upgrades
sudo sed -i 's/^\/\/Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";/Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";/' /etc/apt/apt.conf.d/50unattended-upgrades
sudo sed -i 's/^\/\/Unattended-Upgrade::Remove-Unused-Dependencies "true";/Unattended-Upgrade::Remove-Unused-Dependencies "true";/' /etc/apt/apt.conf.d/50unattended-upgrades

# Enable dan start service
sudo systemctl enable unattended-upgrades
sudo systemctl start unattended-upgrades

# Verifikasi
sudo systemctl status unattended-upgrades
```

### 7.3. Disable Unnecessary Services

```bash
# Cek service yang berjalan
sudo systemctl list-units --type=service --state=running

# Disable service yang tidak diperlukan (contoh)
# sudo systemctl disable bluetooth
# sudo systemctl stop bluetooth
```

### 7.4. Setup Log Rotation

```bash
# Konfigurasi logrotate untuk aplikasi (akan dibuat di phase selanjutnya)
sudo nano /etc/logrotate.d/memecoin-hunter
```

### 7.5. Setup Swap (Opsional - untuk memory management)

```bash
# Cek apakah swap sudah ada
free -h
swapon --show

# Buat swap file 2GB (jika belum ada)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Buat permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimasi swap
sudo nano /etc/sysctl.conf
```

Tambahkan:

```ini
vm.swappiness=10
vm.vfs_cache_pressure=50
```

Apply:

```bash
sudo sysctl -p
```

---

## 8. VERIFICATION CHECKLIST

Jalankan perintah berikut untuk memverifikasi semua setup:

```bash
# 1. System Info
echo "=== SYSTEM INFO ==="
lsb_release -a
uname -r
free -h
df -h

# 2. Essential Packages
echo "=== ESSENTIAL PACKAGES ==="
git --version
curl --version
docker --version
docker compose version

# 3. Node.js
echo "=== NODE.JS ==="
node --version
npm --version

# 4. Docker
echo "=== DOCKER ==="
docker ps
docker info | grep -E "Server Version|Storage Driver|Logging Driver"

# 5. Firewall
echo "=== FIREWALL ==="
sudo ufw status verbose

# 6. Fail2Ban
echo "=== FAIL2BAN ==="
sudo systemctl status fail2ban --no-pager
sudo fail2ban-client status

# 7. SSH
echo "=== SSH ==="
sudo systemctl status sshd --no-pager
sudo sshd -T | grep -E "PermitRootLogin|PasswordAuthentication|PubkeyAuthentication"

# 8. Security Updates
echo "=== SECURITY UPDATES ==="
sudo systemctl status unattended-upgrades --no-pager

# 9. Disk Space
echo "=== DISK SPACE ==="
df -h

# 10. Memory
echo "=== MEMORY ==="
free -h
```

---

## 9. POST-SETUP RECOMMENDATIONS

### 9.1. Setup SSH Key Authentication

```bash
# Di local machine, generate SSH key (jika belum ada)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy public key ke VPS
ssh-copy-id user@your-vps-ip

# Test login tanpa password
ssh user@your-vps-ip
```

### 9.2. Setup Monitoring (Opsional)

```bash
# Install monitoring tools
sudo apt install -y htop iotop nethogs

# Atau gunakan tools seperti:
# - Prometheus + Grafana
# - Netdata
# - Uptime Kuma
```

### 9.3. Backup Strategy

```bash
# Setup cron untuk backup otomatis (akan dibuat di phase selanjutnya)
crontab -e
```

### 9.4. Timezone Configuration

```bash
# Set timezone
sudo timedatectl set-timezone Asia/Jakarta

# Verifikasi
timedatectl
```

---

## 10. TROUBLESHOOTING

### Docker Permission Denied

```bash
# Pastikan user dalam docker group
groups $USER

# Jika belum, tambahkan dan logout/login
sudo usermod -aG docker $USER
```

### UFW Blocking SSH

```bash
# Jika terkunci, gunakan console VPS
sudo ufw disable
sudo ufw allow 22/tcp
sudo ufw enable
```

### Fail2Ban Not Working

```bash
# Cek log
sudo tail -f /var/log/fail2ban.log

# Restart service
sudo systemctl restart fail2ban

# Test jail
sudo fail2ban-client status sshd
```

---

## NEXT STEPS

Setelah Phase 1 selesai, lanjutkan ke:
- **Phase 2**: Dockerized Infrastructure
- **Phase 3**: Application Coding
- **Phase 4**: Automation & Workflows
- **Phase 5**: Deployment & Optimization

---

## NOTES

- **PENTING**: Selalu backup konfigurasi sebelum mengubah file sistem
- **PENTING**: Test SSH access sebelum logout setelah mengubah konfigurasi SSH
- **PENTING**: Pastikan UFW allow SSH sebelum enable firewall
- Simpan semua output verification untuk dokumentasi
- Dokumentasikan IP address dan port yang digunakan

---

**Status**: ✅ Phase 1 Complete
**Last Updated**: $(date)


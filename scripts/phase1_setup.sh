#!/bin/bash

###############################################################################
# PHASE 1 - VPS INITIAL SETUP SCRIPT
# Ubuntu 22.04 LTS
# Production-ready automated setup (NON-INTERACTIVE)
###############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Set non-interactive mode untuk semua command
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    log_error "Jangan jalankan script ini sebagai root!"
    log_info "Jalankan sebagai non-root user dengan sudo privileges"
    exit 1
fi

# Check Ubuntu version (non-interactive)
log_info "Memeriksa versi Ubuntu..."
if ! grep -q "22.04" /etc/os-release; then
    log_warn "Script ini dirancang untuk Ubuntu 22.04 LTS"
    log_warn "Versi terdeteksi: $(grep VERSION_ID /etc/os-release)"
    log_warn "Melanjutkan dengan asumsi kompatibilitas..."
fi

###############################################################################
# 1. SYSTEM UPDATE & UPGRADE
###############################################################################
log_info "=== 1. SYSTEM UPDATE & UPGRADE ==="
sudo -E apt update
sudo -E apt upgrade -y
sudo -E apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
sudo -E apt autoremove -y
sudo -E apt autoclean
log_info "System update selesai"

###############################################################################
# 2. INSTALL ESSENTIAL PACKAGES
###############################################################################
log_info "=== 2. INSTALL ESSENTIAL PACKAGES ==="
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

log_info "Essential packages terinstall"

###############################################################################
# 3. INSTALL DOCKER & DOCKER COMPOSE
###############################################################################
log_info "=== 3. INSTALL DOCKER & DOCKER COMPOSE ==="

# Remove old versions
sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Setup repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update and install Docker
sudo -E apt update
sudo -E apt install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

# Add user to docker group
log_info "Menambahkan user $USER ke docker group..."
sudo usermod -aG docker $USER

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Install Docker Compose standalone (for compatibility)
log_info "Installing Docker Compose standalone..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

log_info "Docker terinstall. Logout dan login kembali untuk menggunakan docker tanpa sudo"

###############################################################################
# 4. INSTALL NODE.JS 20 LTS
###############################################################################
log_info "=== 4. INSTALL NODE.JS 20 LTS ==="

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo -E apt install -y nodejs

# Install build tools
sudo -E apt install -y gcc g++ make

log_info "Node.js $(node --version) terinstall"

###############################################################################
# 5. FIREWALL (UFW) CONFIGURATION
###############################################################################
log_info "=== 5. FIREWALL (UFW) CONFIGURATION ==="

# Reset UFW
sudo ufw --force reset

# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (CRITICAL!)
sudo ufw allow 22/tcp comment 'SSH'

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Enable UFW
sudo ufw --force enable

log_warn "UFW enabled. Pastikan SSH port 22 masih bisa diakses!"

###############################################################################
# 6. FAIL2BAN SETUP
###############################################################################
log_info "=== 6. FAIL2BAN SETUP ==="

# Create local config if not exists
if [ ! -f /etc/fail2ban/jail.local ]; then
    sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
fi

# Configure Fail2Ban
sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
EOF

# Start and enable Fail2Ban
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban

log_info "Fail2Ban configured and started"

###############################################################################
# 7. SECURITY CONFIGURATIONS
###############################################################################
log_info "=== 7. SECURITY CONFIGURATIONS ==="

# SSH Hardening (backup first)
if [ ! -f /etc/ssh/sshd_config.backup ]; then
    sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup
    log_info "SSH config backed up"
fi

# Configure automatic security updates (non-interactive)
log_info "Mengkonfigurasi automatic security updates..."
if [ ! -f /etc/apt/apt.conf.d/20auto-upgrades ]; then
    sudo tee /etc/apt/apt.conf.d/20auto-upgrades > /dev/null <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
EOF
fi

# Configure unattended-upgrades (non-interactive)
if [ -f /etc/apt/apt.conf.d/50unattended-upgrades ]; then
    sudo cp /etc/apt/apt.conf.d/50unattended-upgrades /etc/apt/apt.conf.d/50unattended-upgrades.backup 2>/dev/null || true
    
    # Update config untuk non-interactive
    sudo sed -i 's/^\/\/Unattended-Upgrade::Automatic-Reboot "false";/Unattended-Upgrade::Automatic-Reboot "false";/' /etc/apt/apt.conf.d/50unattended-upgrades 2>/dev/null || true
    sudo sed -i 's/^\/\/Unattended-Upgrade::Automatic-Reboot-Time "02:00";/Unattended-Upgrade::Automatic-Reboot-Time "02:00";/' /etc/apt/apt.conf.d/50unattended-upgrades 2>/dev/null || true
    sudo sed -i 's/^\/\/Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";/Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";/' /etc/apt/apt.conf.d/50unattended-upgrades 2>/dev/null || true
    sudo sed -i 's/^\/\/Unattended-Upgrade::Remove-Unused-Dependencies "true";/Unattended-Upgrade::Remove-Unused-Dependencies "true";/' /etc/apt/apt.conf.d/50unattended-upgrades 2>/dev/null || true
fi

# Enable unattended-upgrades service
sudo systemctl enable unattended-upgrades
sudo systemctl start unattended-upgrades

# Set timezone to Asia/Jakarta (non-interactive)
sudo timedatectl set-timezone Asia/Jakarta

log_info "Security configurations applied"

###############################################################################
# 8. VERIFICATION
###############################################################################
log_info "=== 8. VERIFICATION ==="

echo ""
echo "=== SYSTEM INFO ==="
lsb_release -a
echo ""
echo "=== DOCKER ==="
docker --version || log_warn "Docker belum bisa digunakan tanpa logout/login"
docker compose version || log_warn "Docker Compose belum bisa digunakan tanpa logout/login"
echo ""
echo "=== NODE.JS ==="
node --version
npm --version
echo ""
echo "=== FIREWALL ==="
sudo ufw status verbose
echo ""
echo "=== FAIL2BAN ==="
sudo systemctl status fail2ban --no-pager | head -5
echo ""
echo "=== DISK SPACE ==="
df -h | grep -E "Filesystem|/dev/"
echo ""
echo "=== MEMORY ==="
free -h

###############################################################################
# COMPLETION
###############################################################################
log_info ""
log_info "=========================================="
log_info "PHASE 1 SETUP SELESAI!"
log_info "=========================================="
log_warn ""
log_warn "PENTING:"
log_warn "1. Logout dan login kembali untuk menggunakan Docker tanpa sudo"
log_warn "2. Verifikasi SSH access masih berfungsi"
log_warn "3. Review konfigurasi Fail2Ban di /etc/fail2ban/jail.local"
log_warn "4. Review konfigurasi UFW dengan: sudo ufw status verbose"
log_warn ""
log_info "Lanjutkan ke Phase 2: Dockerized Infrastructure"
log_info ""


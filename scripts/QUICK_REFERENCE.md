# Quick Reference - Phase 1 Commands

## 🚀 Quick Setup (Automated)

```bash
chmod +x scripts/phase1_setup.sh
./scripts/phase1_setup.sh
```

## 📋 Manual Commands

### System Update
```bash
sudo apt update && sudo apt upgrade -y
sudo apt autoremove -y
```

### Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Logout dan login kembali
```

### Install Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Firewall Setup
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Fail2Ban
```bash
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
sudo fail2ban-client status
```

## ✅ Verification

```bash
# Check versions
docker --version
node --version
npm --version

# Check services
sudo systemctl status docker
sudo systemctl status fail2ban
sudo ufw status

# Check disk & memory
df -h
free -h
```

## 🔧 Troubleshooting

### Docker Permission Denied
```bash
sudo usermod -aG docker $USER
# Logout dan login kembali
```

### UFW Blocking Access
```bash
sudo ufw disable  # Via console VPS
sudo ufw allow 22/tcp
sudo ufw enable
```

### Check Fail2Ban Logs
```bash
sudo tail -f /var/log/fail2ban.log
```


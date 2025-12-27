# Phase 1 - VPS Setup Checklist

Gunakan checklist ini untuk memastikan semua langkah sudah dilakukan dengan benar.

## Pre-Setup
- [ ] VPS Ubuntu 22.04 LTS sudah tersedia
- [ ] Non-root user dengan sudo sudah dibuat
- [ ] SSH access sudah berfungsi
- [ ] Backup konfigurasi penting (jika ada)

## System Update
- [ ] System update dan upgrade selesai
- [ ] Essential packages terinstall
- [ ] Verifikasi: `lsb_release -a`

## Docker Installation
- [ ] Docker Engine terinstall
- [ ] Docker Compose terinstall
- [ ] User ditambahkan ke docker group
- [ ] Docker service running
- [ ] Verifikasi: `docker --version` dan `docker compose version`
- [ ] Test: `docker run hello-world` (setelah logout/login)

## Node.js Installation
- [ ] Node.js 20 LTS terinstall
- [ ] npm terinstall
- [ ] Verifikasi: `node --version` dan `npm --version`

## Firewall (UFW)
- [ ] UFW terinstall
- [ ] SSH port (22) di-allow
- [ ] HTTP (80) dan HTTPS (443) di-allow
- [ ] UFW enabled
- [ ] Verifikasi: `sudo ufw status verbose`
- [ ] Test SSH access masih berfungsi

## Fail2Ban
- [ ] Fail2Ban terinstall
- [ ] Konfigurasi jail.local dibuat
- [ ] Fail2Ban service running
- [ ] Fail2Ban enabled on boot
- [ ] Verifikasi: `sudo fail2ban-client status`

## Security Hardening
- [ ] SSH config di-backup
- [ ] Automatic security updates enabled
- [ ] Timezone dikonfigurasi
- [ ] Unnecessary services disabled (opsional)

## Post-Setup
- [ ] Logout dan login kembali (untuk docker group)
- [ ] Semua verification commands berhasil
- [ ] Dokumentasi disimpan
- [ ] IP address dan port dicatat

## Verification Commands
Jalankan semua perintah berikut dan pastikan tidak ada error:

```bash
# System
lsb_release -a
uname -r

# Docker
docker --version
docker compose version
docker ps

# Node.js
node --version
npm --version

# Firewall
sudo ufw status verbose

# Fail2Ban
sudo systemctl status fail2ban
sudo fail2ban-client status

# Resources
free -h
df -h
```

## Notes
- Tanggal setup: ___________
- VPS IP: ___________
- SSH Port: ___________
- Issues/Notes: ___________

---

**Status**: ⬜ Not Started | 🟡 In Progress | ✅ Complete


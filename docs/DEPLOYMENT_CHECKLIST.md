# Production Deployment Checklist

Checklist lengkap untuk deployment production.

## Pre-Deployment

### Infrastructure

- [ ] VPS sudah provisioned (8GB RAM, 4 vCPU minimum)
- [ ] SSH access sudah secure (key-based authentication)
- [ ] Firewall (UFW) sudah dikonfigurasi
- [ ] Fail2Ban sudah aktif
- [ ] System updates sudah dilakukan
- [ ] Timezone sudah di-set (Asia/Jakarta)

### Software

- [ ] Docker sudah terinstall
- [ ] Docker Compose sudah terinstall
- [ ] Docker daemon sudah running
- [ ] User sudah dalam docker group
- [ ] Node.js 20 LTS terinstall (optional, untuk local development)

### Security

- [ ] SSH password authentication disabled
- [ ] Root login disabled
- [ ] Strong passwords untuk semua services
- [ ] `.env` file tidak commit ke repository (ada di .gitignore)
- [ ] Firewall rules sudah dikonfigurasi dengan benar
- [ ] Fail2Ban rules sudah dikonfigurasi

### Configuration

- [ ] `.env` file sudah dibuat dari `.env.example`
- [ ] Semua environment variables sudah di-set:
  - [ ] `POSTGRES_PASSWORD` - Strong password
  - [ ] `POSTGRES_DB` - Database name
  - [ ] `POSTGRES_USER` - Database user
  - [ ] `REDIS_PASSWORD` - Strong password
  - [ ] `TELEGRAM_BOT_TOKEN` - Valid bot token
  - [ ] `TELEGRAM_CHAT_ID` - Valid chat ID
  - [ ] `N8N_USER` - n8n username
  - [ ] `N8N_PASSWORD` - Strong password
- [ ] Timezone sudah sesuai

## Deployment Steps

### Step 1: Repository Setup

- [ ] Repository sudah di-clone
- [ ] Branch yang benar (main/master)
- [ ] Latest code sudah di-pull

### Step 2: Database Setup

- [ ] PostgreSQL container sudah running
- [ ] Databases sudah dibuat (`memecoin_hunter`, `n8n`)
- [ ] Database schema sudah dibuat
- [ ] Database connection test berhasil
- [ ] Database user memiliki permissions yang benar

### Step 3: Service Build

- [ ] Dependencies sudah di-install untuk semua services
- [ ] TypeScript sudah di-compile untuk semua services
- [ ] Build errors sudah diperbaiki
- [ ] Docker images sudah di-build

### Step 4: Service Start

- [ ] Semua containers sudah di-start
- [ ] Semua containers status "Up (healthy)"
- [ ] Tidak ada error di logs
- [ ] Health checks semua pass

### Step 5: Verification

- [ ] Crawler service running dan logging
- [ ] Analyzer service running dan listening
- [ ] Telegram bot running dan responsive
- [ ] n8n accessible via browser/tunnel
- [ ] Database memiliki data (setelah crawler run)
- [ ] Redis queue working

## Post-Deployment

### Monitoring Setup

- [ ] Health check script sudah di-setup
- [ ] Cron job untuk health check sudah dikonfigurasi
- [ ] Log rotation sudah dikonfigurasi
- [ ] Monitoring tools terinstall (htop, iotop, etc.)

### Backup Setup

- [ ] Backup script sudah di-setup
- [ ] Backup directory sudah dibuat
- [ ] Cron job untuk backup sudah dikonfigurasi
- [ ] Backup restoration sudah di-test

### n8n Workflow

- [ ] n8n workflow sudah di-import
- [ ] Credentials sudah dikonfigurasi (PostgreSQL, Telegram)
- [ ] Chat ID sudah di-set
- [ ] Workflow sudah di-activate
- [ ] Workflow execution berhasil

### Optimization

- [ ] System optimization sudah dijalankan
- [ ] PostgreSQL optimization config sudah di-apply
- [ ] Resource limits sudah di-optimize
- [ ] Docker daemon sudah di-optimize
- [ ] System swappiness sudah di-optimize

### Documentation

- [ ] Documentation sudah di-review
- [ ] Team sudah familiar dengan setup
- [ ] Runbook sudah tersedia
- [ ] Contact information untuk support sudah jelas

## Ongoing Maintenance

### Daily

- [ ] Health check status reviewed
- [ ] Error logs checked
- [ ] Resource usage monitored

### Weekly

- [ ] Backup verified
- [ ] Logs reviewed
- [ ] Performance metrics checked
- [ ] Security updates checked

### Monthly

- [ ] Database optimization (vacuum, analyze)
- [ ] Old data cleanup
- [ ] Security audit
- [ ] System updates
- [ ] Documentation updates

## Emergency Procedures

### Service Down

- [ ] Check container status: `docker compose ps`
- [ ] Check logs: `docker compose logs <service>`
- [ ] Check resources: `docker stats`, `free -h`
- [ ] Restart service: `docker compose restart <service>`
- [ ] Rebuild if needed: `docker compose up -d --build <service>`

### Database Issues

- [ ] Check PostgreSQL status
- [ ] Check database connection
- [ ] Check disk space
- [ ] Check database logs
- [ ] Restore from backup if needed

### Performance Issues

- [ ] Check resource usage
- [ ] Check database query performance
- [ ] Check Redis queue length
- [ ] Review optimization settings
- [ ] Scale resources if needed

## Sign-off

- [ ] All pre-deployment items checked
- [ ] All deployment steps completed
- [ ] All post-deployment items completed
- [ ] System tested and verified
- [ ] Team trained and ready

**Deployed by:** _________________  
**Date:** _________________  
**Version:** _________________


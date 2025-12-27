# Phase 6 - Deployment & Optimization Quick Start

Quick reference guide untuk deployment dan optimasi.

## 🚀 Quick Deployment

```bash
# 1. Clone repository
git clone <repo-url> bot-memecoin-hunter
cd bot-memecoin-hunter

# 2. Setup environment
cp .env.example .env
nano .env  # Edit dengan credentials production

# 3. Initialize databases
./scripts/init_databases.sh
./scripts/create_schema.sh

# 4. Build & start
cd services/crawler && npm install && npm run build && cd ../..
cd services/analyzer && npm install && npm run build && cd ../..
cd services/telegram-bot && npm install && npm run build && cd ../..

docker compose up -d --build

# 5. Verify
./scripts/health_check.sh
```

## ⚡ Quick Optimization

### 1. PostgreSQL Optimization

Edit `docker-compose.yml` untuk PostgreSQL:

```yaml
postgres:
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./config/postgresql.conf:/etc/postgresql/postgresql.conf
  command: postgres -c config_file=/etc/postgresql/postgresql.conf
```

### 2. System Optimization

```bash
# Reduce swappiness
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Restart Docker (if config changed)
sudo systemctl restart docker
```

### 3. Resource Limits

Lihat `PHASE6_DEPLOYMENT_OPTIMIZATION.md` untuk detail resource limits.

## 📊 Quick Health Check

```bash
# Run health check
./scripts/health_check.sh

# Check specific service
docker compose logs --tail=50 <service>
docker compose ps
```

## 💾 Quick Backup

```bash
# Manual backup
./scripts/backup_database.sh

# Setup automated backup (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/ubuntu/project/bot-memecoin-hunter/bot-memecoin-hunter/scripts/backup_database.sh
```

## 🔍 Quick Troubleshooting

```bash
# Check all services
docker compose ps

# Check logs
docker compose logs --tail=50

# Check resources
docker stats
free -h
df -h

# Restart services
docker compose restart

# Rebuild services
docker compose up -d --build
```

## 📚 Full Documentation

Lihat [PHASE6_DEPLOYMENT_OPTIMIZATION.md](./PHASE6_DEPLOYMENT_OPTIMIZATION.md) untuk:
- Detailed deployment steps
- Complete optimization guide
- Scaling strategies
- Complete troubleshooting checklist


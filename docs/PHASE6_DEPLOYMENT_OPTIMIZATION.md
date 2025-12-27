# Phase 6 - Deployment & Optimization

Dokumentasi lengkap untuk deployment production dan optimasi sistem di VPS 8GB.

## 📋 Table of Contents

1. [Deployment Steps](#deployment-steps)
2. [Health Check Strategy](#health-check-strategy)
3. [CPU & RAM Optimization](#cpu--ram-optimization)
4. [Scaling Guidance](#scaling-guidance)
5. [Troubleshooting Checklist](#troubleshooting-checklist)

---

## 🚀 Deployment Steps

### Pre-Deployment Checklist

- [ ] VPS sudah setup (Phase 1)
- [ ] Docker & Docker Compose terinstall
- [ ] `.env` file sudah dikonfigurasi
- [ ] SSH access sudah secure
- [ ] Firewall sudah dikonfigurasi
- [ ] Domain/subdomain sudah diarahkan (jika ada)

### Step 1: Clone Repository

```bash
cd ~/project
git clone <repository-url> bot-memecoin-hunter
cd bot-memecoin-hunter
```

### Step 2: Environment Configuration

```bash
# Copy .env.example
cp .env.example .env

# Edit .env dengan konfigurasi production
nano .env
```

Pastikan semua variabel sudah di-set:
- `POSTGRES_PASSWORD` - Password yang kuat
- `REDIS_PASSWORD` - Password yang kuat
- `TELEGRAM_BOT_TOKEN` - Token bot Telegram
- `TELEGRAM_CHAT_ID` - Chat ID untuk notifikasi
- `N8N_USER` & `N8N_PASSWORD` - Credentials untuk n8n

### Step 3: Initialize Databases

```bash
# Pastikan containers sudah running
docker compose up -d postgres redis

# Tunggu postgres ready
sleep 10

# Initialize databases
./scripts/init_databases.sh

# Create schema
./scripts/create_schema.sh
```

### Step 4: Build & Start Services

```bash
# Build TypeScript untuk semua services
cd services/crawler && npm install && npm run build && cd ../..
cd services/analyzer && npm install && npm run build && cd ../..
cd services/telegram-bot && npm install && npm run build && cd ../..

# Build dan start semua containers
docker compose up -d --build

# Verify semua services running
docker compose ps
```

### Step 5: Verify Services

```bash
# Check service status
docker compose ps

# Check logs untuk errors
docker compose logs --tail=50

# Check health status
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"
```

### Step 6: Setup n8n Workflow (Optional)

```bash
# Import workflow ke n8n
# Follow: docs/PHASE5_N8N_WORKFLOW.md
```

### Step 7: Setup Monitoring (Recommended)

```bash
# Install monitoring tools (optional)
# Contoh: Prometheus, Grafana, atau simple health check script
```

### Step 8: Setup Backup (Critical)

```bash
# Setup automated backup untuk database
# Lihat section Backup Strategy
```

---

## 🏥 Health Check Strategy

### Service-Level Health Checks

#### PostgreSQL

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-memecoin_user}"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

**Manual Check:**
```bash
docker compose exec postgres pg_isready -U memecoin_user
```

#### Redis

```yaml
healthcheck:
  test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
  interval: 10s
  timeout: 3s
  retries: 5
  start_period: 10s
```

**Manual Check:**
```bash
docker compose exec redis redis-cli ping
```

#### n8n

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5678/healthz"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

**Manual Check:**
```bash
curl http://localhost:5678/healthz
```

#### Node.js Services (Crawler, Analyzer, Telegram Bot)

Health check script: `healthcheck.js`

**Manual Check:**
```bash
# Check container status
docker compose ps crawler analyzer telegram-bot

# Check logs
docker compose logs --tail=20 crawler
```

### Application-Level Health Checks

#### Database Connection

```bash
# Test connection dari container
docker compose exec crawler node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});
pool.query('SELECT NOW()').then(() => {
  console.log('✅ Database connection OK');
  process.exit(0);
}).catch((e) => {
  console.error('❌ Database connection failed:', e.message);
  process.exit(1);
});
"
```

#### Redis Connection

```bash
docker compose exec crawler node -e "
const { createClient } = require('redis');
const client = createClient({
  socket: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
  password: process.env.REDIS_PASSWORD,
});
client.connect().then(() => {
  console.log('✅ Redis connection OK');
  client.quit();
  process.exit(0);
}).catch((e) => {
  console.error('❌ Redis connection failed:', e.message);
  process.exit(1);
});
"
```

### Automated Health Check Script

Create `scripts/health_check.sh`:

```bash
#!/bin/bash
# Health check script untuk semua services

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_ok() { echo -e "${GREEN}✅${NC} $1"; }
log_error() { echo -e "${RED}❌${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠️${NC} $1"; }

echo "=== Health Check ==="
echo ""

# Check Docker
if ! docker ps > /dev/null 2>&1; then
    log_error "Docker tidak running"
    exit 1
fi

# Check containers
log_ok "Checking containers..."
if ! docker compose ps | grep -q "Up (healthy)"; then
    log_warn "Beberapa container tidak healthy"
    docker compose ps
fi

# Check PostgreSQL
log_ok "Checking PostgreSQL..."
if docker compose exec -T postgres pg_isready -U memecoin_user > /dev/null 2>&1; then
    log_ok "PostgreSQL OK"
else
    log_error "PostgreSQL tidak healthy"
fi

# Check Redis
log_ok "Checking Redis..."
if docker compose exec -T redis redis-cli ping | grep -q "PONG"; then
    log_ok "Redis OK"
else
    log_error "Redis tidak healthy"
fi

# Check n8n
log_ok "Checking n8n..."
if curl -sf http://localhost:5678/healthz > /dev/null 2>&1; then
    log_ok "n8n OK"
else
    log_warn "n8n tidak accessible"
fi

# Check services logs for errors
log_ok "Checking service logs..."
ERROR_COUNT=$(docker compose logs --tail=100 2>&1 | grep -i "error\|fatal\|failed" | wc -l)
if [ "$ERROR_COUNT" -gt 0 ]; then
    log_warn "Found $ERROR_COUNT errors in logs"
    docker compose logs --tail=20 | grep -i "error\|fatal" | tail -5
else
    log_ok "No recent errors in logs"
fi

echo ""
echo "=== Health Check Complete ==="
```

### Health Check Monitoring

Setup cron job untuk regular health checks:

```bash
# Add to crontab
crontab -e

# Run health check every 5 minutes
*/5 * * * * /home/ubuntu/project/bot-memecoin-hunter/bot-memecoin-hunter/scripts/health_check.sh >> /var/log/memecoin-health.log 2>&1
```

---

## ⚡ CPU & RAM Optimization for 8GB VPS

### Current Resource Allocation

```yaml
Total: 8GB RAM, 4 vCPU

PostgreSQL:  512M RAM, 0.5 CPU (limit) / 256M, 0.25 CPU (reserve)
Redis:       256M RAM, 0.25 CPU (limit) / 128M, 0.1 CPU (reserve)
n8n:         1G RAM, 1 CPU (limit) / 512M, 0.5 CPU (reserve)
Crawler:     1G RAM, 1 CPU (limit) / 512M, 0.5 CPU (reserve)
Analyzer:    1G RAM, 1 CPU (limit) / 512M, 0.5 CPU (reserve)
Telegram Bot: 512M RAM, 0.5 CPU (limit) / 256M, 0.25 CPU (reserve)

Total Reserved: ~2.1GB RAM, ~2.1 CPU
Total Limit:    ~4.3GB RAM, ~4.25 CPU
Available:      ~3.7GB RAM, ~1.75 CPU (for system, Docker overhead, etc.)
```

### Optimization Strategies

#### 1. PostgreSQL Optimization

Edit `docker-compose.yml` untuk PostgreSQL:

```yaml
postgres:
  environment:
    # Memory settings
    - shared_buffers=128MB          # 25% of allocated RAM
    - effective_cache_size=384MB    # 75% of allocated RAM
    - maintenance_work_mem=64MB
    - work_mem=4MB                  # Per connection
    - max_connections=50            # Limit connections
    - checkpoint_completion_target=0.9
    - wal_buffers=16MB
    - default_statistics_target=100
    # CPU settings
    - max_parallel_workers_per_gather=1
    - max_parallel_workers=2
```

**PostgreSQL Configuration File** (create `postgresql.conf`):

```conf
# Memory Configuration
shared_buffers = 128MB
effective_cache_size = 384MB
maintenance_work_mem = 64MB
work_mem = 4MB
max_connections = 50

# CPU Configuration
max_parallel_workers_per_gather = 1
max_parallel_workers = 2

# Checkpoint Configuration
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Query Performance
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

Mount config file:
```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
  - ./config/postgresql.conf:/etc/postgresql/postgresql.conf
command: postgres -c config_file=/etc/postgresql/postgresql.conf
```

#### 2. Redis Optimization

Redis sudah di-optimize dengan:
- `maxmemory 256mb`
- `maxmemory-policy allkeys-lru`

**Additional Optimization:**

```yaml
redis:
  command: >
    redis-server
    --requirepass ${REDIS_PASSWORD}
    --maxmemory 256mb
    --maxmemory-policy allkeys-lru
    --maxmemory-samples 5
    --save ""
    --appendonly no
```

Note: `--save ""` dan `--appendonly no` untuk disable persistence jika data loss acceptable (Redis hanya digunakan untuk queue/cache).

#### 3. Node.js Services Optimization

**Crawler Service:**

```yaml
crawler:
  environment:
    - NODE_OPTIONS=--max-old-space-size=768  # Limit heap to 768MB
    - UV_THREADPOOL_SIZE=4                   # Limit thread pool
  deploy:
    resources:
      limits:
        memory: 1G
        cpus: '1.0'
      reservations:
        memory: 512M
        cpus: '0.5'
```

**Analyzer Service:**

```yaml
analyzer:
  environment:
    - NODE_OPTIONS=--max-old-space-size=768
    - UV_THREADPOOL_SIZE=4
  deploy:
    resources:
      limits:
        memory: 1G
        cpus: '1.0'
      reservations:
        memory: 512M
        cpus: '0.5'
```

**Telegram Bot:**

```yaml
telegram-bot:
  environment:
    - NODE_OPTIONS=--max-old-space-size=384
  deploy:
    resources:
      limits:
        memory: 512M
        cpus: '0.5'
      reservations:
        memory: 256M
        cpus: '0.25'
```

#### 4. n8n Optimization

```yaml
n8n:
  environment:
    - NODE_OPTIONS=--max-old-space-size=768
    - EXECUTIONS_DATA_PRUNE=true
    - EXECUTIONS_DATA_MAX_AGE=168  # Keep only 7 days
    - EXECUTIONS_DATA_PRUNE_MAX_COUNT=100
  deploy:
    resources:
      limits:
        memory: 1G
        cpus: '1.0'
      reservations:
        memory: 512M
        cpus: '0.5'
```

#### 5. System-Level Optimization

**Docker Daemon Configuration:**

Create `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  }
}
```

Restart Docker:
```bash
sudo systemctl restart docker
```

**System Swappiness:**

```bash
# Reduce swappiness (default 60, reduce to 10)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

**OOM Killer Adjustment:**

```bash
# Protect important processes from OOM killer
echo 'vm.oom_kill_allocating_task = 0' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### 6. Application-Level Optimization

**Database Connection Pooling:**

Limit connection pool di setiap service:
- Max connections: 20 per service
- Idle timeout: 30s
- Connection timeout: 2s

**Redis Connection Pooling:**

Reuse Redis connections, limit concurrent connections.

**Crawler Interval:**

Adjust `CRAWLER_INTERVAL` berdasarkan load:
- Default: 300000ms (5 minutes)
- High load: 600000ms (10 minutes)
- Low load: 120000ms (2 minutes)

---

## 📈 Scaling Guidance

### Vertical Scaling (Same VPS)

#### Upgrade VPS Resources

Jika VPS 8GB tidak cukup:

1. **Upgrade ke 16GB RAM, 8 vCPU:**
   - Double semua resource limits
   - Increase PostgreSQL `shared_buffers` to 256MB
   - Increase Redis `maxmemory` to 512MB

2. **Upgrade ke 32GB RAM, 16 vCPU:**
   - Increase PostgreSQL `shared_buffers` to 512MB
   - Increase Redis `maxmemory` to 1GB
   - Increase Node.js services memory limits

#### Optimize Current Resources

Sebelum upgrade, coba optimasi:

1. **Reduce Resource Usage:**
   ```yaml
   # Reduce n8n memory
   n8n:
     deploy:
       resources:
         limits:
           memory: 768M  # From 1G
   ```

2. **Scale Down Non-Critical Services:**
   ```yaml
   # Reduce telegram-bot if not critical
   telegram-bot:
     deploy:
       resources:
         limits:
           memory: 256M  # From 512M
           cpus: '0.25'  # From 0.5
   ```

3. **Increase Crawler Interval:**
   ```bash
   # In .env
   CRAWLER_INTERVAL=600000  # 10 minutes instead of 5
   ```

### Horizontal Scaling (Multiple VPS)

#### Option 1: Separate Services

**VPS 1 (Main):**
- PostgreSQL
- Redis
- n8n
- Telegram Bot

**VPS 2 (Worker):**
- Crawler
- Analyzer

**VPS 3 (Optional Worker):**
- Additional Analyzer instances (load balancing)

#### Option 2: Database Separation

**VPS 1 (Database):**
- PostgreSQL (dedicated)
- Redis (dedicated)

**VPS 2 (Application):**
- Crawler
- Analyzer
- Telegram Bot
- n8n

#### Network Configuration

Untuk multi-VPS setup:

1. **Private Network/VPN:**
   - Setup VPN atau private network antar VPS
   - Connect services via private IP

2. **Database Connection:**
   ```yaml
   # VPS 2 - Application
   environment:
     - POSTGRES_HOST=<VPS1_PRIVATE_IP>
     - REDIS_HOST=<VPS1_PRIVATE_IP>
   ```

3. **Security:**
   - Firewall rules untuk allow only specific IPs
   - Use strong passwords
   - Enable SSL/TLS untuk database connections

### Load Balancing

#### Multiple Analyzer Instances

```yaml
analyzer-1:
  # ... same config
analyzer-2:
  # ... same config
analyzer-3:
  # ... same config
```

Redis queue akan secara otomatis distribute jobs ke semua analyzer instances.

#### Database Read Replicas

Untuk high read load, setup PostgreSQL read replica:

1. Setup streaming replication
2. Point read queries ke replica
3. Write queries tetap ke primary

---

## 🔍 Troubleshooting Checklist

### Service Won't Start

- [ ] Check Docker is running: `docker ps`
- [ ] Check container logs: `docker compose logs <service>`
- [ ] Check disk space: `df -h`
- [ ] Check memory: `free -h`
- [ ] Check Docker resources: `docker stats`
- [ ] Check `.env` file exists and has correct values
- [ ] Check database is running: `docker compose ps postgres`
- [ ] Check Redis is running: `docker compose ps redis`

### Database Connection Errors

- [ ] Verify database exists: `./scripts/init_databases.sh`
- [ ] Check database credentials in `.env`
- [ ] Check environment variables in container: `docker compose exec <service> env | grep POSTGRES`
- [ ] Test connection manually: `docker compose exec postgres psql -U memecoin_user -d memecoin_hunter`
- [ ] Check PostgreSQL logs: `docker compose logs postgres`
- [ ] Verify schema exists: `./scripts/create_schema.sh`

### High Memory Usage

- [ ] Check memory usage: `docker stats`
- [ ] Check system memory: `free -h`
- [ ] Check OOM killer: `dmesg | grep -i oom`
- [ ] Reduce resource limits in `docker-compose.yml`
- [ ] Increase crawler interval
- [ ] Check for memory leaks in logs
- [ ] Restart services: `docker compose restart`

### High CPU Usage

- [ ] Check CPU usage: `docker stats`
- [ ] Check system load: `uptime` or `htop`
- [ ] Identify service with high CPU: `docker stats --no-stream`
- [ ] Check service logs for errors
- [ ] Reduce CPU limits if needed
- [ ] Optimize database queries
- [ ] Reduce crawler frequency

### Services Keep Restarting

- [ ] Check health check configuration
- [ ] Check container logs: `docker compose logs <service>`
- [ ] Check exit codes: `docker compose ps`
- [ ] Verify dependencies are healthy
- [ ] Check resource limits (might be OOM killing)
- [ ] Check disk space
- [ ] Verify environment variables

### No Data in Database

- [ ] Check crawler is running: `docker compose logs crawler`
- [ ] Check analyzer is running: `docker compose logs analyzer`
- [ ] Verify Redis queue has jobs: `docker compose exec redis redis-cli LLEN crawler:new-coin`
- [ ] Check database for data: `docker compose exec postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT COUNT(*) FROM coins;"`
- [ ] Check for errors in crawler/analyzer logs
- [ ] Verify API keys/tokens are valid

### Telegram Notifications Not Working

- [ ] Verify bot token is correct: `curl https://api.telegram.org/bot<TOKEN>/getMe`
- [ ] Check chat ID is correct
- [ ] Check telegram-bot logs: `docker compose logs telegram-bot`
- [ ] Verify bot has permission to send messages
- [ ] Check n8n workflow is active (if using n8n)
- [ ] Test Telegram API manually

### n8n Not Accessible

- [ ] Check n8n is running: `docker compose ps n8n`
- [ ] Check n8n logs: `docker compose logs n8n`
- [ ] Verify port is accessible: `curl http://localhost:5678/healthz`
- [ ] Check firewall rules: `sudo ufw status`
- [ ] Verify Cloudflared/tunnel is running (if using)
- [ ] Check n8n database connection

### Performance Issues

- [ ] Check database query performance
- [ ] Check Redis queue length (might be backlog)
- [ ] Verify indexes exist: `docker compose exec postgres psql -U memecoin_user -d memecoin_hunter -c "\di"`
- [ ] Check for slow queries in logs
- [ ] Verify resource limits are appropriate
- [ ] Check system I/O: `iostat -x 1`
- [ ] Monitor network: `iftop` or `nethogs`

### Disk Space Issues

- [ ] Check disk usage: `df -h`
- [ ] Check Docker disk usage: `docker system df`
- [ ] Clean up Docker: `docker system prune -a`
- [ ] Clean up old logs: `docker compose logs --tail=0`
- [ ] Archive old database data
- [ ] Clean n8n execution data (if enabled)

### Network Issues

- [ ] Check network connectivity: `ping <host>`
- [ ] Verify Docker network: `docker network inspect memecoin-network`
- [ ] Check DNS resolution: `nslookup <hostname>`
- [ ] Verify ports are not blocked: `netstat -tulpn`
- [ ] Check firewall rules: `sudo ufw status`
- [ ] Test service-to-service communication

### Backup & Recovery Issues

- [ ] Verify backup script is running
- [ ] Test backup restoration
- [ ] Check backup storage has space
- [ ] Verify backup file integrity
- [ ] Check backup logs for errors

### Security Issues

- [ ] Verify all services use strong passwords
- [ ] Check for exposed ports: `sudo netstat -tulpn`
- [ ] Review firewall rules: `sudo ufw status verbose`
- [ ] Check for unauthorized access in logs
- [ ] Verify SSL/TLS is enabled (if applicable)
- [ ] Review user permissions

---

## 📊 Monitoring Recommendations

### Basic Monitoring

1. **System Resources:**
   ```bash
   # Install monitoring tools
   sudo apt install htop iotop nethogs
   
   # Regular checks
   htop          # CPU, RAM usage
   iotop         # I/O usage
   nethogs       # Network usage
   ```

2. **Docker Monitoring:**
   ```bash
   # Resource usage
   docker stats
   
   # Container status
   docker compose ps
   ```

3. **Application Monitoring:**
   - Check logs regularly: `docker compose logs --tail=50`
   - Monitor error rates
   - Track database query performance

### Advanced Monitoring (Optional)

1. **Prometheus + Grafana:**
   - Setup Prometheus untuk metrics collection
   - Grafana untuk visualization
   - Export metrics dari services

2. **Log Aggregation:**
   - ELK Stack (Elasticsearch, Logstash, Kibana)
   - Or simpler: centralized log file dengan rotation

3. **Alerting:**
   - Setup alerts untuk:
     - High memory usage (>80%)
     - High CPU usage (>90%)
     - Service down
     - Disk space low (<20% free)
     - Database connection errors

---

## 🔄 Backup Strategy

### Database Backup

Create `scripts/backup_database.sh`:

```bash
#!/bin/bash
# Automated database backup script

BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/memecoin_hunter_$DATE.sql"

mkdir -p $BACKUP_DIR

# Backup database
docker compose exec -T postgres pg_dump -U memecoin_user memecoin_hunter > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

Setup cron:
```bash
# Daily backup at 2 AM
0 2 * * * /home/ubuntu/project/bot-memecoin-hunter/bot-memecoin-hunter/scripts/backup_database.sh
```

### Redis Backup (if needed)

```bash
# Redis persistence is disabled for queue
# If needed, enable AOF or RDB snapshots
```

---

## 📝 Maintenance Schedule

### Daily

- [ ] Check service status
- [ ] Review error logs
- [ ] Monitor resource usage

### Weekly

- [ ] Review performance metrics
- [ ] Check disk space
- [ ] Verify backups
- [ ] Update dependencies (if needed)

### Monthly

- [ ] Review and optimize database
- [ ] Clean up old data
- [ ] Review security logs
- [ ] Update system packages
- [ ] Review and update documentation

---

## 🎯 Production Readiness Checklist

- [ ] All services running and healthy
- [ ] Health checks configured
- [ ] Monitoring setup
- [ ] Backup strategy implemented
- [ ] Security hardened
- [ ] Resource limits optimized
- [ ] Logging configured
- [ ] Error handling implemented
- [ ] Documentation complete
- [ ] Disaster recovery plan ready

---

## 📚 Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [PostgreSQL Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Redis Optimization](https://redis.io/docs/management/optimization/)
- [Node.js Performance](https://nodejs.org/en/docs/guides/simple-profiling/)


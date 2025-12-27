#!/bin/bash
# Setup basic monitoring and health checks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${NC}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

log_info "=== Setting Up Monitoring ==="
echo ""

# 1. Setup cron jobs
log_info "Setting up cron jobs..."

# Backup crontab
crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S).txt 2>/dev/null || true

# Add health check cron (every 5 minutes)
HEALTH_CHECK_CRON="*/5 * * * * $PROJECT_DIR/scripts/health_check.sh >> /var/log/memecoin-health.log 2>&1"
(crontab -l 2>/dev/null | grep -v "health_check.sh"; echo "$HEALTH_CHECK_CRON") | crontab -

# Add database backup cron (daily at 2 AM)
BACKUP_CRON="0 2 * * * $PROJECT_DIR/scripts/backup_database.sh >> /var/log/memecoin-backup.log 2>&1"
(crontab -l 2>/dev/null | grep -v "backup_database.sh"; echo "$BACKUP_CRON") | crontab -

log_ok "Cron jobs configured"

# 2. Create log directory
log_info "Creating log directories..."
sudo mkdir -p /var/log
sudo touch /var/log/memecoin-health.log /var/log/memecoin-backup.log
sudo chown $USER:$USER /var/log/memecoin-*.log 2>/dev/null || log_warn "Could not change log file ownership (may need sudo)"

log_ok "Log directories created"

# 3. Setup log rotation
log_info "Setting up log rotation..."
sudo tee /etc/logrotate.d/memecoin-hunter > /dev/null << 'LOGROTATE'
/var/log/memecoin-*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 ubuntu ubuntu
}
LOGROTATE

log_ok "Log rotation configured"

# 4. Install monitoring tools (optional)
log_info "Installing basic monitoring tools..."
if command -v htop > /dev/null 2>&1; then
    log_ok "htop already installed"
else
    sudo apt-get update -qq && sudo apt-get install -y htop iotop nethogs > /dev/null 2>&1 && log_ok "Monitoring tools installed" || log_warn "Could not install monitoring tools"
fi

# 5. Display cron jobs
log_info "Current cron jobs:"
crontab -l | grep -E "health_check|backup_database" || log_warn "No cron jobs found"

echo ""
log_ok "Monitoring setup complete!"
log_info ""
log_info "Cron jobs:"
log_info "  - Health check: Every 5 minutes → /var/log/memecoin-health.log"
log_info "  - Database backup: Daily at 2 AM → /var/log/memecoin-backup.log"
log_info ""
log_info "View logs:"
log_info "  tail -f /var/log/memecoin-health.log"
log_info "  tail -f /var/log/memecoin-backup.log"


#!/bin/bash
# Setup cron jobs untuk health check dan backup

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

log_info "=== Setting Up Cron Jobs ==="
echo ""

# Backup existing crontab
BACKUP_FILE="/tmp/crontab_backup_$(date +%Y%m%d_%H%M%S).txt"
if crontab -l > "$BACKUP_FILE" 2>/dev/null; then
    log_ok "Existing crontab backed up to: $BACKUP_FILE"
else
    log_info "No existing crontab found (will create new)"
fi

# Get absolute paths
HEALTH_CHECK_SCRIPT="$PROJECT_DIR/scripts/health_check.sh"
BACKUP_SCRIPT="$PROJECT_DIR/scripts/backup_database.sh"

# Verify scripts exist
if [ ! -f "$HEALTH_CHECK_SCRIPT" ]; then
    log_error "Health check script not found: $HEALTH_CHECK_SCRIPT"
    exit 1
fi

if [ ! -f "$BACKUP_SCRIPT" ]; then
    log_error "Backup script not found: $BACKUP_SCRIPT"
    exit 1
fi

# Make scripts executable
chmod +x "$HEALTH_CHECK_SCRIPT" "$BACKUP_SCRIPT"

# Create log directory
mkdir -p /var/log 2>/dev/null || true
touch /var/log/memecoin-health.log /var/log/memecoin-backup.log 2>/dev/null || true

# Get current crontab
CURRENT_CRON=$(crontab -l 2>/dev/null || echo "")

# Remove existing entries for our scripts
CURRENT_CRON=$(echo "$CURRENT_CRON" | grep -v "health_check.sh" | grep -v "backup_database.sh" || true)

# Add new cron entries
HEALTH_CHECK_CRON="*/5 * * * * $HEALTH_CHECK_SCRIPT >> /var/log/memecoin-health.log 2>&1"
BACKUP_CRON="0 2 * * * $BACKUP_SCRIPT >> /var/log/memecoin-backup.log 2>&1"

# Combine all cron entries
NEW_CRON="${CURRENT_CRON}"$'\n'
NEW_CRON="${NEW_CRON}# Memecoin Hunter - Health Check (every 5 minutes)"$'\n'
NEW_CRON="${NEW_CRON}${HEALTH_CHECK_CRON}"$'\n'
NEW_CRON="${NEW_CRON}# Memecoin Hunter - Database Backup (daily at 2 AM)"$'\n'
NEW_CRON="${NEW_CRON}${BACKUP_CRON}"

# Install new crontab
echo "$NEW_CRON" | crontab -

log_ok "Cron jobs installed successfully"
echo ""
log_info "Cron jobs:"
log_info "  Health Check: Every 5 minutes"
log_info "    → $HEALTH_CHECK_SCRIPT"
log_info "    → Log: /var/log/memecoin-health.log"
echo ""
log_info "  Database Backup: Daily at 2:00 AM"
log_info "    → $BACKUP_SCRIPT"
log_info "    → Log: /var/log/memecoin-backup.log"
echo ""
log_info "View cron jobs:"
log_info "  crontab -l"
echo ""
log_info "View logs:"
log_info "  tail -f /var/log/memecoin-health.log"
log_info "  tail -f /var/log/memecoin-backup.log"


#!/bin/bash
# Automated database backup script

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

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups/memecoin-hunter}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/memecoin_hunter_$DATE.sql"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check Docker permission
if docker ps > /dev/null 2>&1; then
    USE_SUDO=""
    COMPOSE_CMD="docker compose"
elif sudo docker ps > /dev/null 2>&1; then
    USE_SUDO="sudo"
    COMPOSE_CMD="sudo docker compose"
else
    log_error "Docker tidak dapat diakses"
    exit 1
fi

log_info "Starting database backup..."
log_info "Backup directory: $BACKUP_DIR"
log_info "Retention: $RETENTION_DAYS days"

# Check if PostgreSQL is running
if ! $COMPOSE_CMD ps postgres | grep -q "Up"; then
    log_error "PostgreSQL container is not running"
    exit 1
fi

# Read database credentials from .env
if [ ! -f .env ]; then
    log_error ".env file not found"
    exit 1
fi

POSTGRES_USER=$(grep "^POSTGRES_USER=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "memecoin_user")
POSTGRES_DB=$(grep "^POSTGRES_DB=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "memecoin_hunter")

log_info "Database: $POSTGRES_DB"
log_info "User: $POSTGRES_USER"

# Perform backup
log_info "Creating backup..."
if $COMPOSE_CMD exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_FILE" 2>/dev/null; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_ok "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"
else
    log_error "Backup failed"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Compress backup
log_info "Compressing backup..."
if gzip "$BACKUP_FILE"; then
    COMPRESSED_FILE="${BACKUP_FILE}.gz"
    COMPRESSED_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
    log_ok "Backup compressed: $COMPRESSED_FILE ($COMPRESSED_SIZE)"
else
    log_error "Compression failed"
    exit 1
fi

# Clean up old backups
log_info "Cleaning up old backups (older than $RETENTION_DAYS days)..."
OLD_BACKUPS=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS 2>/dev/null | wc -l)
if [ "$OLD_BACKUPS" -gt 0 ]; then
    find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    log_ok "Deleted $OLD_BACKUPS old backup(s)"
else
    log_info "No old backups to delete"
fi

# List current backups
log_info "Current backups:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | awk '{print "  - " $9 " (" $5 ")"}' || log_warn "No backups found"

# Calculate total backup size
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log_info "Total backup storage: $TOTAL_SIZE"

echo ""
log_ok "Backup completed successfully!"
log_info "Backup file: $COMPRESSED_FILE"


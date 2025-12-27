#!/bin/bash

# Script untuk rebuild dan fix database connection issues

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check Docker permission
if docker ps > /dev/null 2>&1; then
    USE_SUDO=""
    COMPOSE_CMD="docker compose"
elif sudo docker ps > /dev/null 2>&1; then
    USE_SUDO="sudo"
    COMPOSE_CMD="sudo docker compose"
else
    log_error "Cannot access Docker!"
    log_info "Run: newgrp docker (then run this script again)"
    exit 1
fi

log_info "=== Rebuild & Fix Database Connection ==="
log_info ""

# 1. Build TypeScript
log_info "1. Building TypeScript for all services..."
cd services/crawler && npm run build && cd ../..
cd services/analyzer && npm run build && cd ../..
cd services/telegram-bot && npm run build && cd ../..
log_info "✅ TypeScript build complete"
log_info ""

# 2. Stop services
log_info "2. Stopping services..."
$COMPOSE_CMD stop crawler analyzer telegram-bot 2>/dev/null || true
log_info "✅ Services stopped"
log_info ""

# 3. Rebuild and start services
log_info "3. Rebuilding and starting services..."
$COMPOSE_CMD up -d --build crawler analyzer telegram-bot
log_info "✅ Services rebuilt and started"
log_info ""

# 4. Wait for services to start
log_info "4. Waiting for services to initialize (10 seconds)..."
sleep 10
log_info ""

# 5. Check service status
log_info "5. Service status:"
$COMPOSE_CMD ps crawler analyzer telegram-bot
log_info ""

# 6. Check logs for database connection
log_info "6. Checking logs for database connection info..."
log_info ""
log_info "--- Crawler logs (last 20 lines with database/error keywords) ---"
$COMPOSE_CMD logs --tail=50 crawler 2>&1 | grep -i -E "database|error|fatal|connected|config" | tail -20 || log_warn "No relevant logs found"
log_info ""

log_info "--- Analyzer logs (last 20 lines with database/error keywords) ---"
$COMPOSE_CMD logs --tail=50 analyzer 2>&1 | grep -i -E "database|error|fatal|connected|config" | tail -20 || log_warn "No relevant logs found"
log_info ""

log_info "=== Complete ==="
log_info ""
log_info "Jika masih ada error, jalankan:"
log_info "  ./scripts/debug_database.sh"
log_info ""
log_info "Atau check logs secara real-time:"
log_info "  docker compose logs -f crawler"


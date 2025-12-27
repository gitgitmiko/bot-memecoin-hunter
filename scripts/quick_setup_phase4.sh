#!/bin/bash

###############################################################################
# Quick Setup Phase 4 - Tanpa newgrp (jika sudah dalam docker group)
# Run scripts secara langsung
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

# Check if we're in docker group
if groups | grep -q docker; then
    log_info "User sudah dalam docker group, menggunakan docker langsung"
    USE_SUDO=""
else
    log_warn "User belum dalam docker group"
    log_info "Menggunakan sudo untuk docker commands"
    USE_SUDO="sudo"
fi

# Check Docker permission
if ! $USE_SUDO docker ps &> /dev/null; then
    log_error "Tidak bisa akses Docker!"
    log_info "Coba: newgrp docker (lalu jalankan script lagi)"
    exit 1
fi

log_info "=== PHASE 4 QUICK SETUP ==="

# Load environment variables
if [ ! -f .env ]; then
    log_error "File .env tidak ditemukan!"
    exit 1
fi

POSTGRES_USER=$(grep "^POSTGRES_USER=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "memecoin_user")
POSTGRES_DB=$(grep "^POSTGRES_DB=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "memecoin_hunter")

# 1. Start PostgreSQL if not running
log_info "Checking PostgreSQL container..."
if ! $USE_SUDO docker compose ps postgres | grep -q "Up"; then
    log_info "Starting PostgreSQL..."
    $USE_SUDO docker compose up -d postgres
    log_info "Waiting for PostgreSQL to be ready..."
    sleep 10
fi

# 2. Create database schema
log_info "Creating database schema..."
if [ -f "scripts/create_database_schema.sql" ]; then
    $USE_SUDO docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < scripts/create_database_schema.sql
    log_info "✅ Database schema created"
else
    log_error "Schema file tidak ditemukan: scripts/create_database_schema.sql"
    exit 1
fi

# 3. Install dependencies
log_info "Installing dependencies..."
cd services/crawler && npm install --silent
cd ../analyzer && npm install --silent
cd ../telegram-bot && npm install --silent
cd ../..
log_info "✅ Dependencies installed"

# 4. Build TypeScript
log_info "Building TypeScript..."
cd services/crawler && npm run build
cd ../analyzer && npm run build
cd ../telegram-bot && npm run build
cd ../..
log_info "✅ TypeScript build complete"

log_info ""
log_info "=========================================="
log_info "✅ PHASE 4 SETUP SELESAI!"
log_info "=========================================="
log_info ""
log_info "Next steps:"
log_info "1. Pastikan TELEGRAM_BOT_TOKEN sudah di-set di .env"
log_info "2. Start services: $USE_SUDO docker compose up -d --build"
log_info "3. Monitor logs: $USE_SUDO docker compose logs -f"
log_info ""


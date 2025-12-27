#!/bin/bash

###############################################################################
# Phase 4 Setup Script
# Setup database schema and build services
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

# Check Docker permission
DOCKER_CMD="docker"
COMPOSE_CMD="docker compose"

if ! docker ps &> /dev/null; then
    log_error "Docker permission error!"
    log_info ""
    log_info "Jalankan dengan:"
    log_info "  newgrp docker ./scripts/setup_phase4.sh"
    log_info ""
    log_info "Atau gunakan docker compose exec untuk create schema:"
    log_info "  docker compose exec -T postgres psql -U memecoin_user -d memecoin_hunter < scripts/create_database_schema.sql"
    exit 1
fi

log_info "=== PHASE 4 SETUP ==="

# Load environment variables
if [ ! -f .env ]; then
    log_error "File .env tidak ditemukan!"
    exit 1
fi

POSTGRES_USER=$(grep "^POSTGRES_USER=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "memecoin_user")
POSTGRES_DB=$(grep "^POSTGRES_DB=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "memecoin_hunter")

# 1. Create database schema
log_info "Creating database schema..."

if $COMPOSE_CMD ps postgres | grep -q "Up"; then
    # PostgreSQL container is running, use docker compose exec
    $COMPOSE_CMD exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < scripts/create_database_schema.sql
    log_info "Database schema created via docker compose"
else
    log_warn "PostgreSQL container is not running"
    log_info "Schema will be created when you start services with: docker compose up -d"
    log_info "Or manually run:"
    log_info "  docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < scripts/create_database_schema.sql"
fi

# 2. Install dependencies for each service
log_info "Installing dependencies..."

cd services/crawler && npm install
cd ../analyzer && npm install
cd ../telegram-bot && npm install
cd ../..

log_info "Dependencies installed"

# 3. Build TypeScript
log_info "Building TypeScript..."

cd services/crawler && npm run build
cd ../analyzer && npm run build
cd ../telegram-bot && npm run build
cd ../..

log_info "TypeScript build complete"

log_info ""
log_info "=========================================="
log_info "PHASE 4 SETUP SELESAI!"
log_info "=========================================="
log_info ""
log_info "Next steps:"
log_info "1. Pastikan TELEGRAM_BOT_TOKEN sudah di-set di .env"
log_info "2. Jika schema belum dibuat, jalankan:"
log_info "   docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < scripts/create_database_schema.sql"
log_info "3. Start services: docker compose up -d --build"
log_info "4. Monitor logs: docker compose logs -f"
log_info ""

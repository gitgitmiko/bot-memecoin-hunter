#!/bin/bash

###############################################################################
# PHASE 2 - DOCKERIZED INFRASTRUCTURE SETUP
# Automated setup script for Docker infrastructure
###############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker tidak terinstall!"
    log_info "Jalankan Phase 1 setup terlebih dahulu"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
    log_error "Docker Compose tidak terinstall!"
    log_info "Jalankan Phase 1 setup terlebih dahulu"
    exit 1
fi

# Check Docker permission
if ! docker ps &> /dev/null; then
    log_error "Tidak dapat mengakses Docker daemon!"
    log_warn "Ini biasanya terjadi karena user belum logout/login setelah ditambahkan ke docker group"
    log_info ""
    log_info "=========================================="
    log_info "SOLUSI CEPAT:"
    log_info "=========================================="
    log_info ""
    log_info "Pilih salah satu solusi berikut:"
    log_info ""
    log_info "1. Gunakan newgrp (Quick fix):"
    log_info "   newgrp docker ./scripts/phase2_setup.sh"
    log_info ""
    log_info "2. Logout dan login kembali (Recommended):"
    log_info "   exit"
    log_info "   # Login kembali, lalu:"
    log_info "   ./scripts/phase2_setup.sh"
    log_info ""
    log_info "3. Jalankan script helper:"
    log_info "   ./scripts/fix_docker_permission.sh"
    log_info ""
    exit 1
else
    DOCKER_CMD="docker"
    COMPOSE_CMD="docker compose"
fi

# Check if .env file exists
if [ ! -f .env ]; then
    log_warn "File .env tidak ditemukan"
    if [ -f .env.example ]; then
        log_info "Membuat .env dari .env.example..."
        cp .env.example .env
        log_warn "PENTING: Edit file .env dan isi dengan konfigurasi yang benar!"
        log_warn "Gunakan: nano .env"
        log_warn "Script akan generate password secara otomatis jika diperlukan"
    else
        log_error "File .env.example tidak ditemukan!"
        exit 1
    fi
fi

# Generate strong passwords if not set
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

log_info "=== PHASE 2: DOCKERIZED INFRASTRUCTURE SETUP ==="

# Check if passwords need to be generated
if grep -q "CHANGE_THIS" .env || grep -q "YOUR_TELEGRAM_BOT_TOKEN_HERE" .env; then
    log_warn "Konfigurasi default ditemukan di .env"
    log_info "Menggenerate password yang kuat..."
    
    # Generate passwords
    POSTGRES_PASSWORD=$(generate_password)
    REDIS_PASSWORD=$(generate_password)
    N8N_PASSWORD=$(generate_password)
    
    # Update .env file
    sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
    sed -i "s|REDIS_PASSWORD=.*|REDIS_PASSWORD=${REDIS_PASSWORD}|" .env
    sed -i "s|N8N_PASSWORD=.*|N8N_PASSWORD=${N8N_PASSWORD}|" .env
    
    log_info "Password telah di-generate dan disimpan ke .env"
    log_warn "Simpan password ini di tempat yang aman!"
    echo ""
    echo "PostgreSQL Password: ${POSTGRES_PASSWORD}"
    echo "Redis Password: ${REDIS_PASSWORD}"
    echo "n8n Password: ${N8N_PASSWORD}"
    echo ""
    log_warn "JANGAN LUPA: Setup TELEGRAM_BOT_TOKEN di file .env!"
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Create logs directories
log_info "Membuat direktori logs..."
mkdir -p services/crawler/logs
mkdir -p services/analyzer/logs
mkdir -p services/telegram-bot/logs

# Build Docker images
log_info "Building Docker images..."
$COMPOSE_CMD build

# Start services
log_info "Starting services..."
$COMPOSE_CMD up -d

# Wait for services to be healthy
log_info "Menunggu services menjadi healthy..."
sleep 10

# Check service status
log_info "Checking service status..."
$COMPOSE_CMD ps

# Verify services
log_info "Verifying services..."

# Check PostgreSQL
log_info "Checking PostgreSQL..."
sleep 5
if $COMPOSE_CMD exec -T postgres pg_isready -U ${POSTGRES_USER:-memecoin_user} > /dev/null 2>&1; then
    log_info "✅ PostgreSQL is healthy"
else
    log_warn "⚠️  PostgreSQL belum ready, tunggu beberapa saat"
fi

# Check Redis
log_info "Checking Redis..."
sleep 5
# Load REDIS_PASSWORD from .env
REDIS_PASSWORD=$(grep "^REDIS_PASSWORD=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
if [ -n "$REDIS_PASSWORD" ] && $COMPOSE_CMD exec -T redis redis-cli -a "${REDIS_PASSWORD}" ping > /dev/null 2>&1; then
    log_info "✅ Redis is healthy"
else
    log_warn "⚠️  Redis belum ready, tunggu beberapa saat"
fi

# Get IP address
SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")

# Load config from .env
N8N_PORT=$(grep "^N8N_PORT=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "5678")
N8N_USER=$(grep "^N8N_USER=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "admin")
POSTGRES_PORT=$(grep "^POSTGRES_PORT=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "5432")
REDIS_PORT=$(grep "^REDIS_PORT=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "6379")

# Display service URLs
log_info ""
log_info "=========================================="
log_info "PHASE 2 SETUP SELESAI!"
log_info "=========================================="
log_info ""
log_info "Services yang berjalan:"
log_info "  - PostgreSQL: localhost:${POSTGRES_PORT}"
log_info "  - Redis: localhost:${REDIS_PORT}"
log_info "  - n8n: http://${SERVER_IP}:${N8N_PORT}"
log_info ""
log_warn "PENTING:"
log_warn "1. Akses n8n di: http://${SERVER_IP}:${N8N_PORT}"
log_warn "2. Login dengan username: ${N8N_USER}"
log_warn "3. Password n8n ada di file .env (N8N_PASSWORD)"
log_warn "4. Setup Telegram Bot Token di .env (TELEGRAM_BOT_TOKEN)"
log_warn "5. Monitor logs dengan: docker compose logs -f"
log_info ""
log_info "Lanjutkan ke Phase 3: Application Coding"
log_info ""


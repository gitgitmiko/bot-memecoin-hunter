#!/bin/bash
# Script untuk debug query n8n workflow

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

log_info "=== Debug n8n Workflow Query ==="
echo ""

# Database connection
DB_HOST=${POSTGRES_HOST:-postgres}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-memecoin_hunter}
DB_USER=${POSTGRES_USER:-memecoin_user}
DB_PASSWORD=${POSTGRES_PASSWORD}

if [ -z "$DB_PASSWORD" ]; then
    log_error "POSTGRES_PASSWORD not found in .env"
    exit 1
fi

export PGPASSWORD=$DB_PASSWORD

log_step "Step 1: Cek koneksi database..."
if docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    log_ok "Database connection OK"
else
    log_error "Cannot connect to database"
    exit 1
fi

echo ""

log_step "Step 2: Cek jumlah data..."
echo ""

COINS_COUNT=$(docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM coins;" 2>/dev/null | xargs || echo "0")
ANALYSES_COUNT=$(docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM analyses;" 2>/dev/null | xargs || echo "0")

log_info "Total coins: $COINS_COUNT"
log_info "Total analyses: $ANALYSES_COUNT"

if [ "$COINS_COUNT" -eq 0 ]; then
    log_warn "⚠️  Table 'coins' kosong!"
fi

if [ "$ANALYSES_COUNT" -eq 0 ]; then
    log_warn "⚠️  Table 'analyses' kosong!"
fi

echo ""
log_step "Step 3: Test query n8n workflow (last 2 minutes, any score)..."
echo ""

log_info "--- Query: Any score coins (last 2 minutes) ---"
docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    a.id, 
    a.coin_id, 
    a.overall_score, 
    a.price_score, 
    a.volume_score, 
    a.social_score, 
    a.risk_score, 
    a.created_at, 
    c.address, 
    c.symbol, 
    c.name, 
    c.chain_id, 
    c.liquidity, 
    COALESCE((c.raw_data->'volume'->>'h24')::numeric, 0) as volume24h 
FROM analyses a 
INNER JOIN coins c ON a.coin_id = c.id 
WHERE a.created_at >= NOW() - INTERVAL '2 minutes'
ORDER BY a.created_at DESC 
LIMIT 5;
" 2>/dev/null || log_warn "Query error"

echo ""
log_step "Step 4: Cek data dengan score tertinggi (all time)..."
echo ""

log_info "--- Top 5 analyses by score (all time) ---"
docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    a.id, 
    a.coin_id, 
    a.overall_score, 
    a.price_score, 
    a.volume_score, 
    a.social_score, 
    a.risk_score, 
    a.created_at, 
    c.address, 
    c.symbol, 
    c.name, 
    c.chain_id
FROM analyses a 
INNER JOIN coins c ON a.coin_id = c.id 
ORDER BY a.overall_score DESC 
LIMIT 5;
" 2>/dev/null || log_warn "Query error"

echo ""
log_info "=== Debug Summary ==="
echo ""
log_info "Jika query tidak mengembalikan data:"
echo "  1. Pastikan crawler dan analyzer sudah running"
echo "  2. Pastikan ada data di table coins dan analyses"
echo "  3. Untuk testing, coba ubah query di n8n:"
echo "     - Hapus filter 'last 2 minutes' (pakai 'last 1 hour')"
echo "     - Atau hapus filter score >= 70 (pakai score >= 0)"
echo ""


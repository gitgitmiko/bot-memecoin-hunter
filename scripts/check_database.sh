#!/bin/bash
# Script untuk mengecek data di database

echo "=========================================="
echo "CHECK DATABASE - Memecoin Hunter"
echo "=========================================="
echo ""

# Set warna untuk output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cek total coins
echo -e "${BLUE}📊 Total Coins di Database:${NC}"
docker-compose exec -T postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT COUNT(*) as total_coins FROM coins;"
echo ""

# Cek coins terbaru
echo -e "${BLUE}🪙 10 Coins Terbaru:${NC}"
docker-compose exec -T postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT id, address, symbol, name, chain_id, created_at FROM coins ORDER BY created_at DESC LIMIT 10;"
echo ""

# Cek total analyses
echo -e "${BLUE}📈 Total Analyses di Database:${NC}"
docker-compose exec -T postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT COUNT(*) as total_analyses FROM analyses;"
echo ""

# Cek analyses terbaru
echo -e "${BLUE}📊 10 Analyses Terbaru:${NC}"
docker-compose exec -T postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT id, coin_id, overall_score, price_score, volume_score, social_score, risk_score, created_at FROM analyses ORDER BY created_at DESC LIMIT 10;"
echo ""

# Cek coins dengan score tinggi (>70)
echo -e "${YELLOW}⭐ Coins dengan Overall Score > 70:${NC}"
docker-compose exec -T postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT c.id, c.address, c.symbol, c.name, a.overall_score, a.created_at FROM coins c JOIN analyses a ON c.id = a.coin_id WHERE a.overall_score > 70 ORDER BY a.overall_score DESC LIMIT 10;"
echo ""

# Cek raw_data sample (untuk debug)
echo -e "${BLUE}🔍 Sample Raw Data (1 coin):${NC}"
docker-compose exec -T postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT address, symbol, jsonb_pretty(raw_data::jsonb) as raw_data FROM coins LIMIT 1;"
echo ""

echo -e "${GREEN}✅ Check database selesai!${NC}"


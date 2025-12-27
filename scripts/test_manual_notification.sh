#!/bin/bash

# Script untuk test manual notification
# Update analysis score menjadi >= 70 untuk test n8n workflow

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

POSTGRES_USER=${POSTGRES_USER:-memecoin_user}
POSTGRES_DB=${POSTGRES_DB:-memecoin_hunter}

echo "🧪 TEST MANUAL NOTIFICATION"
echo "============================"
echo ""

# Cek analysis yang ada
echo "📊 Analysis saat ini:"
docker-compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    a.id, 
    a.coin_id, 
    a.overall_score, 
    c.address, 
    c.symbol,
    a.created_at
FROM analyses a 
INNER JOIN coins c ON a.coin_id = c.id 
ORDER BY a.created_at DESC 
LIMIT 5;
"

echo ""
echo "🔄 Update analysis score menjadi 75 (>= 70)..."
echo ""

# Update analysis score
docker-compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
UPDATE analyses 
SET 
    overall_score = 75,
    price_score = 80,
    volume_score = 70,
    social_score = 75,
    risk_score = 70,
    created_at = NOW()
WHERE id = (SELECT id FROM analyses ORDER BY created_at DESC LIMIT 1);
"

echo "✅ Analysis score sudah diupdate!"
echo ""

# Verifikasi
echo "📊 Analysis setelah update:"
docker-compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    a.id, 
    a.coin_id, 
    a.overall_score, 
    a.price_score,
    a.volume_score,
    a.social_score,
    a.risk_score,
    c.address, 
    c.symbol,
    a.created_at
FROM analyses a 
INNER JOIN coins c ON a.coin_id = c.id 
ORDER BY a.created_at DESC 
LIMIT 1;
"

echo ""
echo "🔍 Test query n8n (harus return 1 row):"
docker-compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    a.id, 
    a.coin_id, 
    a.overall_score, 
    c.address, 
    c.symbol,
    c.name,
    c.chain_id,
    c.liquidity,
    COALESCE((c.raw_data->'volume'->>'h24')::numeric, 0) as volume24h
FROM analyses a 
INNER JOIN coins c ON a.coin_id = c.id 
WHERE 
    a.created_at >= NOW() - INTERVAL '2 minutes' 
    AND a.overall_score >= 70 
    AND c.address IS NOT NULL 
    AND c.symbol IS NOT NULL 
    AND a.overall_score IS NOT NULL 
ORDER BY a.created_at DESC 
LIMIT 10;
"

echo ""
echo "✅ TEST MANUAL SELESAI!"
echo ""
echo "📝 Langkah selanjutnya:"
echo "  1. Tunggu n8n cron trigger (setiap 2 menit)"
echo "  2. Atau trigger manual di n8n UI"
echo "  3. Cek Telegram untuk notif"
echo ""


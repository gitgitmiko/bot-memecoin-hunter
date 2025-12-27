#!/bin/bash
# Script untuk query coins dari database

echo "=========================================="
echo "QUERY COINS - Memecoin Hunter"
echo "=========================================="
echo ""

# Query semua coins
echo "📋 Semua Coins di Database:"
echo ""
docker-compose exec -T postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT id, address, symbol, name, chain_id, liquidity::numeric::text as liquidity, TO_CHAR(created_at, 'MM/DD/YYYY, HH:MI:SS AM') as created_at FROM coins ORDER BY created_at DESC LIMIT 20;" 2>&1

echo ""
echo "=========================================="
echo ""

# Query dengan detail lebih lengkap
echo "📊 Detail Lengkap (1 coin pertama):"
echo ""
docker-compose exec -T postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT id, address, symbol, name, chain_id, liquidity, source, discovered_at, created_at FROM coins ORDER BY created_at DESC LIMIT 1;" 2>&1

echo ""
echo "=========================================="
echo ""

# Query count
echo "📈 Statistics:"
echo ""
docker-compose exec -T postgres psql -U memecoin_user -d memecoin_hunter -c "SELECT COUNT(*) as total_coins, COUNT(DISTINCT chain_id) as total_chains, SUM(liquidity)::numeric::text as total_liquidity FROM coins;" 2>&1

echo ""
echo "✅ Query selesai!"


#!/bin/bash

# Script untuk trigger analyzer memproses Solana coins yang sudah ada di DB
# Menggunakan Redis pub/sub untuk publish job

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

REDIS_PASSWORD=${REDIS_PASSWORD:-}
POSTGRES_USER=${POSTGRES_USER:-memecoin_user}
POSTGRES_DB=${POSTGRES_DB:-memecoin_hunter}

echo "🔄 Trigger Analyzer untuk Solana Coins"
echo "======================================"
echo ""

# Get Solana coins from database
echo "📊 Mengambil Solana coins dari database..."
SOLANA_COINS=$(docker-compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
SELECT json_agg(json_build_object(
    'address', address,
    'chainId', chain_id,
    'symbol', symbol,
    'name', name
))
FROM coins
WHERE chain_id = 999
AND id NOT IN (SELECT DISTINCT coin_id FROM analyses WHERE coin_id IS NOT NULL);
")

if [ -z "$SOLANA_COINS" ] || [ "$SOLANA_COINS" = "null" ] || [ "$SOLANA_COINS" = "[null]" ]; then
    echo "❌ Tidak ada Solana coins yang perlu dianalisis"
    exit 0
fi

echo "✅ Ditemukan Solana coins yang perlu dianalisis"
echo ""

# Publish each coin to Redis queue
echo "📤 Publishing jobs ke Redis queue..."
echo "$SOLANA_COINS" | python3 -c "
import sys, json, os
from redis import Redis

redis_password = os.environ.get('REDIS_PASSWORD', '')
redis_client = Redis(
    host='redis',
    port=6379,
    password=redis_password if redis_password else None,
    decode_responses=False
)

coins = json.load(sys.stdin)
count = 0

for coin in coins:
    if not coin or not coin.get('address'):
        continue
    
    job = {
        'event': 'crawler:new-coin',
        'timestamp': '2025-12-27T00:00:00.000Z',
        'data': {
            'coinAddress': coin['address'],
            'chainId': coin['chainId'],
            'source': 'dexscreener',
            'normalizedData': {
                'address': coin['address'],
                'chainId': coin['chainId'],
                'symbol': coin.get('symbol', 'UNKNOWN'),
                'name': coin.get('name', 'Unknown'),
                'volume24h': 0,
                'priceChange24h': 0,
                'transactions24h': {'buys': 0, 'sells': 0}
            }
        }
    }
    
    redis_client.publish('crawler:new-coin', json.dumps(job))
    count += 1
    print(f'Published: {coin[\"symbol\"]} ({coin[\"address\"][:20]}...)')

print(f'\\n✅ Published {count} jobs to Redis queue')
"

echo ""
echo "✅ Selesai! Analyzer akan memproses Solana coins"
echo ""


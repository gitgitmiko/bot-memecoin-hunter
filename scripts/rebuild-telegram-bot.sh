#!/bin/bash

# Script untuk rebuild dan restart telegram-bot service
# Usage: ./scripts/rebuild-telegram-bot.sh

set -e

echo "🔨 Building telegram-bot service..."
docker-compose build telegram-bot

echo "🔄 Restarting telegram-bot container..."
docker-compose restart telegram-bot

echo "✅ Rebuild dan restart selesai!"
echo ""
echo "📋 Status container:"
docker-compose ps telegram-bot

echo ""
echo "📝 Logs terakhir (20 baris):"
docker-compose logs --tail=20 telegram-bot


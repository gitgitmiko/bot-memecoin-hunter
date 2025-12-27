#!/bin/bash

###############################################################################
# Fix n8n untuk Cloudflared
# Script untuk memastikan n8n running dan bisa diakses oleh cloudflared
###############################################################################

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=========================================="
echo "FIX N8N UNTUK CLOUDFLARED"
echo "==========================================${NC}"
echo ""

# Check Docker permission
if ! docker ps &> /dev/null; then
    echo -e "${RED}❌ Docker permission error!${NC}"
    echo "Jalankan dengan: newgrp docker ./scripts/fix_n8n_cloudflared.sh"
    exit 1
fi

# Check if services are running
echo -e "${BLUE}1. Checking Docker services...${NC}"
docker compose ps

echo ""

# Check n8n container
echo -e "${BLUE}2. Checking n8n container...${NC}"
if docker compose ps n8n | grep -q "Up"; then
    echo -e "${GREEN}✅ n8n container is running${NC}"
else
    echo -e "${RED}❌ n8n container is NOT running!${NC}"
    echo "Starting n8n..."
    docker compose up -d n8n
    echo "Waiting for n8n to start..."
    sleep 10
fi

echo ""

# Check if n8n is accessible
echo -e "${BLUE}3. Testing n8n accessibility...${NC}"
N8N_PORT=$(grep "^N8N_PORT=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "5678")

# Test connection
if curl -s -o /dev/null -w "%{http_code}" http://localhost:${N8N_PORT} | grep -q "200\|401\|302"; then
    echo -e "${GREEN}✅ n8n is accessible on localhost:${N8N_PORT}${NC}"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${N8N_PORT})
    echo "   HTTP Status: $HTTP_CODE"
else
    echo -e "${RED}❌ n8n is NOT accessible on localhost:${N8N_PORT}${NC}"
    echo ""
    echo "Checking n8n logs..."
    docker compose logs n8n --tail 30
    echo ""
    echo -e "${YELLOW}Trying to restart n8n...${NC}"
    docker compose restart n8n
    echo "Waiting 15 seconds..."
    sleep 15
    
    # Test again
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:${N8N_PORT} | grep -q "200\|401\|302"; then
        echo -e "${GREEN}✅ n8n is now accessible!${NC}"
    else
        echo -e "${RED}❌ n8n still not accessible. Check logs above.${NC}"
        exit 1
    fi
fi

echo ""

# Check docker-compose.yml port mapping
echo -e "${BLUE}4. Checking port mapping...${NC}"
if docker compose ps n8n | grep -q ":${N8N_PORT}->"; then
    echo -e "${GREEN}✅ Port ${N8N_PORT} is mapped correctly${NC}"
else
    echo -e "${YELLOW}⚠️  Port mapping issue detected${NC}"
    echo "Checking docker-compose.yml..."
fi

echo ""

# Check n8n health
echo -e "${BLUE}5. Checking n8n health...${NC}"
if docker compose exec -T n8n wget --no-verbose --tries=1 --spider http://localhost:5678/healthz 2>&1 | grep -q "200 OK\|HTTP request sent"; then
    echo -e "${GREEN}✅ n8n health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  n8n health check failed (might still be starting)${NC}"
fi

echo ""

# Summary
echo -e "${GREEN}=========================================="
echo "SUMMARY"
echo "==========================================${NC}"
echo ""
echo "n8n should be accessible at:"
echo -e "${YELLOW}http://localhost:${N8N_PORT}${NC}"
echo ""
echo "If cloudflared is running, test with:"
echo -e "${YELLOW}curl -I http://localhost:${N8N_PORT}${NC}"
echo ""

# Test cloudflared connection
echo -e "${BLUE}6. Testing cloudflared connection...${NC}"
if pgrep -f "cloudflared.*5678" > /dev/null; then
    echo -e "${GREEN}✅ cloudflared is running${NC}"
    echo ""
    echo "If you still get errors, restart cloudflared:"
    echo -e "${YELLOW}cloudflared tunnel --url http://localhost:${N8N_PORT}${NC}"
else
    echo -e "${YELLOW}⚠️  cloudflared is not running${NC}"
    echo "Start cloudflared with:"
    echo -e "${YELLOW}cloudflared tunnel --url http://localhost:${N8N_PORT}${NC}"
fi

echo ""
echo -e "${GREEN}Setup complete!${NC}"


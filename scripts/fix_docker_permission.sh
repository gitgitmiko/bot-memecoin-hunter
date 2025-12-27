#!/bin/bash

###############################################################################
# Fix Docker Permission Script
# Solusi cepat untuk masalah Docker permission setelah Phase 1
###############################################################################

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=========================================="
echo "FIX DOCKER PERMISSION"
echo "==========================================${NC}"
echo ""

# Check if user is in docker group
if groups | grep -q docker; then
    echo -e "${GREEN}✅ User sudah dalam docker group${NC}"
else
    echo -e "${RED}❌ User belum dalam docker group${NC}"
    echo "Menambahkan user ke docker group..."
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✅ User ditambahkan ke docker group${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Anda perlu logout dan login kembali!${NC}"
fi

echo ""
echo "=========================================="
echo "SOLUSI UNTUK REFRESH DOCKER GROUP:"
echo "=========================================="
echo ""
echo -e "${GREEN}1. GUNAKAN NEWGRP (Quick fix - Recommended)${NC}"
echo "   newgrp docker ./scripts/phase2_setup.sh"
echo ""
echo -e "${GREEN}2. LOGOUT DAN LOGIN KEMBALI (Best practice)${NC}"
echo "   exit"
echo "   # Login kembali, lalu:"
echo "   ./scripts/phase2_setup.sh"
echo ""

# Test docker permission
echo "Testing Docker permission..."
if docker ps &> /dev/null; then
    echo -e "${GREEN}✅ Docker permission OK!${NC}"
    echo ""
    echo "Anda bisa langsung menjalankan:"
    echo "  ./scripts/phase2_setup.sh"
else
    echo -e "${RED}❌ Docker permission masih error${NC}"
    echo ""
    echo -e "${YELLOW}Jalankan salah satu solusi di atas${NC}"
    echo ""
    echo "Atau jalankan dengan newgrp:"
    echo "  newgrp docker ./scripts/phase2_setup.sh"
fi

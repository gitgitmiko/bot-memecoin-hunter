#!/bin/bash

###############################################################################
# Setup Cloudflared sebagai Systemd Service
# Agar tunnel tetap running meskipun SSH disconnect
###############################################################################

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=========================================="
echo "SETUP CLOUDFLARED AS SYSTEMD SERVICE"
echo "==========================================${NC}"
echo ""

# Get n8n port from .env
N8N_PORT=$(grep "^N8N_PORT=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "5678")

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}❌ cloudflared tidak terinstall!${NC}"
    echo "Install dulu dengan:"
    echo "curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared"
    echo "sudo mv /tmp/cloudflared /usr/local/bin/cloudflared"
    echo "sudo chmod +x /usr/local/bin/cloudflared"
    exit 1
fi

# Check if tunnel exists
TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "n8n-tunnel" | awk '{print $1}' | head -1)

if [ -z "$TUNNEL_ID" ]; then
    echo -e "${YELLOW}⚠️  Tunnel 'n8n-tunnel' tidak ditemukan${NC}"
    echo "Membuat tunnel baru..."
    cloudflared tunnel create n8n-tunnel
    TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "n8n-tunnel" | awk '{print $1}' | head -1)
fi

if [ -z "$TUNNEL_ID" ]; then
    echo -e "${RED}❌ Gagal membuat tunnel!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Tunnel ID: $TUNNEL_ID${NC}"

# Create config directory
mkdir -p ~/.cloudflared

# Create config file
echo -e "${BLUE}Membuat konfigurasi cloudflared...${NC}"
cat > ~/.cloudflared/config.yml <<EOF
tunnel: $TUNNEL_ID
credentials-file: /home/$USER/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: priority-what-francis-increasingly.trycloudflare.com
    service: http://localhost:$N8N_PORT
  - service: http_status:404
EOF

echo -e "${GREEN}✅ Config file created: ~/.cloudflared/config.yml${NC}"

# Create systemd service
echo -e "${BLUE}Membuat systemd service...${NC}"
sudo tee /etc/systemd/system/cloudflared.service > /dev/null <<EOF
[Unit]
Description=Cloudflare Tunnel for n8n
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/local/bin/cloudflared tunnel --config /home/$USER/.cloudflared/config.yml run
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
echo -e "${BLUE}Starting cloudflared service...${NC}"
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# Check status
sleep 2
if sudo systemctl is-active --quiet cloudflared; then
    echo -e "${GREEN}✅ Cloudflared service is running!${NC}"
    echo ""
    echo "Service status:"
    sudo systemctl status cloudflared --no-pager | head -10
    echo ""
    echo -e "${GREEN}=========================================="
    echo "SETUP SELESAI!"
    echo "==========================================${NC}"
    echo ""
    echo "Cloudflared akan otomatis start saat boot"
    echo ""
    echo "URL n8n:"
    echo -e "${YELLOW}https://priority-what-francis-increasingly.trycloudflare.com${NC}"
    echo ""
    echo "Commands:"
    echo "  - Status: sudo systemctl status cloudflared"
    echo "  - Logs:   sudo journalctl -u cloudflared -f"
    echo "  - Stop:   sudo systemctl stop cloudflared"
    echo "  - Start:  sudo systemctl start cloudflared"
    echo "  - Restart: sudo systemctl restart cloudflared"
else
    echo -e "${RED}❌ Gagal start service!${NC}"
    echo "Cek logs dengan: sudo journalctl -u cloudflared -n 50"
    exit 1
fi


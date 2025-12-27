#!/bin/bash

###############################################################################
# Setup n8n Access untuk VPS Private
# Script untuk mengakses n8n dari VPS dengan IP private
###############################################################################

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=========================================="
echo "SETUP N8N ACCESS UNTUK VPS PRIVATE"
echo "==========================================${NC}"
echo ""

# Get n8n port from .env
N8N_PORT=$(grep "^N8N_PORT=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "5678")
SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")

echo -e "${BLUE}Informasi n8n:${NC}"
echo "  - Port: ${N8N_PORT}"
echo "  - IP Server: ${SERVER_IP}"
echo ""

echo -e "${GREEN}=========================================="
echo "PILIHAN METODE AKSES:"
echo "==========================================${NC}"
echo ""
echo -e "${GREEN}1. SSH TUNNEL (Recommended - Paling Aman)${NC}"
echo "   Akses n8n melalui SSH tunnel dari local machine"
echo ""
echo -e "${GREEN}2. REVERSE PROXY dengan Domain${NC}"
echo "   Setup Nginx reverse proxy dengan domain (jika ada domain)"
echo ""
echo -e "${GREEN}3. TUNNELING SERVICE (ngrok/cloudflared)${NC}"
echo "   Setup public tunnel menggunakan ngrok atau cloudflared"
echo ""
echo -e "${GREEN}4. PORT FORWARDING (Jika ada Public IP)${NC}"
echo "   Setup port forwarding di router/firewall"
echo ""

read -p "Pilih metode (1-4): " choice

case $choice in
    1)
        echo ""
        echo -e "${GREEN}=== SETUP SSH TUNNEL ===${NC}"
        echo ""
        echo "Jalankan perintah berikut di LOCAL MACHINE Anda:"
        echo ""
        echo -e "${YELLOW}ssh -L ${N8N_PORT}:localhost:${N8N_PORT} ${USER}@${SERVER_IP}${NC}"
        echo ""
        echo "Atau jika menggunakan custom SSH port:"
        echo -e "${YELLOW}ssh -L ${N8N_PORT}:localhost:${N8N_PORT} -p <SSH_PORT> ${USER}@${SERVER_IP}${NC}"
        echo ""
        echo "Setelah SSH tunnel aktif, akses n8n di:"
        echo -e "${GREEN}http://localhost:${N8N_PORT}${NC}"
        echo ""
        echo "Untuk membuat tunnel di background:"
        echo -e "${YELLOW}ssh -fN -L ${N8N_PORT}:localhost:${N8N_PORT} ${USER}@${SERVER_IP}${NC}"
        ;;
    2)
        echo ""
        echo -e "${GREEN}=== SETUP REVERSE PROXY ===${NC}"
        echo ""
        echo "Installing Nginx..."
        sudo apt update
        sudo apt install -y nginx certbot python3-certbot-nginx
        
        read -p "Masukkan domain Anda (contoh: n8n.example.com): " domain
        
        echo ""
        echo "Membuat konfigurasi Nginx..."
        
        sudo tee /etc/nginx/sites-available/n8n > /dev/null <<EOF
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://localhost:${N8N_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

        sudo ln -sf /etc/nginx/sites-available/n8n /etc/nginx/sites-enabled/
        sudo nginx -t
        sudo systemctl reload nginx
        
        echo ""
        echo "Setup SSL dengan Let's Encrypt..."
        sudo certbot --nginx -d ${domain}
        
        echo ""
        echo -e "${GREEN}✅ Setup selesai!${NC}"
        echo "Akses n8n di: https://${domain}"
        ;;
    3)
        echo ""
        echo -e "${GREEN}=== SETUP TUNNELING SERVICE ===${NC}"
        echo ""
        echo "Pilih tunneling service:"
        echo "1. Cloudflared (Cloudflare Tunnel - Free)"
        echo "2. ngrok (Free tier available)"
        read -p "Pilih (1-2): " tunnel_choice
        
        case $tunnel_choice in
            1)
                echo ""
                echo "Installing Cloudflared..."
                curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared
                sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
                sudo chmod +x /usr/local/bin/cloudflared
                
                echo ""
                echo "Setup Cloudflare Tunnel..."
                echo "1. Login ke Cloudflare Dashboard"
                echo "2. Buat tunnel baru"
                echo "3. Install token yang diberikan"
                echo ""
                read -p "Masukkan Cloudflare Tunnel Token: " tunnel_token
                
                # Create systemd service
                sudo tee /etc/systemd/system/cloudflared.service > /dev/null <<EOF
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared tunnel --config /etc/cloudflared/config.yml run
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

                sudo mkdir -p /etc/cloudflared
                sudo tee /etc/cloudflared/config.yml > /dev/null <<EOF
tunnel: ${tunnel_token}
credentials-file: /etc/cloudflared/credentials.json

ingress:
  - hostname: n8n.yourdomain.com
    service: http://localhost:${N8N_PORT}
  - service: http_status:404
EOF

                echo "Setup credentials file..."
                echo "Masukkan credentials JSON dari Cloudflare Dashboard"
                sudo nano /etc/cloudflared/credentials.json
                
                sudo systemctl enable cloudflared
                sudo systemctl start cloudflared
                
                echo ""
                echo -e "${GREEN}✅ Cloudflared tunnel setup selesai!${NC}"
                ;;
            2)
                echo ""
                echo "Installing ngrok..."
                curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
                echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
                sudo apt update && sudo apt install ngrok
                
                echo ""
                echo "Setup ngrok:"
                echo "1. Daftar di https://dashboard.ngrok.com"
                echo "2. Dapatkan authtoken"
                echo ""
                read -p "Masukkan ngrok authtoken: " ngrok_token
                ngrok config add-authtoken ${ngrok_token}
                
                echo ""
                echo "Membuat systemd service untuk ngrok..."
                sudo tee /etc/systemd/system/ngrok.service > /dev/null <<EOF
[Unit]
Description=ngrok
After=network.target

[Service]
Type=simple
User=${USER}
ExecStart=/usr/bin/ngrok http ${N8N_PORT}
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

                sudo systemctl enable ngrok
                sudo systemctl start ngrok
                
                echo ""
                echo -e "${GREEN}✅ ngrok setup selesai!${NC}"
                echo "Cek URL public di: http://localhost:4040 (ngrok web interface)"
                ;;
        esac
        ;;
    4)
        echo ""
        echo -e "${GREEN}=== SETUP PORT FORWARDING ===${NC}"
        echo ""
        echo "Jika VPS memiliki Public IP, setup port forwarding:"
        echo ""
        echo "1. Buka firewall untuk port ${N8N_PORT}:"
        echo -e "${YELLOW}   sudo ufw allow ${N8N_PORT}/tcp${NC}"
        echo ""
        echo "2. Pastikan docker-compose.yml sudah expose port ${N8N_PORT}"
        echo ""
        echo "3. Akses n8n di: http://<PUBLIC_IP>:${N8N_PORT}"
        echo ""
        echo "⚠️  PENTING: Pastikan n8n menggunakan authentication!"
        echo "   Cek file .env untuk N8N_BASIC_AUTH_USER dan N8N_BASIC_AUTH_PASSWORD"
        ;;
    *)
        echo -e "${RED}Pilihan tidak valid!${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Setup selesai!${NC}"


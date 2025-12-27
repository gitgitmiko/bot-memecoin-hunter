#!/bin/bash

###############################################################################
# Troubleshoot SSH Connection
# Script untuk diagnose masalah SSH connection
###############################################################################

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=========================================="
echo "SSH CONNECTION TROUBLESHOOTING"
echo "==========================================${NC}"
echo ""

# Check SSH service status
echo -e "${BLUE}1. Checking SSH Service Status...${NC}"
if systemctl is-active --quiet sshd || systemctl is-active --quiet ssh; then
    echo -e "${GREEN}✅ SSH service is running${NC}"
    systemctl status sshd --no-pager | head -5 || systemctl status ssh --no-pager | head -5
else
    echo -e "${RED}❌ SSH service is NOT running!${NC}"
    echo "Starting SSH service..."
    sudo systemctl start sshd || sudo systemctl start ssh
    sudo systemctl enable sshd || sudo systemctl enable ssh
fi

echo ""

# Check SSH port
echo -e "${BLUE}2. Checking SSH Port...${NC}"
SSH_PORT=$(sudo grep -E "^Port|^#Port" /etc/ssh/sshd_config | grep -v "^#" | awk '{print $2}' | head -1)
if [ -z "$SSH_PORT" ]; then
    SSH_PORT=22
    echo "Using default SSH port: 22"
else
    echo "SSH port configured: $SSH_PORT"
fi

# Check if SSH is listening
echo ""
echo -e "${BLUE}3. Checking if SSH is listening on port $SSH_PORT...${NC}"
if sudo netstat -tlnp | grep -q ":$SSH_PORT " || sudo ss -tlnp | grep -q ":$SSH_PORT "; then
    echo -e "${GREEN}✅ SSH is listening on port $SSH_PORT${NC}"
    sudo netstat -tlnp | grep ":$SSH_PORT " || sudo ss -tlnp | grep ":$SSH_PORT "
else
    echo -e "${RED}❌ SSH is NOT listening on port $SSH_PORT${NC}"
fi

echo ""

# Check firewall
echo -e "${BLUE}4. Checking Firewall (UFW) Status...${NC}"
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(sudo ufw status | head -1)
    echo "UFW Status: $UFW_STATUS"
    
    if sudo ufw status | grep -q "Status: active"; then
        echo ""
        echo "Checking SSH port in UFW rules:"
        if sudo ufw status | grep -q "$SSH_PORT/tcp"; then
            echo -e "${GREEN}✅ SSH port $SSH_PORT is allowed in UFW${NC}"
            sudo ufw status | grep "$SSH_PORT"
        else
            echo -e "${RED}❌ SSH port $SSH_PORT is NOT allowed in UFW!${NC}"
            echo ""
            echo "To allow SSH port, run:"
            echo -e "${YELLOW}sudo ufw allow $SSH_PORT/tcp${NC}"
        fi
    else
        echo "UFW is inactive"
    fi
else
    echo "UFW not installed"
fi

echo ""

# Check network interfaces
echo -e "${BLUE}5. Network Interfaces and IP Addresses...${NC}"
echo "IP addresses on this server:"
hostname -I
echo ""
echo "Network interfaces:"
ip addr show | grep -E "^[0-9]+:|inet " | grep -v "127.0.0.1"

echo ""

# Check SSH config
echo -e "${BLUE}6. SSH Configuration Summary...${NC}"
echo "SSH Port: $SSH_PORT"
echo "PermitRootLogin: $(sudo grep -E "^PermitRootLogin|^#PermitRootLogin" /etc/ssh/sshd_config | grep -v "^#" | awk '{print $2}' | head -1 || echo 'not set (default: yes)')"
echo "PasswordAuthentication: $(sudo grep -E "^PasswordAuthentication|^#PasswordAuthentication" /etc/ssh/sshd_config | grep -v "^#" | awk '{print $2}' | head -1 || echo 'not set (default: yes)')"

echo ""

# Get current user info
echo -e "${BLUE}7. Current User Information...${NC}"
echo "Username: $USER"
echo "User groups: $(groups)"
echo "Home directory: $HOME"

echo ""

# Summary and recommendations
echo -e "${GREEN}=========================================="
echo "SUMMARY & RECOMMENDATIONS"
echo "==========================================${NC}"
echo ""

SERVER_IP=$(hostname -I | awk '{print $1}')

echo "For SSH tunnel from your local machine, use:"
if [ "$SSH_PORT" != "22" ]; then
    echo -e "${YELLOW}ssh -L 5678:localhost:5678 -p $SSH_PORT ubuntu@$SERVER_IP${NC}"
else
    echo -e "${YELLOW}ssh -L 5678:localhost:5678 ubuntu@$SERVER_IP${NC}"
fi

echo ""
echo "If connection still fails, check:"
echo "1. Can you ping the server? (ping $SERVER_IP)"
echo "2. Is the server accessible from your network?"
echo "3. Are you behind a NAT/router? You may need to use the public IP"
echo "4. Check if your local firewall allows outbound SSH connections"
echo ""


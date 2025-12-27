#!/bin/bash
# Helper script untuk memberikan panduan setup credentials n8n

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

log_info "=== Setup Credentials n8n ==="
echo ""

# Read .env for connection details
if [ ! -f .env ]; then
    log_error ".env file not found"
    exit 1
fi

POSTGRES_DB=$(grep "^POSTGRES_DB=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "memecoin_hunter")
POSTGRES_USER=$(grep "^POSTGRES_USER=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "memecoin_user")
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "")
TELEGRAM_BOT_TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "")
TELEGRAM_CHAT_ID=$(grep "^TELEGRAM_CHAT_ID=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "")

echo "📋 Connection Details:"
echo ""
echo "PostgreSQL:"
echo "  Host: postgres"
echo "  Database: ${GREEN}$POSTGRES_DB${NC}"
echo "  User: ${GREEN}$POSTGRES_USER${NC}"
echo "  Password: ${GREEN}${POSTGRES_PASSWORD:0:10}...${NC} (hidden)"
echo "  Port: 5432"
echo ""

if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    echo "Telegram:"
    echo "  Bot Token: ${GREEN}${TELEGRAM_BOT_TOKEN:0:20}...${NC} (hidden)"
    if [ -n "$TELEGRAM_CHAT_ID" ]; then
        echo "  Chat ID: ${GREEN}$TELEGRAM_CHAT_ID${NC}"
    else
        echo "  Chat ID: ${YELLOW}Not set - perlu di-setup${NC}"
    fi
    echo ""
fi

log_step "Langkah-langkah Setup Credentials:"
echo ""

echo "1. ${CYAN}Setup PostgreSQL Credential${NC}"
echo "   a. Buka n8n di browser"
echo "   b. Login ke n8n"
echo "   c. Klik workflow 'Memecoin High Score Monitor'"
echo "   d. Klik node 'Query High Score Coins'"
echo "   e. Di 'Credential to connect with', klik 'Create New Credential'"
echo "   f. Pilih 'PostgreSQL'"
echo "   g. Isi dengan data berikut:"
echo ""
echo "      ${GREEN}Host:${NC} postgres"
echo "      ${GREEN}Database:${NC} $POSTGRES_DB"
echo "      ${GREEN}User:${NC} $POSTGRES_USER"
echo "      ${GREEN}Password:${NC} [dari .env: ${POSTGRES_PASSWORD:0:10}...]"
echo "      ${GREEN}Port:${NC} 5432"
echo "      ${GREEN}SSL:${NC} Disable"
echo ""
echo "   h. Klik 'Save'"
echo ""

echo "2. ${CYAN}Setup Telegram Credential${NC}"
echo "   a. Di workflow yang sama, klik node 'Send Telegram'"
echo "   b. Di 'Credential to connect with', klik 'Create New Credential'"
echo "   c. Pilih 'Telegram'"
echo "   d. Isi dengan data berikut:"
echo ""
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    echo "      ${GREEN}Access Token:${NC} [dari .env: ${TELEGRAM_BOT_TOKEN:0:20}...]"
else
    echo "      ${YELLOW}Access Token:${NC} [TELEGRAM_BOT_TOKEN dari .env]"
fi
echo ""
echo "   e. Klik 'Save'"
echo "   f. Isi Chat ID:"
if [ -n "$TELEGRAM_CHAT_ID" ]; then
    echo "      ${GREEN}Chat ID:${NC} $TELEGRAM_CHAT_ID"
    echo "      Atau gunakan: \${CYAN}{{ \$env.TELEGRAM_CHAT_ID }}\${NC}"
else
    echo "      ${YELLOW}Chat ID:${NC} [Lihat cara mendapatkan di bawah]"
fi
echo ""

if [ -z "$TELEGRAM_CHAT_ID" ]; then
    echo "3. ${CYAN}Dapatkan Telegram Chat ID${NC}"
    echo ""
    if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
        echo "   Method 1: Via API"
        echo "   ${GREEN}curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN:0:20}.../getUpdates${NC}"
        echo ""
    fi
    echo "   Method 2: Via @userinfobot"
    echo "   - Kirim pesan ke @userinfobot di Telegram"
    echo "   - Bot akan reply dengan Chat ID Anda"
    echo ""
    echo "   Method 3: Via Bot"
    echo "   - Start bot Anda (kirim /start)"
    echo "   - Kirim pesan apapun ke bot"
    echo "   - Gunakan getUpdates untuk melihat chat ID"
    echo ""
fi

echo "4. ${CYAN}Test Workflow${NC}"
echo "   a. Klik 'Execute Workflow' (button di kanan atas)"
echo "   b. Cek apakah semua node berjalan tanpa error"
echo "   c. Cek Telegram apakah notifikasi terkirim"
echo ""

echo "5. ${CYAN}Aktifkan Workflow${NC}"
echo "   a. Klik toggle 'Active' di kanan atas workflow"
echo "   b. Workflow akan berjalan otomatis setiap 2 menit"
echo ""

log_ok "Dokumentasi lengkap: docs/N8N_SETUP_CREDENTIALS.md"
echo ""


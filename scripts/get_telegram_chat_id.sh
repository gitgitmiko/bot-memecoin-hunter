#!/bin/bash
# Script untuk mendapatkan Telegram Chat ID

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

log_info "=== Get Telegram Chat ID ==="
echo ""

# Try to read bot token from .env
BOT_TOKEN=""
if [ -f .env ]; then
    BOT_TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "")
fi

# If not found, ask user
if [ -z "$BOT_TOKEN" ]; then
    log_warn "TELEGRAM_BOT_TOKEN not found in .env"
    echo ""
    read -p "Enter your Telegram Bot Token: " BOT_TOKEN
    echo ""
fi

if [ -z "$BOT_TOKEN" ]; then
    log_error "Bot token is required"
    exit 1
fi

log_step "Step 1: Verifying bot token..."
BOT_INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe")

if echo "$BOT_INFO" | grep -q '"ok":true'; then
    BOT_NAME=$(echo "$BOT_INFO" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['result']['first_name'])" 2>/dev/null || echo "Unknown")
    BOT_USERNAME=$(echo "$BOT_INFO" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['result']['username'])" 2>/dev/null || echo "Unknown")
    BOT_ID=$(echo "$BOT_INFO" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['result']['id'])" 2>/dev/null || echo "Unknown")
    
    log_ok "Bot token valid!"
    log_info "Bot Name: $BOT_NAME"
    log_info "Bot Username: @$BOT_USERNAME"
    log_info "Bot ID: $BOT_ID"
    log_warn "⚠️  Bot ID ($BOT_ID) BUKAN Chat ID Anda! Jangan gunakan ini."
    echo ""
else
    log_error "Invalid bot token!"
    echo "$BOT_INFO"
    exit 1
fi

log_step "Step 2: Getting updates..."
echo ""
log_info "⚠️  IMPORTANT: Pastikan Anda sudah:"
log_info "  1. Start bot di Telegram (kirim /start)"
log_info "  2. Kirim pesan apapun ke bot"
echo ""
read -p "Press Enter to continue..." dummy
echo ""

UPDATES=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates")

if echo "$UPDATES" | grep -q '"ok":true'; then
    # Extract chat IDs from updates
    CHAT_IDS=$(echo "$UPDATES" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data['ok'] and data['result']:
        print('Found chat IDs:')
        for update in data['result']:
            if 'message' in update:
                chat = update['message']['chat']
                chat_id = chat['id']
                chat_type = chat.get('type', 'unknown')
                first_name = chat.get('first_name', 'N/A')
                username = chat.get('username', 'N/A')
                print(f'  Chat ID: {chat_id} (Type: {chat_type}, Name: {first_name}, Username: @{username})')
    else:
        print('No messages found. Please:')
        print('  1. Start the bot in Telegram (send /start)')
        print('  2. Send any message to the bot')
        print('  3. Run this script again')
except Exception as e:
    print(f'Error: {e}')
" 2>/dev/null || echo "Error parsing response")

    if [ -n "$CHAT_IDS" ]; then
        echo "$CHAT_IDS"
        echo ""
        
        # Extract first private chat ID
        FIRST_CHAT_ID=$(echo "$UPDATES" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data['ok'] and data['result']:
        for update in data['result']:
            if 'message' in update:
                chat = update['message']['chat']
                if chat.get('type') == 'private':
                    print(chat['id'])
                    break
except:
    pass
" 2>/dev/null || echo "")

        if [ -n "$FIRST_CHAT_ID" ]; then
            echo ""
            log_ok "✅ Recommended Chat ID: ${GREEN}$FIRST_CHAT_ID${NC}"
            echo ""
            log_info "Copy this Chat ID and paste it in n8n workflow:"
            log_info "  Node: 'Send Telegram' → Chat ID field"
            echo ""
            
            # Test send message
            log_step "Step 3: Testing send message..."
            read -p "Do you want to send a test message? (y/n): " SEND_TEST
            
            if [ "$SEND_TEST" = "y" ] || [ "$SEND_TEST" = "Y" ]; then
                TEST_RESULT=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
                    -H "Content-Type: application/json" \
                    -d "{\"chat_id\": $FIRST_CHAT_ID, \"text\": \"✅ Test message from get_telegram_chat_id.sh script!\"}")
                
                if echo "$TEST_RESULT" | grep -q '"ok":true'; then
                    log_ok "Test message sent successfully! Check your Telegram."
                else
                    log_error "Failed to send test message"
                    echo "$TEST_RESULT"
                fi
            fi
        else
            log_warn "No private chat found. Please start the bot first."
        fi
    else
        log_warn "No updates found. Please:"
        log_info "  1. Start the bot in Telegram (send /start)"
        log_info "  2. Send any message to the bot"
        log_info "  3. Run this script again"
    fi
else
    log_error "Failed to get updates"
    echo "$UPDATES"
    exit 1
fi

echo ""
log_info "Alternative method: Use @userinfobot in Telegram"
log_info "  1. Search for @userinfobot"
log_info "  2. Send /start"
log_info "  3. Bot will reply with your Chat ID"


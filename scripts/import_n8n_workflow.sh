#!/bin/bash
# Script untuk import n8n workflow via API atau memberikan instruksi manual

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

log_info "=== Import n8n Workflow ==="
echo ""

# Check if workflow file exists
WORKFLOW_FILE="$PROJECT_DIR/workflows/n8n-memecoin-monitor-simple.json"
if [ ! -f "$WORKFLOW_FILE" ]; then
    log_error "Workflow file not found: $WORKFLOW_FILE"
    exit 1
fi

log_ok "Workflow file found: $WORKFLOW_FILE"
echo ""

# Read n8n URL from .env
if [ -f .env ]; then
    N8N_URL=$(grep "^N8N_URL=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "")
    N8N_API_KEY=$(grep "^N8N_API_KEY=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "")
fi

# Check if n8n is accessible
if [ -z "$N8N_URL" ]; then
    log_warn "N8N_URL not found in .env"
    log_info "Trying to detect n8n URL from docker compose..."
    
    # Try to get from docker compose
    if command -v docker &> /dev/null; then
        if docker compose ps n8n 2>/dev/null | grep -q "Up"; then
            log_info "n8n container is running"
            # Check for cloudflared tunnel
            if [ -f ~/.cloudflared/config.yaml ] || docker compose ps | grep -q cloudflared; then
                log_info "Cloudflared detected. Please check your Cloudflared URL."
                log_info "Or access n8n locally at: https://abs-also-regional-musicians.trycloudflare.com/"
                N8N_URL="https://abs-also-regional-musicians.trycloudflare.com/"
            else
                N8N_URL="https://abs-also-regional-musicians.trycloudflare.com/"
            fi
        fi
    fi
fi

if [ -z "$N8N_URL" ]; then
    N8N_URL="https://abs-also-regional-musicians.trycloudflare.com/"
    log_warn "Using default URL: $N8N_URL"
fi

log_info "n8n URL: $N8N_URL"
echo ""

# Method 1: Try API import if API key is available
if [ -n "$N8N_API_KEY" ]; then
    log_info "Trying to import via API..."
    echo ""
    
    # n8n API expects only nodes, connections, settings, name (no metadata fields)
    # Create a clean payload with only required fields
    CLEAN_PAYLOAD=$(python3 << PYEOF
import json
import sys

try:
    with open('$WORKFLOW_FILE') as f:
        workflow = json.load(f)
    
    # Extract only the fields that n8n API accepts
    # API docs: https://docs.n8n.io/api/api-reference/workflows/#create-a-workflow
    clean_workflow = {
        "name": workflow.get("name", "Memecoin High Score Monitor"),
        "nodes": workflow.get("nodes", []),
        "connections": workflow.get("connections", {}),
    }
    
    # Optional fields - only include if they exist and are not empty/null
    if workflow.get("settings"):
        clean_workflow["settings"] = workflow["settings"]
    
    # Don't include staticData, tags, pinData, or any metadata fields
    # These cause "additional properties" error
    
    print(json.dumps(clean_workflow))
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
    )
    
    if [ $? -ne 0 ]; then
        log_error "Failed to prepare workflow payload"
        echo "$CLEAN_PAYLOAD"
        echo ""
    else
        RESPONSE=$(echo "$CLEAN_PAYLOAD" | curl -s -w "\n%{http_code}" -X POST "$N8N_URL/api/v1/workflows" \
            -H "Content-Type: application/json" \
            -H "X-N8N-API-KEY: $N8N_API_KEY" \
            -d @- 2>&1)
        
        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        BODY=$(echo "$RESPONSE" | sed '$d')
        
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
            log_ok "Workflow imported successfully via API!"
            echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
            exit 0
        else
            log_error "API import failed (HTTP $HTTP_CODE)"
            echo "$BODY"
            echo ""
        fi
    fi
else
    log_warn "N8N_API_KEY not found in .env"
fi

# Method 2: Manual import instructions
echo ""
log_info "=== Manual Import via n8n UI ==="
echo ""
log_info "Cara 1: Import via UI (Recommended)"
echo ""
echo "1. Buka n8n di browser:"
echo "   ${GREEN}$N8N_URL${NC}"
echo ""
echo "2. Login ke n8n (jika belum ada user, buat user pertama)"
echo ""
echo "3. Klik tombol 'Workflows' di sidebar kiri"
echo ""
echo "4. Klik tombol 'Import from File' atau '...' menu → 'Import from File'"
echo ""
echo "5. Pilih file:"
echo "   ${GREEN}$WORKFLOW_FILE${NC}"
echo ""
echo "6. Workflow akan langsung ter-import dan bisa langsung diaktifkan"
echo ""

log_info "Cara 2: Setup API Key untuk otomatis import"
echo ""
echo "Untuk mendapatkan API Key:"
echo ""
echo "1. Buka n8n: ${GREEN}$N8N_URL${NC}"
echo ""
echo "2. Klik 'Settings' → 'API' di sidebar"
echo ""
echo "3. Buat API Key baru dan copy"
echo ""
echo "4. Tambahkan ke .env file:"
echo "   ${GREEN}N8N_API_KEY=your_api_key_here${NC}"
echo ""
echo "5. Jalankan script ini lagi untuk import otomatis"
echo ""

# Method 3: Copy workflow content for manual paste
echo ""
log_info "Workflow file location:"
echo "   ${GREEN}$WORKFLOW_FILE${NC}"
echo ""
log_info "Atau buka file di editor dan copy-paste manual ke n8n UI"


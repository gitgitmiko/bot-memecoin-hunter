#!/bin/bash
# Script untuk update workflow n8n yang sudah ada via API

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

log_info "=== Update n8n Workflow ==="
echo ""

# Load config from .env
if [ -f .env ]; then
    N8N_URL=$(grep "^N8N_HOST=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "")
    N8N_PROTOCOL=$(grep "^N8N_PROTOCOL=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "https")
    N8N_API_KEY=$(grep "^N8N_API_KEY=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "")
    
    if [ -n "$N8N_URL" ]; then
        # Remove trailing slash
        N8N_URL=$(echo "$N8N_URL" | sed 's|/$||')
        
        if [[ "$N8N_URL" == http* ]]; then
            N8N_BASE_URL="$N8N_URL"
        else
            N8N_BASE_URL="${N8N_PROTOCOL}://${N8N_URL}"
        fi
    fi
fi

# Default to cloudflared URL if not set
if [ -z "$N8N_BASE_URL" ]; then
    N8N_BASE_URL="https://abs-also-regional-musicians.trycloudflare.com"
    log_warn "Using default URL: $N8N_BASE_URL"
fi

# Remove trailing slash from base URL to avoid double slash
N8N_BASE_URL=$(echo "$N8N_BASE_URL" | sed 's|/$||')

# Workflow file
WORKFLOW_FILE="$PROJECT_DIR/workflows/n8n-memecoin-monitor-simple.json"
if [ ! -f "$WORKFLOW_FILE" ]; then
    log_error "Workflow file not found: $WORKFLOW_FILE"
    exit 1
fi

log_ok "Workflow file: $WORKFLOW_FILE"
log_info "n8n URL: $N8N_BASE_URL"
echo ""

# Check if API key exists
if [ -z "$N8N_API_KEY" ]; then
    log_error "N8N_API_KEY not found in .env"
    echo ""
    log_info "Untuk mendapatkan API Key:"
    echo "  1. Buka n8n: $N8N_BASE_URL"
    echo "  2. Settings → API → Create API Key"
    echo "  3. Tambahkan ke .env: N8N_API_KEY=your_key"
    exit 1
fi

# Get workflow name from file
WORKFLOW_NAME=$(jq -r '.name // "Memecoin High Score Monitor"' "$WORKFLOW_FILE" 2>/dev/null || echo "Memecoin High Score Monitor")

log_info "Looking for workflow: $WORKFLOW_NAME"
echo ""

# Get list of workflows to find the ID
log_info "Fetching workflows..."
WORKFLOWS_JSON=$(curl -s -X GET "$N8N_BASE_URL/api/v1/workflows" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    2>/dev/null)

if [ $? -ne 0 ]; then
    log_error "Failed to fetch workflows. Check your N8N_API_KEY and URL."
    exit 1
fi

# Find workflow by name
WORKFLOW_ID=$(echo "$WORKFLOWS_JSON" | jq -r ".data[] | select(.name == \"$WORKFLOW_NAME\") | .id" 2>/dev/null | head -1)

if [ -z "$WORKFLOW_ID" ] || [ "$WORKFLOW_ID" == "null" ]; then
    log_warn "Workflow '$WORKFLOW_NAME' not found"
    log_info "Available workflows:"
    echo "$WORKFLOWS_JSON" | jq -r '.data[] | "  - \(.name) (ID: \(.id))"' 2>/dev/null || echo "  (Unable to list)"
    echo ""
    log_info "Creating new workflow instead..."
    
    # Create new workflow
    CLEAN_PAYLOAD=$(python3 << PYEOF
import json
import sys

try:
    with open('$WORKFLOW_FILE') as f:
        workflow = json.load(f)
    
    clean_workflow = {
        "name": workflow.get("name", "Memecoin High Score Monitor"),
        "nodes": workflow.get("nodes", []),
        "connections": workflow.get("connections", {}),
    }
    
    if workflow.get("settings"):
        clean_workflow["settings"] = workflow["settings"]
    
    print(json.dumps(clean_workflow))
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
    )
    
    RESPONSE=$(echo "$CLEAN_PAYLOAD" | curl -s -w "\n%{http_code}" -X POST "$N8N_BASE_URL/api/v1/workflows" \
        -H "Content-Type: application/json" \
        -H "X-N8N-API-KEY: $N8N_API_KEY" \
        -d @- 2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        NEW_ID=$(echo "$BODY" | jq -r '.id // empty' 2>/dev/null)
        log_ok "Workflow created successfully! ID: $NEW_ID"
        exit 0
    else
        log_error "Failed to create workflow (HTTP $HTTP_CODE)"
        echo "$BODY"
        exit 1
    fi
fi

log_ok "Found workflow ID: $WORKFLOW_ID"
echo ""

# Get current workflow to preserve some fields
log_info "Fetching current workflow..."
CURRENT_WORKFLOW_RAW=$(curl -s -X GET "$N8N_BASE_URL/api/v1/workflows/$WORKFLOW_ID" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    2>/dev/null)

if [ $? -ne 0 ]; then
    log_error "Failed to fetch current workflow"
    exit 1
fi

# Prepare update payload
log_info "Preparing update payload..."
UPDATE_PAYLOAD=$(python3 << PYEOF
import json
import sys
import re

try:
    # Load new workflow from file
    with open('$WORKFLOW_FILE') as f:
        new_workflow = json.load(f)
    
    # Load current workflow from API - clean control characters
    current_workflow_json = r'''$CURRENT_WORKFLOW_RAW'''
    # Remove control characters except newline and tab
    current_workflow_json = re.sub(r'[\x00-\x08\x0b-\x0c\x0e-\x1f]', '', current_workflow_json)
    current_workflow = json.loads(current_workflow_json)
    
    # Merge: use nodes and connections from file
    # Note: id and active are read-only and managed by n8n
    updated_workflow = {
        "name": new_workflow.get("name", current_workflow.get("name")),
        "nodes": new_workflow.get("nodes", []),
        "connections": new_workflow.get("connections", {}),
    }
    
    # Preserve settings if they exist
    if new_workflow.get("settings"):
        updated_workflow["settings"] = new_workflow["settings"]
    elif current_workflow.get("settings"):
        updated_workflow["settings"] = current_workflow["settings"]
    
    print(json.dumps(updated_workflow))
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
PYEOF
)

if [ $? -ne 0 ]; then
    log_error "Failed to prepare update payload"
    exit 1
fi

# Update workflow
log_info "Updating workflow..."
RESPONSE=$(echo "$UPDATE_PAYLOAD" | curl -s -w "\n%{http_code}" -X PUT "$N8N_BASE_URL/api/v1/workflows/$WORKFLOW_ID" \
    -H "Content-Type: application/json" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -d @- 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    log_ok "Workflow updated successfully!"
    echo ""
    log_info "Workflow details:"
    echo "$BODY" | jq '{id, name, active}' 2>/dev/null || echo "$BODY"
    echo ""
    log_info "Next steps:"
    echo "  1. Open n8n: $N8N_BASE_URL"
    echo "  2. Check workflow: $WORKFLOW_NAME"
    echo "  3. Verify settings and activate if needed"
    exit 0
else
    log_error "Failed to update workflow (HTTP $HTTP_CODE)"
    echo "$BODY"
    exit 1
fi


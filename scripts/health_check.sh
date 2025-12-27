#!/bin/bash
# Health check script untuk semua services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_ok() { echo -e "${GREEN}✅${NC} $1"; }
log_error() { echo -e "${RED}❌${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠️${NC} $1"; }
log_info() { echo -e "${NC}ℹ️${NC} $1"; }

# Check Docker permission
if docker ps > /dev/null 2>&1; then
    USE_SUDO=""
    COMPOSE_CMD="docker compose"
elif sudo docker ps > /dev/null 2>&1; then
    USE_SUDO="sudo"
    COMPOSE_CMD="sudo docker compose"
else
    log_error "Docker tidak dapat diakses"
    exit 1
fi

echo "=========================================="
echo "HEALTH CHECK - Memecoin Hunter System"
echo "=========================================="
echo ""

ERRORS=0
WARNINGS=0

# Check Docker
log_info "Checking Docker daemon..."
if docker ps > /dev/null 2>&1 || sudo docker ps > /dev/null 2>&1; then
    log_ok "Docker daemon running"
else
    log_error "Docker daemon tidak running"
    ((ERRORS++))
    exit 1
fi

# Check containers status
log_info "Checking container status..."
CONTAINERS=("postgres" "redis" "n8n" "crawler" "analyzer" "telegram-bot")
for container in "${CONTAINERS[@]}"; do
    if $COMPOSE_CMD ps $container | grep -q "Up"; then
        HEALTH_STATUS=$($COMPOSE_CMD ps $container --format "{{.Health}}" 2>/dev/null || echo "")
        if [[ "$HEALTH_STATUS" == *"healthy"* ]]; then
            log_ok "$container: Running (healthy)"
        elif [[ "$HEALTH_STATUS" == *"unhealthy"* ]]; then
            log_error "$container: Running (unhealthy)"
            ((ERRORS++))
        else
            log_warn "$container: Running (health check not available)"
            ((WARNINGS++))
        fi
    else
        log_error "$container: Not running"
        ((ERRORS++))
    fi
done

echo ""

# Check PostgreSQL
log_info "Checking PostgreSQL..."
if $COMPOSE_CMD exec -T postgres pg_isready -U memecoin_user > /dev/null 2>&1; then
    log_ok "PostgreSQL: Connection OK"
    
    # Test database exists
    DB_EXISTS=$($COMPOSE_CMD exec -T postgres psql -U memecoin_user -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='memecoin_hunter'" 2>/dev/null || echo "0")
    if [ "$DB_EXISTS" = "1" ]; then
        log_ok "PostgreSQL: Database 'memecoin_hunter' exists"
    else
        log_warn "PostgreSQL: Database 'memecoin_hunter' not found"
        ((WARNINGS++))
    fi
else
    log_error "PostgreSQL: Connection failed"
    ((ERRORS++))
fi

# Check Redis
log_info "Checking Redis..."
# Read Redis password from .env if available
if [ -f .env ]; then
    REDIS_PASSWORD=$(grep "^REDIS_PASSWORD=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "")
fi

# Try ping with password if available, otherwise without
if [ -n "$REDIS_PASSWORD" ]; then
    if $COMPOSE_CMD exec -T redis redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q "PONG"; then
        log_ok "Redis: Connection OK"
        MEMORY_INFO=$($COMPOSE_CMD exec -T redis redis-cli -a "$REDIS_PASSWORD" INFO memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r' || echo "N/A")
        log_info "Redis: Memory used: $MEMORY_INFO"
    else
        log_error "Redis: Connection failed (with password)"
        ((ERRORS++))
    fi
else
    if $COMPOSE_CMD exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        log_ok "Redis: Connection OK (no password)"
        MEMORY_INFO=$($COMPOSE_CMD exec -T redis redis-cli INFO memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r' || echo "N/A")
        log_info "Redis: Memory used: $MEMORY_INFO"
    else
        log_error "Redis: Connection failed"
        ((ERRORS++))
    fi
fi

# Check n8n
log_info "Checking n8n..."
if curl -sf http://localhost:5678/healthz > /dev/null 2>&1; then
    log_ok "n8n: Health check OK"
else
    log_warn "n8n: Health check failed or not accessible"
    ((WARNINGS++))
fi

echo ""

# Check service logs for errors
log_info "Checking service logs for errors (last 100 lines)..."
ERROR_COUNT=0
for service in crawler analyzer telegram-bot; do
    SERVICE_ERRORS=$($COMPOSE_CMD logs --tail=100 $service 2>&1 | grep -iE "error|fatal|failed|exception" | wc -l || echo "0")
    if [ "$SERVICE_ERRORS" -gt 0 ]; then
        log_warn "$service: Found $SERVICE_ERRORS errors in logs"
        ((ERROR_COUNT+=SERVICE_ERRORS))
        ((WARNINGS++))
    fi
done

if [ "$ERROR_COUNT" -eq 0 ]; then
    log_ok "No recent errors in service logs"
else
    log_warn "Total errors found in logs: $ERROR_COUNT"
fi

echo ""

# Check disk space
log_info "Checking disk space..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    log_ok "Disk space: ${DISK_USAGE}% used (OK)"
elif [ "$DISK_USAGE" -lt 90 ]; then
    log_warn "Disk space: ${DISK_USAGE}% used (Warning)"
    ((WARNINGS++))
else
    log_error "Disk space: ${DISK_USAGE}% used (Critical)"
    ((ERRORS++))
fi

# Check memory usage
log_info "Checking memory usage..."
MEMORY_INFO=$(free -h | awk 'NR==2{printf "%.0f", $3/$2 * 100}')
if [ "$MEMORY_INFO" -lt 80 ]; then
    log_ok "Memory: ${MEMORY_INFO}% used (OK)"
elif [ "$MEMORY_INFO" -lt 90 ]; then
    log_warn "Memory: ${MEMORY_INFO}% used (Warning)"
    ((WARNINGS++))
else
    log_error "Memory: ${MEMORY_INFO}% used (Critical)"
    ((ERRORS++))
fi

# Check Docker resources
log_info "Checking Docker container resources..."
CONTAINER_RESOURCES=$($COMPOSE_CMD stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | head -10)
echo "$CONTAINER_RESOURCES" | tail -n +2 | while read line; do
    CONTAINER_NAME=$(echo "$line" | awk '{print $1}')
    CPU_USAGE=$(echo "$line" | awk '{print $2}' | sed 's/%//')
    MEM_USAGE=$(echo "$line" | awk '{print $3}')
    if [ ! -z "$CPU_USAGE" ] && [ ! -z "$CONTAINER_NAME" ]; then
        log_info "$CONTAINER_NAME: CPU ${CPU_USAGE}%, Memory $MEM_USAGE"
    fi
done

echo ""
echo "=========================================="
echo "SUMMARY"
echo "=========================================="

if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    log_ok "All checks passed! System is healthy."
    exit 0
elif [ "$ERRORS" -eq 0 ]; then
    log_warn "System operational with $WARNINGS warning(s)"
    exit 0
else
    log_error "System has $ERRORS error(s) and $WARNINGS warning(s)"
    exit 1
fi


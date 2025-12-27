#!/bin/bash

# Script to fix database connection issues
# This ensures environment variables are properly set

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_info "=== Fixing Database Connection Issues ==="
log_info ""

# Check if .env exists
if [ ! -f .env ]; then
    log_error ".env file not found!"
    log_info "Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        log_warn "Please edit .env file with your actual values!"
        exit 1
    else
        log_error ".env.example also not found!"
        exit 1
    fi
fi

# Check Docker permission
if docker ps > /dev/null 2>&1; then
    USE_SUDO=""
    log_info "Docker accessible directly"
elif sudo docker ps > /dev/null 2>&1; then
    USE_SUDO="sudo"
    log_info "Using sudo for Docker commands"
else
    log_error "Cannot access Docker!"
    log_info "Run: newgrp docker (then run this script again)"
    exit 1
fi

COMPOSE_CMD="$USE_SUDO docker compose"

# Read environment variables
log_info "Reading environment variables..."
POSTGRES_DB=$(grep "^POSTGRES_DB=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "memecoin_hunter")
POSTGRES_USER=$(grep "^POSTGRES_USER=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "memecoin_user")

log_info "  POSTGRES_DB: $POSTGRES_DB"
log_info "  POSTGRES_USER: $POSTGRES_USER"
log_info ""

# Verify these are different
if [ "$POSTGRES_DB" = "$POSTGRES_USER" ]; then
    log_error "POSTGRES_DB and POSTGRES_USER cannot be the same!"
    log_error "Current values: DB=$POSTGRES_DB, USER=$POSTGRES_USER"
    exit 1
fi

# Check if PostgreSQL container is running
if ! $COMPOSE_CMD ps postgres | grep -q "Up"; then
    log_warn "PostgreSQL container is not running. Starting it..."
    $COMPOSE_CMD up -d postgres
    log_info "Waiting for PostgreSQL to be ready..."
    sleep 10
fi

# Ensure database exists
log_info "Ensuring database '$POSTGRES_DB' exists..."
if $COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$POSTGRES_DB'" | grep -q 1; then
    log_info "✅ Database '$POSTGRES_DB' already exists"
else
    log_info "Creating database '$POSTGRES_DB'..."
    if $COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"$POSTGRES_DB\";"; then
        log_info "✅ Database '$POSTGRES_DB' created successfully"
    else
        log_error "Failed to create database '$POSTGRES_DB'"
        exit 1
    fi
fi

# Verify database connection
log_info "Testing database connection..."
if $COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" > /dev/null 2>&1; then
    log_info "✅ Database connection successful"
else
    log_error "Database connection failed!"
    exit 1
fi

# Check if tables exist
log_info "Checking if schema exists..."
TABLE_COUNT=$($COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('coins', 'analyses', 'users', 'notifications');" 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" -eq "4" ]; then
    log_info "✅ Schema exists (4 tables found)"
else
    log_warn "Schema incomplete (found $TABLE_COUNT/4 tables)"
    log_info "Run: ./scripts/create_schema.sh to create schema"
fi

log_info ""
log_info "=== Restarting Services ==="
log_info "Restarting services to pick up correct database configuration..."

# Stop services
$COMPOSE_CMD stop crawler analyzer telegram-bot 2>/dev/null || true

# Start services
log_info "Starting services..."
$COMPOSE_CMD up -d crawler analyzer telegram-bot

log_info ""
log_info "=== Verification ==="
log_info "Waiting 5 seconds for services to start..."
sleep 5

# Check service status
log_info "Service status:"
$COMPOSE_CMD ps crawler analyzer telegram-bot

log_info ""
log_info "=== Checking Service Logs ==="
log_info "Recent crawler logs:"
$COMPOSE_CMD logs --tail=5 crawler 2>&1 | grep -E "database|error|Error|ERROR|connected|Connected" || echo "No relevant logs found"

log_info ""
log_info "=== Done ==="
log_info ""
log_info "If you still see database errors, check:"
log_info "1. Environment variables in docker-compose.yml"
log_info "2. Service logs: docker compose logs -f crawler"
log_info "3. Verify .env file has correct POSTGRES_DB and POSTGRES_USER"


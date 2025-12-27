#!/bin/bash

###############################################################################
# Create Database Schema Script
# Run database schema creation using docker compose
###############################################################################

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if docker compose is available
if ! command -v docker &> /dev/null; then
    log_error "Docker tidak terinstall!"
    exit 1
fi

# Check Docker permission
DOCKER_CMD="docker"
COMPOSE_CMD="docker compose"

if ! docker ps &> /dev/null; then
    log_error "Docker permission error!"
    echo ""
    echo "Jalankan dengan:"
    echo "  newgrp docker ./scripts/create_schema.sh"
    exit 1
fi

# Load environment variables
if [ ! -f .env ]; then
    log_error "File .env tidak ditemukan!"
    exit 1
fi

POSTGRES_USER=$(grep "^POSTGRES_USER=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "memecoin_user")
POSTGRES_DB=$(grep "^POSTGRES_DB=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "memecoin_hunter")
SCHEMA_FILE="scripts/create_database_schema.sql"

log_info "Creating database schema..."
log_info "Database: $POSTGRES_DB"
log_info "User: $POSTGRES_USER"

# Check if PostgreSQL container is running
if ! $COMPOSE_CMD ps postgres | grep -q "Up"; then
    log_error "PostgreSQL container is not running!"
    echo ""
    echo "Start PostgreSQL dengan:"
    echo "  docker compose up -d postgres"
    echo ""
    echo "Tunggu beberapa detik, lalu jalankan script ini lagi"
    exit 1
fi

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    log_error "Schema file tidak ditemukan: $SCHEMA_FILE"
    exit 1
fi

# Create schema
log_info "Executing schema file..."

if $COMPOSE_CMD exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < "$SCHEMA_FILE"; then
    log_info "✅ Database schema created successfully!"
else
    log_error "❌ Failed to create database schema"
    exit 1
fi

echo ""
log_info "Verifying tables..."
$COMPOSE_CMD exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "\dt" | grep -E "coins|analyses|users|notifications" || true

echo ""
log_info "Schema creation complete!"


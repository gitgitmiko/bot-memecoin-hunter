#!/bin/bash

# Debug script untuk database connection issue

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check Docker permission
if docker ps > /dev/null 2>&1; then
    USE_SUDO=""
    COMPOSE_CMD="docker compose"
elif sudo docker ps > /dev/null 2>&1; then
    USE_SUDO="sudo"
    COMPOSE_CMD="sudo docker compose"
else
    log_error "Cannot access Docker!"
    log_info "Run: newgrp docker (then run this script again)"
    exit 1
fi

log_info "=== Database Connection Debug ==="
log_info ""

# 1. Check .env file
log_info "1. Checking .env file..."
if [ -f .env ]; then
    POSTGRES_DB=$(grep "^POSTGRES_DB=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "")
    POSTGRES_USER=$(grep "^POSTGRES_USER=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" | xargs || echo "")
    
    log_info "  POSTGRES_DB from .env: $POSTGRES_DB"
    log_info "  POSTGRES_USER from .env: $POSTGRES_USER"
    
    if [ "$POSTGRES_DB" = "$POSTGRES_USER" ]; then
        log_error "  ❌ POSTGRES_DB dan POSTGRES_USER sama! Ini salah!"
    else
        log_info "  ✅ POSTGRES_DB dan POSTGRES_USER berbeda"
    fi
else
    log_error ".env file not found!"
fi

log_info ""

# 2. Check environment variables in containers
log_info "2. Checking environment variables in containers..."

for service in crawler analyzer telegram-bot; do
    log_info "  Checking $service container:"
    
    if $COMPOSE_CMD ps $service | grep -q "Up"; then
        DB_VAR=$($COMPOSE_CMD exec -T $service printenv POSTGRES_DB 2>/dev/null || echo "NOT SET")
        USER_VAR=$($COMPOSE_CMD exec -T $service printenv POSTGRES_USER 2>/dev/null || echo "NOT SET")
        
        log_info "    POSTGRES_DB: $DB_VAR"
        log_info "    POSTGRES_USER: $USER_VAR"
        
        if [ "$DB_VAR" = "$USER_VAR" ]; then
            log_error "    ❌ POSTGRES_DB dan POSTGRES_USER sama di container!"
        elif [ "$DB_VAR" = "NOT SET" ]; then
            log_error "    ❌ POSTGRES_DB tidak ter-set!"
        else
            log_info "    ✅ Environment variables OK"
        fi
    else
        log_warn "    Container $service tidak running"
    fi
    echo ""
done

# 3. Test database connection from container
log_info "3. Testing database connection from crawler container..."

if $COMPOSE_CMD ps crawler | grep -q "Up"; then
    log_info "  Running test connection script..."
    
    $COMPOSE_CMD exec -T crawler node << 'NODE_SCRIPT'
require('dotenv').config();
const { Pool } = require('pg');

console.log('Environment variables:');
console.log('  POSTGRES_HOST:', process.env.POSTGRES_HOST);
console.log('  POSTGRES_PORT:', process.env.POSTGRES_PORT);
console.log('  POSTGRES_DB:', process.env.POSTGRES_DB);
console.log('  POSTGRES_USER:', process.env.POSTGRES_USER);
console.log('  POSTGRES_PASSWORD:', process.env.POSTGRES_PASSWORD ? '***SET***' : 'NOT SET');

const poolConfig = {
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'memecoin_hunter',
  user: process.env.POSTGRES_USER || 'memecoin_user',
  password: process.env.POSTGRES_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

console.log('\nPool config yang akan digunakan:');
console.log('  host:', poolConfig.host);
console.log('  port:', poolConfig.port);
console.log('  database:', poolConfig.database);
console.log('  user:', poolConfig.user);
console.log('  password:', poolConfig.password ? '***SET***' : 'NOT SET');

const pool = new Pool(poolConfig);

pool.query('SELECT NOW(), current_database() as db_name, current_user as db_user')
  .then(result => {
    console.log('\n✅ Connection successful!');
    console.log('  Database name:', result.rows[0].db_name);
    console.log('  Database user:', result.rows[0].db_user);
    console.log('  Current time:', result.rows[0].now);
    pool.end();
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Connection failed!');
    console.error('  Error:', error.message);
    console.error('  Code:', error.code);
    pool.end();
    process.exit(1);
  });
NODE_SCRIPT
else
    log_warn "  Crawler container tidak running, skip connection test"
fi

log_info ""
log_info "=== Debug Complete ==="


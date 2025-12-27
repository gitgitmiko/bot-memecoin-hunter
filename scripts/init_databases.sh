#!/bin/bash

###############################################################################
# Initialize Databases
# Script untuk membuat database yang diperlukan
###############################################################################

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=========================================="
echo "INITIALIZE DATABASES"
echo "==========================================${NC}"
echo ""

# Check Docker permission
DOCKER_CMD="docker"
COMPOSE_CMD="docker compose"

if ! docker ps &> /dev/null; then
    echo -e "${RED}❌ Docker permission error!${NC}"
    echo ""
    echo "Jalankan dengan:"
    echo "  newgrp docker ./scripts/init_databases.sh"
    exit 1
fi

# Load environment variables
if [ ! -f .env ]; then
    echo -e "${RED}❌ File .env tidak ditemukan!${NC}"
    exit 1
fi

POSTGRES_USER=$(grep "^POSTGRES_USER=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "memecoin_user")
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
POSTGRES_DB=$(grep "^POSTGRES_DB=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "memecoin_hunter")
N8N_DB_NAME=$(grep "^N8N_DB_NAME=" .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "n8n")

echo -e "${BLUE}Database Configuration:${NC}"
echo "  PostgreSQL User: $POSTGRES_USER"
echo "  Main Database: $POSTGRES_DB"
echo "  n8n Database: $N8N_DB_NAME"
echo ""

# Check if PostgreSQL is running
if ! $COMPOSE_CMD ps postgres | grep -q "Up"; then
    echo -e "${RED}❌ PostgreSQL container is not running!${NC}"
    echo "Starting PostgreSQL..."
    $COMPOSE_CMD up -d postgres
    echo "Waiting for PostgreSQL to start..."
    sleep 10
fi

# Check if databases exist
echo -e "${BLUE}Checking existing databases...${NC}"
EXISTING_DBS=$($COMPOSE_CMD exec -T postgres psql -U $POSTGRES_USER -d postgres -t -c "SELECT datname FROM pg_database WHERE datname IN ('$POSTGRES_DB', '$N8N_DB_NAME');")

# Create main database if not exists
if echo "$EXISTING_DBS" | grep -q "$POSTGRES_DB"; then
    echo -e "${GREEN}✅ Database '$POSTGRES_DB' already exists${NC}"
else
    echo -e "${YELLOW}Creating database '$POSTGRES_DB'...${NC}"
    $COMPOSE_CMD exec -T postgres psql -U $POSTGRES_USER -d postgres <<SQL
CREATE DATABASE "$POSTGRES_DB";
SQL
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Database '$POSTGRES_DB' created${NC}"
    else
        echo -e "${RED}❌ Failed to create database '$POSTGRES_DB'${NC}"
        exit 1
    fi
fi

# Create n8n database if not exists
if echo "$EXISTING_DBS" | grep -q "$N8N_DB_NAME"; then
    echo -e "${GREEN}✅ Database '$N8N_DB_NAME' already exists${NC}"
else
    echo -e "${YELLOW}Creating database '$N8N_DB_NAME'...${NC}"
    $COMPOSE_CMD exec -T postgres psql -U $POSTGRES_USER -d postgres <<SQL
CREATE DATABASE "$N8N_DB_NAME";
SQL
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Database '$N8N_DB_NAME' created${NC}"
    else
        echo -e "${RED}❌ Failed to create database '$N8N_DB_NAME'${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}Listing all databases...${NC}"
$COMPOSE_CMD exec -T postgres psql -U $POSTGRES_USER -d postgres -c "\l" | grep -E "Name|$POSTGRES_DB|$N8N_DB_NAME"

echo ""
echo -e "${GREEN}=========================================="
echo "DATABASES INITIALIZED!"
echo "==========================================${NC}"
echo ""
echo "Restarting services that need databases..."
$COMPOSE_CMD restart n8n crawler analyzer telegram-bot

echo ""
echo "Waiting for services to start..."
sleep 15

echo ""
echo -e "${BLUE}Service Status:${NC}"
$COMPOSE_CMD ps

echo ""
echo -e "${GREEN}Setup complete!${NC}"


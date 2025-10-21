#!/bin/bash

# Lavandaria Deployment Script
# This script will deploy the entire application with one command
#
# ⚠️  IMPORTANT: Always deploy using ./deploy.sh
#    Do NOT use 'docker compose up -d' directly - it will skip migrations!

set -e

echo "🚀 Starting Lavandaria Deployment..."
echo "=================================="

# Detect docker compose command (v2 plugin vs v1 standalone)
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    echo "✅ Using Docker Compose v2 (plugin)"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    echo "✅ Using Docker Compose v1"
else
    echo "❌ Docker Compose is not installed. Please install Docker Compose."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "✅ Docker is installed and running"

# Create necessary directories
echo "📁 Creating required directories..."
mkdir -p uploads/cleaning_photos
mkdir -p logs

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env

    # Generate a secure SESSION_SECRET
    echo "🔐 Generating secure SESSION_SECRET..."
    if command -v node &> /dev/null; then
        SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    else
        # Fallback: use /dev/urandom (portable, no network required)
        SESSION_SECRET=$(head -c 32 /dev/urandom | xxd -p -c 64)
    fi

    # Update .env with generated secret
    if [ "$(uname)" == "Darwin" ]; then
        # macOS
        sed -i '' "s/^SESSION_SECRET=.*$/SESSION_SECRET=${SESSION_SECRET}/" .env
    else
        # Linux
        sed -i "s/^SESSION_SECRET=.*$/SESSION_SECRET=${SESSION_SECRET}/" .env
    fi

    echo "✅ .env file created with secure SESSION_SECRET"
else
    # Check if SESSION_SECRET exists and is valid
    if ! grep -q "^SESSION_SECRET=.\\{32,\\}" .env; then
        echo "⚠️  WARNING: SESSION_SECRET is missing or too short in .env"
        echo "   Generating new SESSION_SECRET..."
        if command -v node &> /dev/null; then
            SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        else
            SESSION_SECRET=$(head -c 32 /dev/urandom | xxd -p -c 64)
        fi

        if [ "$(uname)" == "Darwin" ]; then
            sed -i '' "s/^SESSION_SECRET=.*$/SESSION_SECRET=${SESSION_SECRET}/" .env
        else
            sed -i "s/^SESSION_SECRET=.*$/SESSION_SECRET=${SESSION_SECRET}/" .env
        fi

        echo "✅ SESSION_SECRET updated in .env"
    fi
fi

# Stop and remove existing containers
echo "🛑 Stopping existing containers..."
$COMPOSE_CMD down -v 2>/dev/null || true

# Build and start containers
echo "🏗️  Building Docker images..."
$COMPOSE_CMD build --no-cache

echo "🚀 Starting containers..."
$COMPOSE_CMD up -d

# Wait for database to be ready with proper loop
echo "⏳ Waiting for database to be ready..."
DB_CONTAINER="lavandaria-db"
DB_READY=0
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $DB_READY -eq 0 ] && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    if docker exec $DB_CONTAINER pg_isready -U lavandaria -d lavandaria &> /dev/null; then
        DB_READY=1
        echo "✅ Database is ready (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    else
        echo "   ⏳ Waiting for database... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
        sleep 2
    fi
done

if [ $DB_READY -eq 0 ]; then
    echo "❌ Database failed to become ready after $MAX_ATTEMPTS attempts (60 seconds)"
    echo "   Check logs with: $COMPOSE_CMD logs db"
    exit 1
fi

# Database schema is created via init.sql automatically by PostgreSQL container
# No migrations needed in development - init.sql contains the complete schema
echo "📦 Database initialization..."
echo "   ℹ️  Schema created automatically via database/init.sql"
echo "   ℹ️  This is a DEVELOPMENT setup - fresh database on every deploy"
echo ""
echo "✅ Database schema initialized from init.sql"

# Post-migration table assertions
echo ""
echo "🔍 Verifying required tables exist..."
REQUIRED_TABLES=("users" "clients" "cleaning_jobs" "laundry_orders_new" "laundry_services" "session")

MISSING_TABLES=()
for TABLE in "${REQUIRED_TABLES[@]}"; do
    if docker exec $DB_CONTAINER psql -U lavandaria -d lavandaria -c "\dt $TABLE" 2>&1 | grep -q "Did not find any relation"; then
        MISSING_TABLES+=("$TABLE")
        echo "   ❌ MISSING: Table '$TABLE' does not exist"
    else
        echo "   ✅ VERIFIED: Table '$TABLE' exists"
    fi
done

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
    echo ""
    echo "❌ FATAL: Required tables are missing: ${MISSING_TABLES[*]}"
    echo "   Migrations may not have applied correctly. Check logs above."
    exit 1
fi

echo "✅ All required tables verified"

# Wait for app container to be ready
echo ""
echo "⏳ Waiting for application to be ready..."
APP_READY=0
MAX_APP_ATTEMPTS=30
APP_ATTEMPT=0

while [ $APP_READY -eq 0 ] && [ $APP_ATTEMPT -lt $MAX_APP_ATTEMPTS ]; do
    APP_ATTEMPT=$((APP_ATTEMPT + 1))
    if curl -s -f http://localhost:3000/api/healthz > /dev/null 2>&1; then
        APP_READY=1
        echo "✅ Application is responding (attempt $APP_ATTEMPT/$MAX_APP_ATTEMPTS)"
    else
        echo "   ⏳ Waiting for application... (attempt $APP_ATTEMPT/$MAX_APP_ATTEMPTS)"
        sleep 2
    fi
done

if [ $APP_READY -eq 0 ]; then
    echo "❌ Application failed to become ready after $MAX_APP_ATTEMPTS attempts"
    echo "   Check logs with: $COMPOSE_CMD logs app"
    exit 1
fi

# Health gate checks
echo ""
echo "🏥 Running health checks..."

# Check liveness
HEALTHZ_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/healthz)
if [ "$HEALTHZ_STATUS" = "200" ]; then
    echo "   ✅ Liveness check passed (/api/healthz → 200 OK)"
else
    echo "   ❌ Liveness check failed (/api/healthz → $HEALTHZ_STATUS)"
    exit 1
fi

# Check readiness with DB latency
READYZ_RESPONSE=$(curl -s http://localhost:3000/api/readyz)
READYZ_STATUS=$(echo "$READYZ_RESPONSE" | grep -o '"status":"ready"' || echo "")
DB_LATENCY=$(echo "$READYZ_RESPONSE" | grep -o '"latency_ms":[0-9]*' | cut -d':' -f2 || echo "unknown")

if [ -n "$READYZ_STATUS" ]; then
    echo "   ✅ Readiness check passed (/api/readyz → 200 OK, DB latency: ${DB_LATENCY}ms)"
else
    echo "   ❌ Readiness check failed"
    echo "   Response: $READYZ_RESPONSE"
    exit 1
fi

# Check Docker healthcheck status
echo "   ⏳ Waiting for Docker healthcheck to pass..."
HEALTHCHECK_PASSED=0
MAX_HEALTHCHECK_ATTEMPTS=15
HEALTHCHECK_ATTEMPT=0

while [ $HEALTHCHECK_PASSED -eq 0 ] && [ $HEALTHCHECK_ATTEMPT -lt $MAX_HEALTHCHECK_ATTEMPTS ]; do
    HEALTHCHECK_ATTEMPT=$((HEALTHCHECK_ATTEMPT + 1))
    CONTAINER_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' lavandaria-app 2>/dev/null || echo "unknown")

    if [ "$CONTAINER_HEALTH" = "healthy" ]; then
        HEALTHCHECK_PASSED=1
        echo "   ✅ Docker healthcheck passed (container is healthy)"
    else
        echo "      ⏳ Container health: $CONTAINER_HEALTH (attempt $HEALTHCHECK_ATTEMPT/$MAX_HEALTHCHECK_ATTEMPTS)"
        sleep 3
    fi
done

if [ $HEALTHCHECK_PASSED -eq 0 ]; then
    echo "   ⚠️  WARNING: Docker healthcheck did not pass within expected time"
    echo "      Container may still be starting. Check status with: docker ps"
fi

# Check if containers are running
if [ "$($COMPOSE_CMD ps -q db)" ] && [ "$($COMPOSE_CMD ps -q app)" ]; then
    echo ""
    echo "=================================="
    echo "🎉 Deployment Complete & Healthy!"
    echo "=================================="
    echo ""
    echo "⚠️  REMINDER: Always use ./deploy.sh to deploy"
    echo "   Do NOT use '$COMPOSE_CMD up -d' alone - it skips migrations!"
    echo ""
    echo "📌 Application URLs:"
    echo "   - Frontend: http://localhost:3000"
    echo "   - API Health: http://localhost:3000/api/healthz"
    echo "   - API Readiness: http://localhost:3000/api/readyz"
    echo "   - Database: localhost:5432"
    echo ""
    echo "🔑 Default Credentials:"
    echo "   Master (Owner - Full Access):"
    echo "     - Username: master"
    echo "     - Password: master123"
    echo ""
    echo "   Admin:"
    echo "     - Username: admin"
    echo "     - Password: admin123"
    echo ""
    echo "   Worker:"
    echo "     - Username: worker1"
    echo "     - Password: worker123"
    echo ""
    echo "   Sample Client:"
    echo "     - Phone: 911111111"
    echo "     - Password: lavandaria2025 (must change on first login)"
    echo ""
    echo "📝 Useful Commands:"
    echo "   - View logs: $COMPOSE_CMD logs -f"
    echo "   - View app logs: $COMPOSE_CMD logs -f app"
    echo "   - Stop: $COMPOSE_CMD down"
    echo "   - Restart: $COMPOSE_CMD restart"
    echo "   - Redeploy: ./deploy.sh"
    echo ""
else
    echo "❌ Some containers failed to start. Check logs with: $COMPOSE_CMD logs"
    exit 1
fi

#!/bin/bash

# Lavandaria Deployment Script
# This script will deploy the entire application with one command

set -e

echo "🚀 Starting Lavandaria Deployment..."
echo "=================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
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
    SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

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
        SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

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
docker-compose down -v 2>/dev/null || true

# Build and start containers
echo "🏗️  Building Docker images..."
docker-compose build --no-cache

echo "🚀 Starting containers..."
docker-compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "📦 Running database migrations..."
echo "   - Applying migration 000: user/client fields..."
cat database/migrations/000_add_user_client_fields.sql | docker exec -i lavandaria-db psql -U lavandaria -d lavandaria 2>/dev/null || echo "   ⚠️  Migration 000 already applied or failed"

echo "   - Applying migration 001: standardize address fields..."
cat database/migrations/001_standardize_address_fields.sql | docker exec -i lavandaria-db psql -U lavandaria -d lavandaria 2>/dev/null || echo "   ⚠️  Migration 001 already applied or failed"

echo "   - Applying migration 002: jobs system..."
cat database/migrations/002_create_jobs_system.sql | docker exec -i lavandaria-db psql -U lavandaria -d lavandaria 2>/dev/null || echo "   ⚠️  Migration 002 already applied or failed"

echo "   - Applying migration 003: pricing and settings..."
cat database/migrations/003_pricing_and_settings.sql | docker exec -i lavandaria-db psql -U lavandaria -d lavandaria 2>/dev/null || echo "   ⚠️  Migration 003 already applied or failed"

echo "✅ Migrations completed"

# Check if containers are running
if [ "$(docker-compose ps -q db)" ] && [ "$(docker-compose ps -q app)" ]; then
    echo "✅ All containers are running!"
    echo ""
    echo "=================================="
    echo "🎉 Deployment Complete!"
    echo "=================================="
    echo ""
    echo "📌 Application URLs:"
    echo "   - Frontend: http://localhost:3000"
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
    echo "   - View logs: docker-compose logs -f"
    echo "   - Stop: docker-compose down"
    echo "   - Restart: docker-compose restart"
    echo ""
else
    echo "❌ Some containers failed to start. Check logs with: docker-compose logs"
    exit 1
fi

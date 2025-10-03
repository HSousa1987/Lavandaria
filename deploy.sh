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
    echo "✅ .env file created. Please update it with your settings if needed."
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
echo "   - Applying user/client fields migration..."
cat database/migrations/001_add_user_client_fields.sql | docker exec -i lavandaria-db psql -U lavandaria -d lavandaria 2>/dev/null || echo "   ⚠️  Migration 001 already applied or failed"

echo "   - Applying jobs system migration..."
cat database/migrations/002_create_jobs_system.sql | docker exec -i lavandaria-db psql -U lavandaria -d lavandaria 2>/dev/null || echo "   ⚠️  Migration 002 already applied or failed"

echo "   - Applying pricing and settings migration..."
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
    echo "     - Password: lavandaria2025"
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

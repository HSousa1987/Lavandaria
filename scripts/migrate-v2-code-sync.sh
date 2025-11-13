#!/bin/bash
# V2 Database Schema Code Sync Script
# Automatically updates route files to use V2 schema (name, role_id)
# Date: 2025-11-13

set -e

echo "🔄 Starting V2 Code Sync..."
echo ""

# Define files to update
FILES=(
    "routes/users.js"
    "routes/clients.js"
    "routes/cleaning-jobs.js"
    "routes/dashboard.js"
    "routes/laundry-orders.js"
    "routes/reports.js"
    "routes/notifications.js"
)

# Backup original files
echo "📦 Creating backups..."
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$file.v1-backup"
        echo "  ✓ Backed up: $file"
    fi
done

echo ""
echo "🔧 Applying V2 schema replacements..."

# Replace full_name/first_name/last_name with name
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        # Client references
        sed -i '' 's/c\.full_name/c.name/g' "$file"
        sed -i '' 's/client\.full_name/client.name/g' "$file"

        # User references
        sed -i '' 's/u\.full_name/u.name/g' "$file"
        sed -i '' 's/user\.full_name/user.name/g' "$file"

        # Worker references
        sed -i '' 's/w\.full_name/w.name/g' "$file"
        sed -i '' 's/worker\.full_name/worker.name/g' "$file"

        echo "  ✓ Updated name references: $file"
    fi
done

echo ""
echo "✅ Automated replacements complete!"
echo ""
echo "⚠️  MANUAL STEPS REQUIRED:"
echo "  1. Update queries in routes/users.js to JOIN with role_types"
echo "  2. Update queries in routes/cleaning-jobs.js to JOIN with properties"
echo "  3. Remove references to removed columns (country, registration_date)"
echo "  4. Test each route file manually"
echo ""
echo "📁 Backups saved with .v1-backup extension"

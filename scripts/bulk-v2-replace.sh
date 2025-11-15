#!/bin/bash
# Bulk V1 → V2 schema replacements for route files
# This script does SAFE text replacements that won't break syntax
# Date: 2025-11-13

set -e

FILES="routes/cleaning-jobs.js routes/clients.js routes/dashboard.js routes/laundry-orders.js routes/laundry.js routes/payments.js routes/properties.js routes/tickets.js routes/users.js"

echo "🔄 Bulk V2 Schema Replacements"
echo "=============================="
echo ""

for file in $FILES; do
    echo "📝 Processing: $file"

    # Client name references
    sed -i '' 's/c\.full_name/c.name/g' "$file"
    sed -i '' 's/client\.full_name/client.name/g' "$file"
    sed -i '' 's/clients\.full_name/clients.name/g' "$file"

    # User/Worker name references
    sed -i '' 's/u\.full_name/u.name/g' "$file"
    sed -i '' 's/user\.full_name/user.name/g' "$file"
    sed -i '' 's/users\.full_name/users.name/g' "$file"
    sed -i '' 's/w\.full_name/w.name/g' "$file"
    sed -i '' 's/worker\.full_name/worker.name/g' "$file"

    # first_name/last_name (these should all be replaced with 'name')
    sed -i '' 's/c\.first_name/c.name/g' "$file"
    sed -i '' 's/c\.last_name/c.name/g' "$file"
    sed -i '' 's/u\.first_name/u.name/g' "$file"
    sed -i '' 's/u\.last_name/u.name/g' "$file"

    # Country references (removed in V2 - comment them out for safety)
    sed -i '' 's/c\.country/c.country_REMOVED_IN_V2/g' "$file"
    sed -i '' 's/u\.country/u.country_REMOVED_IN_V2/g' "$file"
    sed -i '' 's/cj\.country/cj.country_REMOVED_IN_V2/g' "$file"
    sed -i '' 's/p\.country/p.country_REMOVED_IN_V2/g' "$file"

    # registration_date (removed in V2)
    sed -i '' 's/u\.registration_date/u.registration_date_REMOVED_IN_V2/g' "$file"
    sed -i '' 's/c\.registration_date/c.registration_date_REMOVED_IN_V2/g' "$file"

    echo "   ✓ Replaced name/country/registration_date references"
done

echo ""
echo "✅ Bulk replacements complete!"
echo ""
echo "⚠️  MANUAL VERIFICATION REQUIRED:"
echo "  1. Search for 'REMOVED_IN_V2' markers"
echo "  2. Update queries to JOIN with role_types for user.role"
echo "  3. Update queries to JOIN with properties for job addresses"
echo "  4. Test each endpoint"

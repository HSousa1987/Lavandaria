# Development vs Production Approach

## ✅ NEW APPROACH (Current - Development)

### Single Source of Truth: `database/init.sql`

**Philosophy**: In development, start fresh every time. No data to preserve.

**How it works**:
1. `docker-compose down -v` - Delete everything
2. `docker-compose up` - Start fresh
3. PostgreSQL automatically runs `/docker-entrypoint-initdb.d/init.sql`
4. Complete schema created from scratch
5. Seed data inserted automatically

**Benefits**:
- ✅ Simple - one file to understand
- ✅ Fast - no migration orchestration
- ✅ Predictable - same result every time
- ✅ Clean - no migration history to track
- ✅ Easy to modify - just edit init.sql

**File**: `database/init.sql` (560 lines, complete schema)

---

## ❌ OLD APPROACH (Archived - Production-style)

### Multiple Migration Files

**Philosophy**: Preserve data while evolving schema (needed for production).

**Files** (now in `database/migrations_archive/`):
- `000_add_user_client_fields.sql`
- `001_standardize_address_fields.sql`
- `002_create_jobs_system.sql`
- `003_pricing_and_settings.sql`
- `004_split_payments_tables.sql`

**Why we DON'T use this in development**:
- ❌ Complex - need to run migrations in specific order
- ❌ Slow - each migration takes time
- ❌ Error-prone - migrations can fail halfway
- ❌ Confusing - which file is source of truth?
- ❌ Unnecessary - we have no data to preserve

---

##When to Use Each Approach

### Development (Current Setup)
```bash
./deploy.sh
# → Runs init.sql automatically
# → Fresh database every time
# → No migrations
```

**Use when**:
- Local development
- Testing
- Learning the system
- Making schema changes

### Production (Future - When You Have Real Data)
```bash
# DON'T run deploy.sh in production!
# Instead, write migration files to preserve data:

# 1. Write migration file
# database/migrations/005_add_new_feature.sql

# 2. Test migration on copy of production data
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria < database/migrations/005_add_new_feature.sql

# 3. Verify data integrity
# 4. Apply to production during maintenance window
```

**Use when**:
- Production environment
- Real customer data exists
- Need to preserve existing data
- Schema changes must be incremental

---

## Migration Strategy for Production

When you eventually go to production:

### 1. Stop Using `init.sql` for Updates
- Keep `init.sql` as documentation of original schema
- All changes go through migration files

### 2. Create Migration Files
```sql
-- database/migrations/YYYYMMDD_HHMM_description.sql
-- Example: 20251021_1500_add_customer_notes.sql

BEGIN;

-- Your changes
ALTER TABLE clients ADD COLUMN special_notes TEXT;
CREATE INDEX idx_clients_special_notes ON clients(special_notes);

-- Always include rollback plan in comments
-- ROLLBACK PLAN:
-- ALTER TABLE clients DROP COLUMN special_notes;

COMMIT;
```

### 3. Test on Staging First
```bash
# Copy production database to staging
pg_dump -U lavandaria lavandaria > prod_backup.sql
psql -U lavandaria lavandaria_staging < prod_backup.sql

# Test migration
psql -U lavandaria lavandaria_staging < database/migrations/new_migration.sql

# Verify everything works
# If good → apply to production
# If bad → fix migration, test again
```

### 4. Apply to Production
```bash
# During maintenance window:
# 1. Backup database
pg_dump -U lavandaria lavandaria > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# 2. Apply migration
psql -U lavandaria lavandaria < database/migrations/new_migration.sql

# 3. Verify
psql -U lavandaria lavandaria -c "SELECT COUNT(*) FROM clients;"

# 4. Test application
curl http://your-domain.com/api/healthz
```

---

## Current Files Structure

```
database/
├── init.sql                          # ✅ ACTIVE - Complete schema for development
├── init.sql.old                      # Backup of old partial schema
└── migrations_archive/               # ❌ ARCHIVED - Old migration files
    ├── 000_add_user_client_fields.sql
    ├── 001_standardize_address_fields.sql
    ├── 002_create_jobs_system.sql
    ├── 003_pricing_and_settings.sql
    └── 004_split_payments_tables.sql
```

---

## FAQ

### Q: Why did we have migrations before?
**A**: Confusion - we were mixing development and production approaches.

### Q: When will we need migrations?
**A**: When you deploy to production and have real customer data that must be preserved.

### Q: Can I modify init.sql directly?
**A**: YES! In development, just edit init.sql and redeploy.

### Q: Will I lose data when I deploy?
**A**: In development - YES, that's intentional. In production - NO, use migrations instead.

### Q: How do I add a new table?
**A**: Edit `init.sql`, add the table definition, run `./deploy.sh`

### Q: How do I change a column?
**A**: Development: Edit `init.sql`, redeploy. Production: Write a migration file.

---

## Summary

**Development = init.sql only (fresh start every time)**
**Production = migrations only (preserve data)**

We're in **development mode** - use `init.sql` and enjoy the simplicity! 🎉

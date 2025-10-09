# CLEANUP PLAN - LEGACY TABLE REMOVAL

**⚠️ WARNING: DO NOT EXECUTE THESE STEPS WITHOUT EXPLICIT APPROVAL**

These steps are **DESTRUCTIVE** and **IRREVERSIBLE** (unless backups are restored).

## Prerequisites

- [ ] Cutover completed successfully (Phase 4)
- [ ] Monitoring period passed (24-48 hours recommended)
- [ ] No 410 errors in server logs (indicates all clients migrated)
- [ ] Application functioning normally with NEW endpoints
- [ ] User acceptance testing completed
- [ ] Final backup confirmed

---

## Step 1: Create Final Backup Before Drop

```sql
-- Execute in database
CREATE TABLE final_backup_20251008_airbnb_orders AS SELECT * FROM airbnb_orders;
CREATE TABLE final_backup_20251008_laundry_orders AS SELECT * FROM laundry_orders;
CREATE TABLE final_backup_20251008_cleaning_photos AS SELECT * FROM cleaning_photos;
CREATE TABLE final_backup_20251008_time_logs AS SELECT * FROM time_logs;
CREATE TABLE final_backup_20251008_services AS SELECT * FROM services;
CREATE TABLE final_backup_20251008_order_items AS SELECT * FROM order_items;

-- Verify backups
SELECT
    'final_backup_20251008_airbnb_orders' as table_name, COUNT(*) as row_count
FROM final_backup_20251008_airbnb_orders
UNION ALL
SELECT 'final_backup_20251008_laundry_orders', COUNT(*) FROM final_backup_20251008_laundry_orders
UNION ALL
SELECT 'final_backup_20251008_services', COUNT(*) FROM final_backup_20251008_services;
```

**Expected Result:** Row counts match legacy tables.

---

## Step 2: Drop Legacy Tables

```sql
BEGIN;

-- Drop legacy tables (CASCADE will drop dependent views/constraints)
DROP TABLE IF EXISTS airbnb_orders CASCADE;
DROP TABLE IF EXISTS laundry_orders CASCADE;
DROP TABLE IF EXISTS cleaning_photos CASCADE;
DROP TABLE IF EXISTS time_logs CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;

-- Record migration completion
INSERT INTO schema_migrations (version, description, applied_by)
VALUES (
    'LEGACY_TABLES_DROPPED',
    'Dropped 6 legacy tables: airbnb_orders, laundry_orders, cleaning_photos, time_logs, services, order_items',
    'manual_execution'
);

COMMIT;
```

**Rollback Plan:**
```sql
BEGIN;
-- Restore from final backups
CREATE TABLE airbnb_orders AS SELECT * FROM final_backup_20251008_airbnb_orders;
CREATE TABLE laundry_orders AS SELECT * FROM final_backup_20251008_laundry_orders;
CREATE TABLE cleaning_photos AS SELECT * FROM final_backup_20251008_cleaning_photos;
CREATE TABLE time_logs AS SELECT * FROM final_backup_20251008_time_logs;
CREATE TABLE services AS SELECT * FROM final_backup_20251008_services;
CREATE TABLE order_items AS SELECT * FROM final_backup_20251008_order_items;
COMMIT;
```

---

## Step 3: Remove Legacy Route Files

```bash
# Backup first
mkdir -p archive/legacy_routes
mv routes/airbnb.js archive/legacy_routes/
mv routes/laundry.js archive/legacy_routes/
mv routes/services.js archive/legacy_routes/

# Remove deprecation handlers from server.js (lines 54-58)
# Remove: app.use('/api/services', (req, res) => {...});
# Remove: app.use('/api/laundry', (req, res) => {...});
# Remove: app.use('/api/airbnb', (req, res) => {...});

# Restart application
docker-compose restart app
```

**Rollback Plan:**
```bash
mv archive/legacy_routes/*.js routes/
# Restore server.js from git
git checkout server.js
docker-compose restart app
```

---

## Step 4: Add Proper FK Constraints to Payments

**Current State:** Payments table has polymorphic `order_id` with application-layer validation.

**Option A: Split Payments Table (RECOMMENDED)**

```sql
BEGIN;

-- Create separate payment tables with real FK constraints
CREATE TABLE payments_cleaning (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    order_id INTEGER NOT NULL REFERENCES cleaning_jobs(id) ON DELETE RESTRICT,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) NOT NULL
        CHECK (payment_method IN ('cash', 'card', 'transfer', 'mbway', 'other')),
    payment_date TIMESTAMP NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments_laundry (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    order_id INTEGER NOT NULL REFERENCES laundry_orders_new(id) ON DELETE RESTRICT,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) NOT NULL
        CHECK (payment_method IN ('cash', 'card', 'transfer', 'mbway', 'other')),
    payment_date TIMESTAMP NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migrate existing payments (if any)
INSERT INTO payments_cleaning (client_id, order_id, amount, payment_method, payment_date, notes, created_at)
SELECT client_id, order_id, amount, payment_method, payment_date, notes, created_at
FROM payments
WHERE order_type = 'airbnb';

INSERT INTO payments_laundry (client_id, order_id, amount, payment_method, payment_date, notes, created_at)
SELECT client_id, order_id, amount, payment_method, payment_date, notes, created_at
FROM payments
WHERE order_type = 'laundry';

-- Verify migration
SELECT
    'payments (old)' as table_name, COUNT(*) as row_count FROM payments
UNION ALL
SELECT 'payments_cleaning (new)', COUNT(*) FROM payments_cleaning
UNION ALL
SELECT 'payments_laundry (new)', COUNT(*) FROM payments_laundry;

-- Drop old payments table
DROP TABLE payments CASCADE;

-- Create indexes
CREATE INDEX idx_payments_cleaning_order ON payments_cleaning(order_id);
CREATE INDEX idx_payments_cleaning_client ON payments_cleaning(client_id);
CREATE INDEX idx_payments_cleaning_date ON payments_cleaning(payment_date DESC);

CREATE INDEX idx_payments_laundry_order ON payments_laundry(order_id);
CREATE INDEX idx_payments_laundry_client ON payments_laundry(client_id);
CREATE INDEX idx_payments_laundry_date ON payments_laundry(payment_date DESC);

-- Record migration
INSERT INTO schema_migrations (version, description)
VALUES ('PAYMENTS_TABLE_SPLIT', 'Split payments into payments_cleaning and payments_laundry with proper FK constraints');

COMMIT;
```

**Option B: Keep Polymorphic with CHECK Constraint (ALTERNATIVE)**

```sql
-- Add CHECK constraint and validation trigger
ALTER TABLE payments
ADD CONSTRAINT check_order_exists
CHECK (
    (order_type = 'laundry' AND EXISTS (SELECT 1 FROM laundry_orders_new WHERE id = order_id))
    OR
    (order_type = 'airbnb' AND EXISTS (SELECT 1 FROM cleaning_jobs WHERE id = order_id))
);

-- Note: CHECK constraints with subqueries are not supported in PostgreSQL
-- Would need to use trigger-based validation instead
```

**Recommendation:** Use Option A (split tables) for true referential integrity.

---

## Step 5: Add Pagination Indexes

```sql
-- Add indexes for efficient pagination on frequently queried tables
CREATE INDEX IF NOT EXISTS idx_cleaning_jobs_pagination
ON cleaning_jobs(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_laundry_orders_pagination
ON laundry_orders_new(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_cleaning_job_photos_pagination
ON cleaning_job_photos(uploaded_at DESC, id DESC);

-- Record optimization
INSERT INTO schema_migrations (version, description)
VALUES ('PAGINATION_INDEXES', 'Added pagination indexes for cleaning_jobs, laundry_orders_new, cleaning_job_photos');
```

---

## Step 6: Clean Up Backup Tables (After Verification Period)

**Recommended Timing:** 30-90 days after successful cutover.

```sql
-- Drop intermediate backups
DROP TABLE IF EXISTS backup_20251008_airbnb_orders CASCADE;
DROP TABLE IF EXISTS backup_20251008_laundry_orders CASCADE;
DROP TABLE IF EXISTS backup_20251008_cleaning_photos CASCADE;
DROP TABLE IF EXISTS backup_20251008_time_logs CASCADE;
DROP TABLE IF EXISTS backup_20251008_services CASCADE;
DROP TABLE IF EXISTS backup_20251008_order_items CASCADE;

-- Keep final backups for 1 year
-- DROP final_backup_* tables only after 1 year of successful operation
```

---

## Execution Timeline (Recommended)

| Step | Timing | Duration | Risk Level |
|------|--------|----------|------------|
| Cutover (Phase 4) | Day 0 | 1-2 hours | Medium |
| Monitoring period | Day 0-2 | 48 hours | Low |
| Drop legacy tables (Step 2) | Day 3 | 10 minutes | Low (backups exist) |
| Remove legacy route files (Step 3) | Day 3 | 5 minutes | Low (archived) |
| Split payments table (Step 4) | Day 7 | 30 minutes | Medium (data migration) |
| Add pagination indexes (Step 5) | Day 7 | 5 minutes | Low |
| Clean up backups (Step 6) | Day 30-90 | 5 minutes | Low |

---

## Final Verification Checklist

After executing cleanup steps:

- [ ] Application starts without errors
- [ ] All API endpoints return 200 OK (no 500 errors)
- [ ] Dashboard loads successfully
- [ ] Users can create/view cleaning jobs
- [ ] Users can create/view laundry orders
- [ ] Payments record successfully (with FK validation)
- [ ] No orphaned records in database
- [ ] Server logs show no SQL errors
- [ ] Browser console shows no 410 errors
- [ ] All tests pass: `./test_all.sh`

---

## Rollback Contact

If critical issues arise during cleanup:

1. **STOP** immediately
2. Execute rollback SQL (Step 2 rollback section)
3. Restore legacy route files (Step 3 rollback section)
4. Restart application: `docker-compose restart app`
5. Verify application is functional
6. Investigate root cause before retrying

---

**🛑 REMINDER: DO NOT EXECUTE WITHOUT EXPLICIT "GO" APPROVAL**

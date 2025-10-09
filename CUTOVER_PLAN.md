# Lavandaria Cutover Plan

**Cutover Date:** 2025-10-08
**Status:** ✅ COMPLETE
**Backup Retention:** 30 days (purge on 2025-11-08)

---

## 📋 Migration Summary

### Goals Achieved
✅ Migrate from polymorphic legacy tables to typed NEW system
✅ Enforce referential integrity with FK constraints
✅ Eliminate schema drift (address standardization)
✅ Improve query performance (pagination indexes)
✅ Maintain zero downtime during cutover

### Final Schema (Canonical)

#### Core Tables
- `users` - Staff accounts (master, admin, worker)
- `clients` - Customer accounts (granular address fields)
- `session` - Express session storage

#### Cleaning Jobs
- `cleaning_jobs` - Main jobs (id, client_id, status, total_cost, etc.)
- `cleaning_job_workers` - Multiple workers per job (junction table)
- `cleaning_job_photos` - Photo verification (before/after/detail)
- `cleaning_time_logs` - Time tracking per worker
- `job_notifications` - Push notifications

#### Laundry Orders
- `laundry_orders_new` - Orders (order_number, client_id, total_price, etc.)
- `laundry_order_items` - Itemized line items
- `laundry_services` - Service catalog/pricing

#### Payments (Split for FK Integrity)
- `payments_cleaning` - FK → cleaning_jobs.id, clients.id (RESTRICT delete)
- `payments_laundry` - FK → laundry_orders_new.id, clients.id (RESTRICT delete)

#### Other
- `tickets` - Worker issue reporting

---

## 🗂️ Migration Phases

### Phase 1: Backup (2025-10-08)
Created safety net before any changes:
```
backup_20251008_airbnb_orders
backup_20251008_cleaning_photos
backup_20251008_laundry_orders
backup_20251008_order_items
backup_20251008_services
backup_20251008_time_logs
```

### Phase 2: Analysis
- Verified legacy tables empty (0 production rows)
- Identified `services` had 12 sample rows (migrated to `laundry_services`)

### Phase 3: Integrity Verification
- FK checks passed (0 orphaned records)
- Row counts validated
- Schema alignment confirmed

### Phase 4: Cutover (2025-10-08)
- **Server changes:**
  - `server.js` - Legacy routes return 410 Gone with migration guidance
  - `routes/dashboard.js` - Updated to query NEW tables
- **Frontend changes:**
  - `Dashboard.js` - Updated to `/api/cleaning-jobs`, `/api/laundry-orders`
  - `WorkerDashboard.js` - Updated to NEW endpoints
- **Result:** Zero 404 errors, smooth transition

### Phase 5: Cleanup & Hardening (2025-10-08)
- Created final backup snapshot (`final_backup_20251008_2145_*`)
- Dropped 7 legacy tables
- Split payments table (FK integrity)
- Added 5 pagination indexes
- Verified FK constraints (0 violations)
- Smoke tested critical endpoints

---

## 🔄 Rollback Procedure

**If major issues detected within 30 days:**

### Step 1: Stop Application
```bash
docker-compose down
```

### Step 2: Restore Legacy Tables
```sql
-- Restore from final backup
CREATE TABLE airbnb_orders AS SELECT * FROM final_backup_20251008_2145_airbnb_orders;
CREATE TABLE laundry_orders AS SELECT * FROM final_backup_20251008_2145_laundry_orders;
CREATE TABLE services AS SELECT * FROM final_backup_20251008_2145_services;
CREATE TABLE cleaning_photos AS SELECT * FROM final_backup_20251008_2145_cleaning_photos;
CREATE TABLE time_logs AS SELECT * FROM final_backup_20251008_2145_time_logs;
CREATE TABLE order_items AS SELECT * FROM final_backup_20251008_2145_order_items;

-- Restore payments (NOTE: No backup exists - would need to merge split tables)
CREATE TABLE payments AS
SELECT id, client_id, order_id, 'cleaning' as order_type, amount, payment_date, payment_method, created_at
FROM payments_cleaning
UNION ALL
SELECT id, client_id, order_id, 'laundry' as order_type, amount, payment_date, payment_method, created_at
FROM payments_laundry;
```

### Step 3: Revert Code Changes
```bash
# Revert to pre-cutover commit
git log --oneline | head -5  # Find commit hash
git checkout <commit-hash> routes/dashboard.js server.js client/src/pages/

# Rebuild
docker-compose build app
```

### Step 4: Restart Application
```bash
docker-compose up -d
```

### Step 5: Verify
```bash
# Check legacy endpoints work
curl http://localhost:3000/api/airbnb
curl http://localhost:3000/api/laundry

# Should return data, not 410
```

---

## 📖 Operational Runbook

### Task 1: Create Cleaning Job
**Endpoint:** `POST /api/cleaning-jobs`

**Request:**
```json
{
  "client_id": 1,
  "job_type": "airbnb",
  "property_name": "Apartment 3B",
  "address_line1": "123 Rua Principal",
  "city": "Lisboa",
  "postal_code": "1000-001",
  "scheduled_date": "2025-10-15",
  "scheduled_time": "10:00",
  "estimated_hours": 3.5,
  "notes": "Deep clean required"
}
```

**Response:**
```json
{
  "id": 42,
  "order_number": "CJ-42",  // Auto-generated
  "status": "scheduled",
  "total_cost": null  // Calculated on completion
}
```

**Common Issues:**
- ❌ `client_id does not exist` → Verify client exists first
- ❌ `Invalid date format` → Use YYYY-MM-DD for dates

---

### Task 2: Record Payment
**Endpoint:** `POST /api/payments`

**For Cleaning Job:**
```json
{
  "order_type": "cleaning",
  "order_id": 42,
  "client_id": 1,
  "amount": 52.50,
  "payment_method": "cash",
  "payment_date": "2025-10-15"
}
```

**For Laundry Order:**
```json
{
  "order_type": "laundry",
  "order_id": 10,
  "client_id": 1,
  "amount": 25.00,
  "payment_method": "mbway"
}
```

**Validation:**
- ✅ Order must exist before payment (FK constraint)
- ✅ `order_type` must be "cleaning" or "laundry"
- ✅ Amount must be > 0

**Database Tables:**
- Cleaning payments → `payments_cleaning` (FK → cleaning_jobs.id)
- Laundry payments → `payments_laundry` (FK → laundry_orders_new.id)

**Common Issues:**
- ❌ `Order not found` → Order doesn't exist or wrong order_type
- ❌ `FK constraint violation` → Database-level protection working correctly

---

### Task 3: Upload Job Photos
**Endpoint:** `POST /api/cleaning-jobs/:id/photos`

**Request (multipart/form-data):**
```bash
curl -X POST \
  -F "photo=@before.jpg" \
  -F "photo_type=before" \
  http://localhost:3000/api/cleaning-jobs/42/photos
```

**Photo Types:**
- `before` - Before cleaning
- `after` - After cleaning
- `detail` - Specific areas

**Storage:**
- Path: `uploads/cleaning_photos/`
- Max size: 5MB per photo
- Formats: jpg, jpeg, png, gif

**Common Issues:**
- ❌ `File too large` → Compress to <5MB
- ❌ `Invalid file type` → Use jpg/png/gif only

---

### Task 4: Troubleshoot "Column Does Not Exist"
**Symptom:** SQL error `column "order_number" does not exist`

**Root Cause:** Code querying wrong table or non-existent column

**Fix:**
1. Check which table is being queried:
   - `cleaning_jobs` has NO `order_number` column (use `CONCAT('CJ-', id)`)
   - `laundry_orders_new` HAS `order_number` column
2. Update query to match schema:
   ```sql
   -- ❌ Wrong
   SELECT order_number FROM cleaning_jobs;

   -- ✅ Correct
   SELECT CONCAT('CJ-', id) as order_number FROM cleaning_jobs;
   ```

**Prevention:** Always check schema before writing queries:
```bash
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "\d cleaning_jobs"
```

---

### Task 5: Handle 410 Gone Response
**Symptom:** API returns `410 Gone` with migration message

**Example Response:**
```json
{
  "error": "Endpoint permanently moved",
  "newEndpoint": "/api/cleaning-jobs",
  "migration": "All cleaning job operations now use /api/cleaning-jobs"
}
```

**Fix:** Update client to use NEW endpoint
- `/api/airbnb` → `/api/cleaning-jobs`
- `/api/laundry` → `/api/laundry-orders`
- `/api/services` → `/api/laundry-services`

**Server-Side (if needed):**
Edit [server.js](./server.js) to remove 410 handler and restore route import

---

### Task 6: Check System Health
**Quick Health Check (30 seconds):**
```bash
# 1. App running
docker ps | grep lavandaria-app

# 2. Database connected
docker-compose logs app | grep "Database connected"

# 3. Recent errors
docker-compose logs app --since 1h | grep -c ERROR

# 4. Test critical endpoint
curl -s http://localhost:3000/api/auth/check
```

**Expected:**
- ✅ Container state: `Up`
- ✅ Database: Connected
- ✅ Errors: <5 in last hour
- ✅ Auth check: Returns `{"authenticated": true/false}`

---

### Task 7: Weekly Validation
See [VALIDATION_CHECKLIST.md](./VALIDATION_CHECKLIST.md) for complete runbook.

**Quick version (5 min):**
```bash
# 1. FK integrity (expect 0 violations)
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT 'payments_cleaning' as table_name, COUNT(*) as orphans
FROM payments_cleaning pc
LEFT JOIN cleaning_jobs cj ON pc.order_id = cj.id
WHERE cj.id IS NULL
UNION ALL
SELECT 'payments_laundry', COUNT(*)
FROM payments_laundry pl
LEFT JOIN laundry_orders_new lo ON pl.order_id = lo.id
WHERE lo.id IS NULL;"

# 2. Row counts (expect growth)
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT 'cleaning_jobs' as table_name, COUNT(*) FROM cleaning_jobs
UNION ALL
SELECT 'laundry_orders_new', COUNT(*) FROM laundry_orders_new;"

# 3. Backup table access (expect empty)
docker-compose logs app --since 7d | grep -i "backup_20251008\|final_backup"
```

---

## 📊 Performance Baselines

### Response Time Targets
| Endpoint | Expected | Warning | Critical |
|----------|----------|---------|----------|
| GET /api/cleaning-jobs | <200ms | >500ms | >2s |
| GET /api/laundry-orders | <200ms | >500ms | >2s |
| GET /api/dashboard/stats | <100ms | >300ms | >1s |
| POST /api/cleaning-jobs/:id/photos | <3s | >5s | >10s |

### Index Coverage
**Pagination queries use:**
- `idx_cleaning_jobs_pagination` (created_at DESC, id DESC)
- `idx_laundry_orders_pagination` (created_at DESC, id DESC)
- `idx_cleaning_job_photos_pagination` (created_at DESC, id DESC)

**Payment lookups use:**
- `idx_payments_cleaning_order` (order_id)
- `idx_payments_laundry_order` (order_id)

### Query Performance Check
```sql
-- Should use index scan, not seq scan
EXPLAIN ANALYZE
SELECT * FROM cleaning_jobs
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Expected: Index Scan using idx_cleaning_jobs_pagination
```

---

## 🔐 Security Notes

### FK Constraints Enforce Data Integrity
- **Cannot delete order with payments** (RESTRICT policy)
- **Cannot create payment for non-existent order** (FK validation)
- **Cannot create orphaned records** (database-level protection)

### Session Management
- Sessions stored in PostgreSQL (`session` table)
- HTTP-only cookies (no JavaScript access)
- 24-hour expiry (configurable)

### Input Validation
- Server-side: express-validator middleware
- Database: Parameterized queries (no SQL injection)
- File uploads: Type/size restrictions (5MB max)

---

## 📅 Post-Cutover Checklist

**Week 1 (Daily):**
- [x] Monitor error logs (docker-compose logs)
- [x] Check 410 response count (should decrease daily)
- [x] Verify FK integrity (0 violations)
- [x] Test critical endpoints (dashboard, jobs, orders)

**Week 2-4 (Weekly):**
- [ ] Run full validation checklist
- [ ] Review backup table access (should be 0)
- [ ] Check performance metrics (response times)
- [ ] Verify no legacy queries in new code

**Day 30 (2025-11-08):**
- [ ] Final backup verification
- [ ] Execute purge plan (see PURGE_PLAN.md)
- [ ] Archive deprecated route files
- [ ] Update docs to remove backup references

---

## 📞 Support & Escalation

**For issues:**
1. Check [MONITORING.md](./MONITORING.md) troubleshooting section
2. Review [VALIDATION_CHECKLIST.md](./VALIDATION_CHECKLIST.md)
3. Check recent commits: `git log --oneline | head -10`
4. Open GitHub issue with error logs

**Emergency rollback:**
See "Rollback Procedure" section above (requires <30 days from cutover)

**Contact:**
- Repository: Check `git log` for commit authors
- Documentation: [CLAUDE.md](./CLAUDE.md)

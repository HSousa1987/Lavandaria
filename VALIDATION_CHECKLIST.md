# Weekly Validation Checklist

**Frequency:** Weekly (every Monday)
**Duration:** ~5 minutes
**Purpose:** Verify database integrity, performance, and backup retention policy

---

## ✅ Checklist

### 1. Foreign Key Integrity (Expected: 0 violations)

```bash
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT
    'payments_cleaning orphans' as check_type,
    COUNT(*) as violations
FROM payments_cleaning pc
LEFT JOIN cleaning_jobs cj ON pc.order_id = cj.id
WHERE cj.id IS NULL

UNION ALL

SELECT
    'payments_laundry orphans',
    COUNT(*)
FROM payments_laundry pl
LEFT JOIN laundry_orders_new lo ON pl.order_id = lo.id
WHERE lo.id IS NULL

UNION ALL

SELECT
    'cleaning_jobs orphans',
    COUNT(*)
FROM cleaning_jobs cj
LEFT JOIN clients c ON cj.client_id = c.id
WHERE c.id IS NULL

UNION ALL

SELECT
    'laundry_orders orphans',
    COUNT(*)
FROM laundry_orders_new lo
LEFT JOIN clients c ON lo.client_id = c.id
WHERE c.id IS NULL;"
```

**✅ PASS:** All violations = 0
**❌ FAIL:** Any violations >0 → Escalate to [MONITORING.md](./MONITORING.md#troubleshooting)

---

### 2. Row Count Growth (Expected: Increasing or stable)

```bash
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT
    'cleaning_jobs' as table_name,
    COUNT(*) as row_count
FROM cleaning_jobs

UNION ALL

SELECT
    'laundry_orders_new',
    COUNT(*)
FROM laundry_orders_new

UNION ALL

SELECT
    'cleaning_job_photos',
    COUNT(*)
FROM cleaning_job_photos

UNION ALL

SELECT
    'laundry_order_items',
    COUNT(*)
FROM laundry_order_items

UNION ALL

SELECT
    'payments_cleaning',
    COUNT(*)
FROM payments_cleaning

UNION ALL

SELECT
    'payments_laundry',
    COUNT(*)
FROM payments_laundry

ORDER BY table_name;"
```

**Record results:**
| Week | cleaning_jobs | laundry_orders_new | payments_cleaning | payments_laundry |
|------|---------------|-------------------|-------------------|------------------|
| Oct 9 | 1 | 2 | 0 | 0 |
| Oct 16 | | | | |
| Oct 23 | | | | |
| Oct 30 | | | | |
| Nov 6 | | | | |

**✅ PASS:** Numbers increase or stay stable
**⚠️ WARNING:** Unexpected decrease → Check for deletions

---

### 3. Backup Table Access (Expected: Empty)

```bash
docker-compose logs app --since 7d | grep -E "backup_20251008|final_backup_20251008" | grep -v "CREATE TABLE\|DROP TABLE"
```

**✅ PASS:** No output (no queries touching backups)
**❌ FAIL:** Any output → Code still references backup tables

---

### 4. Legacy Endpoint Access (Expected: Decreasing to 0)

```bash
docker-compose logs app --since 7d | grep -c "410"
```

**✅ PASS:** Count = 0 (no legacy endpoint hits)
**⚠️ WARNING:** Count >10 → Clients not updated yet
**📊 TRACK:** Week-over-week decrease expected

---

### 5. Error Rate (Expected: <10/day)

```bash
docker-compose logs app --since 7d | grep -c "ERROR"
```

**✅ PASS:** <70 errors (10/day average)
**⚠️ WARNING:** >70 errors → Investigate root cause
**❌ CRITICAL:** >200 errors → System instability

---

### 6. Database Connection Health

```bash
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT
    count(*) as total_connections,
    count(*) FILTER (WHERE state = 'active') as active_connections,
    count(*) FILTER (WHERE state = 'idle') as idle_connections
FROM pg_stat_activity
WHERE datname = 'lavandaria';"
```

**✅ PASS:** active <20, idle <50
**⚠️ WARNING:** active >50 → Connection leak
**❌ CRITICAL:** total >80 → Restart required

---

### 7. Critical Endpoint Test (Expected: <100ms)

```bash
# Login first
curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/login/user \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"master\",\"password\":\"master123\"}" > /dev/null

# Test dashboard stats
time curl -s -b /tmp/cookies.txt http://localhost:3000/api/dashboard/stats | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"Clients: {data['totalClients']}\")
print(f\"Laundry Orders: {data['totalLaundryOrders']}\")
print(f\"Cleaning Jobs: {data['totalAirbnbOrders']}\")
print(f\"Revenue: {data['totalRevenue']}\")
print(f\"Pending: {data['pendingPayments']}\")
"
```

**✅ PASS:** Response in <0.1s (100ms), valid JSON
**⚠️ WARNING:** >0.5s (500ms) → Performance degradation
**❌ FAIL:** Error or timeout → Escalate immediately

---

### 8. Index Usage Verification

```bash
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE indexname IN (
    'idx_cleaning_jobs_pagination',
    'idx_laundry_orders_pagination',
    'idx_cleaning_job_photos_pagination',
    'idx_payments_cleaning_order',
    'idx_payments_laundry_order'
)
ORDER BY tablename, indexname;"
```

**✅ PASS:** idx_scan >0 (indexes being used)
**⚠️ WARNING:** idx_scan = 0 → Index not used (queries may be slow)

---

### 9. Table Size Monitoring

```bash
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
      'cleaning_jobs',
      'laundry_orders_new',
      'cleaning_job_photos',
      'payments_cleaning',
      'payments_laundry'
  )
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

**✅ PASS:** All <100MB
**⚠️ WARNING:** Any table >100MB → Consider archiving old data
**📊 TRACK:** Week-over-week growth

---

## 📋 Validation Report Template

Copy and fill out weekly:

```
=== WEEKLY VALIDATION REPORT ===
Date: YYYY-MM-DD
Validator: [Your Name]

1. FK Integrity: [PASS/FAIL] - [violations count]
2. Row Counts: [PASS/WARN] - [see table above]
3. Backup Access: [PASS/FAIL] - [query count]
4. Legacy Endpoints: [PASS/WARN] - [410 count]
5. Error Rate: [PASS/WARN/CRITICAL] - [error count]
6. DB Connections: [PASS/WARN/CRITICAL] - [active/idle counts]
7. Dashboard Test: [PASS/WARN/FAIL] - [response time]
8. Index Usage: [PASS/WARN] - [see index stats]
9. Table Sizes: [PASS/WARN] - [largest table size]

Overall Status: [ALL PASS / NEEDS ATTENTION / CRITICAL]
Actions Required: [List any follow-up actions]
Notes: [Additional observations]
```

---

## 🚨 Escalation Matrix

| Status | Action |
|--------|--------|
| ALL PASS | No action required |
| 1-2 WARNINGS | Monitor next week, document in report |
| 3+ WARNINGS or 1 CRITICAL | Immediate investigation required |
| 2+ CRITICAL | Emergency escalation - see [CUTOVER_PLAN.md](./CUTOVER_PLAN.md#rollback-procedure) |

---

## 📅 30-Day Checkpoint (2025-11-08)

**Before purging backups, perform extended validation:**

### Additional Checks:
1. Re-run full validation checklist (all steps above)
2. Verify no backup table references in codebase:
   ```bash
   grep -r "backup_20251008\|final_backup" /Applications/XAMPP/xamppfiles/htdocs/Lavandaria/routes/
   grep -r "backup_20251008\|final_backup" /Applications/XAMPP/xamppfiles/htdocs/Lavandaria/client/src/
   ```
   **Expected:** No results

3. Confirm legacy endpoints unused (7-day window):
   ```bash
   docker-compose logs app --since 7d | grep -c "410"
   ```
   **Expected:** 0

4. Final backup table inventory:
   ```bash
   docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
   SELECT
       tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   WHERE schemaname = 'public'
     AND (tablename LIKE '%backup%')
   ORDER BY tablename;"
   ```

**If all checks PASS → Proceed to purge (see [PURGE_PLAN.md](./PURGE_PLAN.md))**

---

## 🛠️ Quick Fix Commands

### If FK violations found:
```bash
# Investigate orphaned records
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT * FROM payments_cleaning pc
LEFT JOIN cleaning_jobs cj ON pc.order_id = cj.id
WHERE cj.id IS NULL;"

# Manual cleanup (if confirmed orphans)
# DELETE FROM payments_cleaning WHERE order_id = [orphan_id];
```

### If backup tables accessed:
```bash
# Find offending queries
docker-compose logs app --since 7d | grep -B 3 "backup_20251008"

# Check codebase for references
grep -rn "backup_20251008" routes/
```

### If dashboard endpoint fails:
```bash
# Check specific error
docker-compose logs app | grep -A 10 "dashboard/stats"

# Rebuild container if needed
docker-compose build app && docker-compose up -d app
```

---

## 📖 Reference

- [MONITORING.md](./MONITORING.md) - Detailed monitoring guide
- [CUTOVER_PLAN.md](./CUTOVER_PLAN.md) - Operational runbook
- [PURGE_PLAN.md](./PURGE_PLAN.md) - 30-day backup purge instructions
- [CLAUDE.md](./CLAUDE.md) - Full system documentation

# Lavandaria Monitoring & Alerts

**Created:** 2025-10-09
**30-Day Backup Purge Date:** 2025-11-08

## 📊 What to Monitor

### 1. Application Logs (Docker)
```bash
# Real-time monitoring
docker-compose logs -f app | grep -E "(ERROR|FATAL|WARN)"

# Daily error count
docker-compose logs app --since 24h | grep -c "ERROR"
```

**Thresholds:**
- ❌ **Critical**: >10 SQL errors/hour → Check query compatibility with NEW tables
- ⚠️ **Warning**: >5 401/403 errors/hour → Authentication/permission issues
- ℹ️ **Info**: 410 responses → Legacy endpoint accessed (redirect client)

### 2. Database Health
```bash
# Check active connections
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active';"

# Check table sizes
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;"
```

**Thresholds:**
- ❌ **Critical**: >80 active connections → Connection leak
- ⚠️ **Warning**: Any table >500MB → Consider archiving old data

### 3. Legacy Object Access
```bash
# Check for queries touching dropped tables
docker-compose logs app --since 1h | grep -E "(airbnb_orders|laundry_orders[^_]|services[^_]|cleaning_photos|time_logs|order_items)" | grep -v "backup"
```

**Expected:** Zero results (all queries use NEW tables)

### 4. Foreign Key Violations
```bash
# Weekly FK integrity check
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

**Expected:** All violations = 0

---

## 🚨 Alert Conditions

| Metric | Threshold | Action |
|--------|-----------|--------|
| SQL errors | >10/hour | Check logs for table/column not found errors |
| Legacy endpoint hits (410) | >20/day | Update client integrations |
| FK violations | >0 | Run integrity repair script |
| Backup table queries | >0 | Code still referencing old tables |
| Disk usage | >80% | Archive old photos, purge backups |

---

## 🗓️ 30-Day Backup Retention

**Backup Tables Created:** 2025-10-08
**Retention Period:** 30 days
**Purge Date:** 2025-11-08

### Backup Inventory
```
backup_20251008_airbnb_orders              (8 kB)
backup_20251008_cleaning_photos            (8 kB)
backup_20251008_laundry_orders             (8 kB)
backup_20251008_order_items                (8 kB)
backup_20251008_services                   (16 kB)
backup_20251008_time_logs                  (8 kB)
final_backup_20251008_2145_airbnb_orders   (8 kB)
final_backup_20251008_2145_cleaning_photos (8 kB)
final_backup_20251008_2145_laundry_orders  (8 kB)
final_backup_20251008_2145_order_items     (8 kB)
final_backup_20251008_2145_services        (16 kB)
final_backup_20251008_2145_time_logs       (8 kB)

Total: 106 kB (negligible storage impact)
```

**Verification Commands:**
```bash
# Confirm no queries touch backups (run daily)
docker-compose logs app --since 24h | grep -i "backup_20251008\|final_backup" | grep -v "CREATE TABLE\|DROP TABLE"

# Expected: Empty output
```

**On 2025-11-08, execute purge plan (see PURGE_PLAN.md)**

---

## 📈 Performance Metrics

### Key Endpoints to Monitor
```bash
# Dashboard stats (Master/Admin)
time curl -s -b /tmp/cookies.txt http://localhost:3000/api/dashboard/stats

# Cleaning jobs list (Worker)
time curl -s -b /tmp/cookies.txt http://localhost:3000/api/cleaning-jobs

# Laundry orders list
time curl -s -b /tmp/cookies.txt http://localhost:3000/api/laundry-orders
```

**Baseline Response Times:**
- Dashboard stats: <100ms
- Job/order lists: <200ms (for <1000 rows)
- Photo upload: <3s (5MB max)

**Thresholds:**
- ⚠️ **Warning**: >500ms for lists → Check index usage
- ❌ **Critical**: >2s for any endpoint → Database connection pool exhausted

---

## 🔍 Daily Checks (1 min)

```bash
# 1. App running
docker ps | grep lavandaria-app

# 2. Recent errors
docker-compose logs app --since 24h | grep -c ERROR

# 3. Legacy access attempts
docker-compose logs app --since 24h | grep -c "410"
```

**All green if:**
- App container is UP
- ERROR count < 5
- 410 count < 10

---

## 📅 Weekly Validation (5 min)

See [VALIDATION_CHECKLIST.md](./VALIDATION_CHECKLIST.md) for complete runbook.

Quick checks:
1. Run FK integrity script (expect 0 violations)
2. Test dashboard stats endpoint (expect valid JSON)
3. Verify backup tables not queried (expect empty grep)
4. Check table row counts (expect growth in cleaning_jobs, laundry_orders_new)

---

## 🛠️ Troubleshooting

### "Column does not exist" error
**Cause:** Code still using legacy column names
**Fix:** Check [routes/](./routes/) for queries referencing old schema

### 410 Gone responses
**Cause:** Client hitting deprecated endpoints
**Fix:** Update client to use NEW endpoints:
- `/api/airbnb` → `/api/cleaning-jobs`
- `/api/laundry` → `/api/laundry-orders`
- `/api/services` → `/api/laundry-services`

### FK constraint violation on payment insert
**Cause:** Order doesn't exist before payment created
**Fix:** Ensure order created first, then reference order_id in payment

### Slow queries (>500ms)
**Cause:** Missing index or full table scan
**Fix:** Run `EXPLAIN ANALYZE` on slow query, add index if needed

---

## 📞 Escalation

**Rollback Procedure:**
See [CUTOVER_PLAN.md](./CUTOVER_PLAN.md#rollback-procedure)

**Support Contact:**
Check `git log` for commit authors or open GitHub issue

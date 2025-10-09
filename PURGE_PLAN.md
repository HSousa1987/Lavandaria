# 30-Day Backup Purge Plan

**Purge Date:** 2025-11-08 (30 days after cutover)
**Backup Created:** 2025-10-08
**Total Size:** 106 kB (negligible)

---

## 📦 Backup Inventory

### Phase 1 Backups (2025-10-08)
```
backup_20251008_airbnb_orders       (8 kB, 0 rows)
backup_20251008_cleaning_photos     (8 kB, 0 rows)
backup_20251008_laundry_orders      (8 kB, 0 rows)
backup_20251008_order_items         (8 kB, 0 rows)
backup_20251008_services            (16 kB, 12 rows - sample data)
backup_20251008_time_logs           (8 kB, 0 rows)
```

### Phase 5 Final Backups (2025-10-08 21:45)
```
final_backup_20251008_2145_airbnb_orders    (8 kB, 0 rows)
final_backup_20251008_2145_cleaning_photos  (8 kB, 0 rows)
final_backup_20251008_2145_laundry_orders   (8 kB, 0 rows)
final_backup_20251008_2145_order_items      (8 kB, 0 rows)
final_backup_20251008_2145_services         (16 kB, 12 rows - sample data)
final_backup_20251008_2145_time_logs        (8 kB, 0 rows)
```

**Total:** 12 tables, 106 kB

---

## ✅ Pre-Purge Checklist

**Run on 2025-11-08 BEFORE executing purge:**

### 1. Verify No Production Data in Backups
```bash
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT
    'backup_20251008_airbnb_orders' as table_name,
    COUNT(*) as row_count
FROM backup_20251008_airbnb_orders

UNION ALL

SELECT 'backup_20251008_laundry_orders', COUNT(*)
FROM backup_20251008_laundry_orders

UNION ALL

SELECT 'backup_20251008_services', COUNT(*)
FROM backup_20251008_services

UNION ALL

SELECT 'final_backup_20251008_2145_airbnb_orders', COUNT(*)
FROM final_backup_20251008_2145_airbnb_orders

UNION ALL

SELECT 'final_backup_20251008_2145_laundry_orders', COUNT(*)
FROM final_backup_20251008_2145_laundry_orders

UNION ALL

SELECT 'final_backup_20251008_2145_services', COUNT(*)
FROM final_backup_20251008_2145_services

ORDER BY table_name;"
```

**Expected:**
- airbnb_orders: 0 rows
- laundry_orders: 0 rows
- services: 12 rows (sample data only)

**✅ SAFE TO PURGE** if all values match expected

---

### 2. Confirm No Code References Backups
```bash
# Check backend routes
grep -r "backup_20251008\|final_backup" /Applications/XAMPP/xamppfiles/htdocs/Lavandaria/routes/

# Check frontend
grep -r "backup_20251008\|final_backup" /Applications/XAMPP/xamppfiles/htdocs/Lavandaria/client/src/

# Check database queries in logs (last 7 days)
docker-compose logs app --since 7d | grep -i "backup_20251008\|final_backup" | grep -v "CREATE TABLE\|DROP TABLE"
```

**Expected:** No results for all three checks

**✅ SAFE TO PURGE** if no references found

---

### 3. Verify NEW System Healthy
```bash
# Run weekly validation checklist
# See VALIDATION_CHECKLIST.md for full commands

# Quick health check
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT 'cleaning_jobs' as table_name, COUNT(*) FROM cleaning_jobs
UNION ALL
SELECT 'laundry_orders_new', COUNT(*) FROM laundry_orders_new
UNION ALL
SELECT 'payments_cleaning', COUNT(*) FROM payments_cleaning
UNION ALL
SELECT 'payments_laundry', COUNT(*) FROM payments_laundry;"
```

**Expected:** Row counts ≥ values from 2025-10-08 (growth or stable)

**✅ SAFE TO PURGE** if NEW system has data and is operational

---

### 4. Final Backup Verification (Optional Paranoia Check)
```bash
# Export final snapshot to disk (if extra safety desired)
docker exec lavandaria-db pg_dump -U lavandaria lavandaria \
  -t backup_20251008_* \
  -t final_backup_20251008_2145_* \
  > /tmp/lavandaria_backup_final_20251108.sql

# Compress
gzip /tmp/lavandaria_backup_final_20251108.sql

# Store for 90 days (expires 2026-02-06)
mv /tmp/lavandaria_backup_final_20251108.sql.gz ~/lavandaria_archive/
```

**Optional:** Store compressed backup offsite for 90 additional days

---

## 🗑️ Purge Execution

### GO PURGE Prompt

**⚠️ DESTRUCTIVE OPERATION - CANNOT BE UNDONE**

Copy and paste this prompt when ready:

```
GO PURGE

I confirm:
1. ✅ All pre-purge checks passed
2. ✅ No production data in backup tables
3. ✅ No code references backup tables
4. ✅ NEW system healthy and operational
5. ✅ 30 days elapsed since cutover (2025-11-08)
6. ✅ Optional: Final disk backup created

Execute the following SQL to permanently delete all backup tables:

DROP TABLE IF EXISTS
  backup_20251008_airbnb_orders,
  backup_20251008_cleaning_photos,
  backup_20251008_laundry_orders,
  backup_20251008_order_items,
  backup_20251008_services,
  backup_20251008_time_logs,
  final_backup_20251008_2145_airbnb_orders,
  final_backup_20251008_2145_cleaning_photos,
  final_backup_20251008_2145_laundry_orders,
  final_backup_20251008_2145_order_items,
  final_backup_20251008_2145_services,
  final_backup_20251008_2145_time_logs
CASCADE;
```

---

## 🚀 Execution Steps

### Step 1: Run Pre-Purge Checklist
Execute all 4 checks above. All must pass before proceeding.

### Step 2: Create Final Disk Backup (Optional)
```bash
docker exec lavandaria-db pg_dump -U lavandaria lavandaria \
  -t backup_20251008_* \
  -t final_backup_20251008_2145_* \
  > /tmp/lavandaria_backup_final_20251108.sql

gzip /tmp/lavandaria_backup_final_20251108.sql
mv /tmp/lavandaria_backup_final_20251108.sql.gz ~/lavandaria_archive/
ls -lh ~/lavandaria_archive/lavandaria_backup_final_20251108.sql.gz
```

### Step 3: Execute DROP Statement
```bash
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
DROP TABLE IF EXISTS
  backup_20251008_airbnb_orders,
  backup_20251008_cleaning_photos,
  backup_20251008_laundry_orders,
  backup_20251008_order_items,
  backup_20251008_services,
  backup_20251008_time_logs,
  final_backup_20251008_2145_airbnb_orders,
  final_backup_20251008_2145_cleaning_photos,
  final_backup_20251008_2145_laundry_orders,
  final_backup_20251008_2145_order_items,
  final_backup_20251008_2145_services,
  final_backup_20251008_2145_time_logs
CASCADE;"
```

**Expected Output:**
```
DROP TABLE
```

### Step 4: Verify Purge Complete
```bash
# Should return 0 rows
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND (tablename LIKE '%backup%')
ORDER BY tablename;"
```

**Expected:** `(0 rows)`

### Step 5: Reclaim Disk Space
```bash
# Run VACUUM to reclaim disk space
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "VACUUM FULL;"
```

### Step 6: Verify Application Health
```bash
# Check app still running
docker ps | grep lavandaria-app

# Test critical endpoint
curl -s http://localhost:3000/api/auth/check

# Check logs for errors
docker-compose logs app --tail=50 | grep -E "ERROR|FATAL"
```

**Expected:** No errors, app operational

---

## 📋 Post-Purge Actions

### 1. Update Documentation
- [x] Remove backup references from [MONITORING.md](./MONITORING.md)
- [x] Update [CLAUDE.md](./CLAUDE.md) to remove "30-day retention" section
- [x] Mark this file (PURGE_PLAN.md) as EXECUTED

### 2. Archive Deprecated Routes (Optional)
```bash
# Move archived route files to separate directory
mkdir -p /Applications/XAMPP/xamppfiles/htdocs/Lavandaria/routes_archived
mv routes/airbnb.js routes_archived/
mv routes/laundry.js routes_archived/
mv routes/services.js routes_archived/

# Update git
git add routes_archived/
git commit -m "Archive deprecated legacy routes"
```

### 3. Final Verification Report
```
=== PURGE COMPLETION REPORT ===
Date: 2025-11-08
Executor: [Your Name]

Pre-Purge Checks:
✅ No production data in backups
✅ No code references
✅ NEW system healthy
✅ 30 days elapsed

Purge Execution:
✅ DROP TABLE executed successfully
✅ 12 tables removed
✅ Disk space reclaimed (VACUUM FULL)
✅ Application health verified

Post-Purge:
✅ Documentation updated
✅ Deprecated routes archived
✅ Final backup stored: ~/lavandaria_archive/lavandaria_backup_final_20251108.sql.gz

Disk Space Reclaimed: [Size in KB/MB]
Final Table Count: [Number of production tables]

Status: COMPLETE ✅
```

---

## 🔙 Emergency Restore (If Needed Within 90 Days)

**If disk backup was created:**

```bash
# Restore from disk backup
gunzip ~/lavandaria_archive/lavandaria_backup_final_20251108.sql.gz
cat ~/lavandaria_archive/lavandaria_backup_final_20251108.sql | \
  docker exec -i lavandaria-db psql -U lavandaria lavandaria

# Verify restore
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE '%backup%'
ORDER BY tablename;"
```

**If no disk backup exists:**
- Backup tables are permanently lost
- NEW system remains fully operational
- Legacy data was already migrated before cutover

---

## 📊 Purge Summary

| Item | Before Purge | After Purge |
|------|--------------|-------------|
| Backup Tables | 12 | 0 |
| Disk Space (backups) | 106 kB | 0 kB |
| Production Tables | 16 | 16 |
| Rollback Capability | 30 days | None (NEW system only) |
| Optional Disk Backup | N/A | 90 days (if created) |

---

## ⏰ Timeline

| Date | Event |
|------|-------|
| 2025-10-08 | Cutover complete, backups created |
| 2025-10-09 - 2025-11-07 | 30-day retention period |
| **2025-11-08** | **PURGE DATE** |
| 2025-11-08 - 2026-02-06 | Optional disk backup retention (90 days) |
| 2026-02-06 | All backups expired |

---

## 🎯 Success Criteria

Purge is considered successful when:

✅ All 12 backup tables dropped
✅ 0 rows returned from backup table query
✅ Application remains operational
✅ No errors in application logs
✅ Disk space reclaimed via VACUUM
✅ Documentation updated

---

**END OF PURGE PLAN**

*This document will be marked as EXECUTED on 2025-11-08 after successful purge.*

# Archived Routes

This directory contains legacy route files that have been replaced by the new system.

## Archived Files

### `airbnb.js` (Archived: 2025-10-09)
**Replaced by:** `routes/cleaning-jobs.js`

**Reason:** System migration from old `airbnb_orders` table to new `cleaning_jobs` system with:
- Multiple workers support
- Enhanced photo verification
- Time tracking per worker
- Better job assignment workflow

**Status:** The old `/api/airbnb` endpoint now returns HTTP 410 Gone with migration guidance.

**Migration Date:** 2025-10-08 (Cutover completed)

**Backup Data:**
- Old data backed up in `backup_20251008_*` tables
- Backup retention: 30 days (purge on 2025-11-08)

## How to Access Archived Code

Files in this directory are for reference only and are not loaded by the application.

To view the old implementation:
```bash
cat archived/airbnb.js
```

## Restoration (Emergency Only)

If you need to temporarily restore an archived route:

1. Copy the file back to `routes/`
2. Add the route to `server.js`
3. Restart the application

**Warning:** Archived routes may not work with the current database schema.

## Related Documentation

- [CUTOVER_PLAN.md](../CUTOVER_PLAN.md) - Details of the migration
- [POST_CUTOVER_SUMMARY.md](../POST_CUTOVER_SUMMARY.md) - Post-migration status
- [MONITORING.md](../MONITORING.md) - System monitoring and backup retention policy

---
**Last Updated:** 2025-10-09

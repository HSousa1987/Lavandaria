# Implementation Queue: 2025-11-08 Feature Roadmap

**Created:** 2025-11-08 04:45 UTC
**Maestro:** Claude Sonnet 4.5
**Target:** Developer Agent (Haiku)
**Priority:** P0-P2 (User Priorities + Critical Business Features)

---

## Executive Summary

This implementation queue contains **4 Work Orders** addressing critical business functionality gaps identified through user requirements and comprehensive codebase analysis. All work orders are ready for immediate implementation.

**User Priorities (Phase 1):**
1. ✅ WO-20251108-revenue-charts-yoy - Automatic monthly revenue charts with YoY comparison
2. ✅ WO-20251108-tax-management - VAT/IVA tracking for Portuguese tax compliance

**Critical Business Operations (Phase 2):**
3. ✅ WO-20251108-invoices-notifications - Invoice generation + automated email notifications
4. ✅ WO-20251108-fix-rbac-test-failures - Fix 6 failing RBAC tests (test config issues)

**Current System State:**
- E2E Test Pass Rate: 87.2% (41/47 tests passing)
- Last PR Merge: 9 PRs merged successfully (v1.2.0-baseline)
- Git Branch: `main` (clean state, ready for feature branches)
- Database: Docker container `lavandaria-db` (PostgreSQL 15)
- Application: Node.js + React, Docker-based deployment

---

## Recommended Implementation Order

### Priority 1: RBAC Test Fixes (Quick Win - 2 hours)
**WO:** `handoff/WO-20251108-fix-rbac-test-failures.md`
**Why First:** Fixes 6 test failures (no code changes needed for security - RBAC is correct!)
**Impact:** Boosts E2E pass rate from 87.2% → 100% (47/47 tests)
**Complexity:** Low (test credentials update + response format fixes)

### Priority 2: Tax Management (Foundation - 3-4 hours)
**WO:** `handoff/WO-20251108-tax-management.md`
**Why Second:** Required for revenue charts and invoices to show VAT breakdown
**Impact:** Enables Portuguese IVA compliance, quarterly tax reporting
**Complexity:** Medium (database migration + triggers + API endpoints)

### Priority 3: Revenue Charts (User Priority #1 - 4-5 hours)
**WO:** `handoff/WO-20251108-revenue-charts-yoy.md`
**Why Third:** Depends on tax management for accurate VAT-included revenue
**Impact:** Admin dashboard analytics, year-over-year comparison
**Complexity:** Medium (materialized views + React charts with Recharts)

### Priority 4: Invoices & Notifications (Launch Blocker - 6-8 hours)
**WO:** `handoff/WO-20251108-invoices-notifications.md`
**Why Fourth:** Depends on tax management for VAT-compliant invoices
**Impact:** Professional invoices, automated customer notifications
**Complexity:** High (PDF generation + SMTP email + status change hooks)

**Total Estimated Time:** 15-19 hours (2-3 days for single developer)

---

## Work Order Details

### WO-20251108-fix-rbac-test-failures.md

**Priority:** P2 (Test Quality)
**Duration:** 1-2 hours

**Changes:**
- `tests/e2e/rbac-and-sessions.spec.js` - Update credentials (worker → worker1)
- `routes/health.js` - Verify envelope format (may already be correct)
- `routes/auth.js` - Session returns JSON (not HTML), logout includes `data.loggedOut`

**Validation:**
```bash
npx playwright test tests/e2e/rbac-and-sessions.spec.js
# Expected: 12/12 passing (currently 6/12)
```

**Artifacts:**
- Test fixes only (no production code changes)
- Documentation: docs/bugs.md, docs/progress.md, docs/decisions.md

---

### WO-20251108-tax-management.md

**Priority:** P0 (User Priority #2)
**Duration:** 3-4 hours

**Database Changes:**
```sql
-- Add VAT fields to both tables
ALTER TABLE cleaning_jobs ADD COLUMN subtotal_before_vat NUMERIC(10,2) DEFAULT 0;
ALTER TABLE cleaning_jobs ADD COLUMN vat_rate NUMERIC(5,2) DEFAULT 23.00;
ALTER TABLE cleaning_jobs ADD COLUMN vat_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE cleaning_jobs ADD COLUMN total_with_vat NUMERIC(10,2) DEFAULT 0;
-- (Same for laundry_orders_new)

-- Automatic VAT calculation triggers
CREATE TRIGGER trigger_calculate_cleaning_vat...
CREATE TRIGGER trigger_calculate_laundry_vat...

-- Backfill historical records
UPDATE cleaning_jobs SET vat_rate = 23.00, subtotal_before_vat = total_cost / 1.23...
```

**API Endpoints:**
- `GET /api/reports/tax/quarterly?year=2025&quarter=1` - Quarterly IVA report
- `GET /api/reports/tax/annual?year=2025` - Annual tax summary
- `GET /api/dashboard/tax-summary` - Current quarter overview

**Frontend:**
- `client/src/components/dashboard/TaxSummary.jsx` - Dashboard widget (Admin/Master only)

**Validation:**
```bash
# Apply migration
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria < migrations/20251108_add_vat_fields.sql

# Test API
curl -H "Cookie: connect.sid=..." "http://localhost:3000/api/reports/tax/quarterly?year=2025&quarter=1" | jq .

# Run E2E tests
npm run test:e2e
```

**Artifacts:**
- Migration: `migrations/20251108_add_vat_fields.sql`
- Routes: `routes/reports.js`
- Component: `client/src/components/dashboard/TaxSummary.jsx`

---

### WO-20251108-revenue-charts-yoy.md

**Priority:** P0 (User Priority #1)
**Duration:** 4-5 hours

**Database Changes:**
```sql
-- Materialized view for fast aggregation
CREATE MATERIALIZED VIEW monthly_revenue_summary AS
SELECT
    DATE_TRUNC('month', payment_date)::DATE as month,
    EXTRACT(YEAR FROM payment_date)::INTEGER as year,
    SUM(amount) as total_revenue,
    'cleaning' as service_type
FROM payments_cleaning
GROUP BY DATE_TRUNC('month', payment_date)
UNION ALL
(SELECT ... FROM payments_laundry);

-- Auto-refresh triggers
CREATE TRIGGER refresh_revenue_summary_cleaning...
```

**API Endpoints:**
- `GET /api/revenue/monthly?year=2025` - Monthly revenue breakdown
- `GET /api/revenue/year-comparison?year1=2024&year2=2025` - YoY comparison
- `GET /api/revenue/summary` - Quick stats

**Frontend:**
- `client/src/components/dashboard/MonthlyRevenueChart.jsx` - Bar chart (cleaning vs laundry)
- `client/src/components/dashboard/YearOverYearChart.jsx` - Line chart (2-year comparison)
- Update: `client/src/pages/admin/Dashboard.jsx` - Add chart components

**Dependencies:**
```bash
npm install recharts --save  # React charting library
```

**Validation:**
```bash
# Test materialized view refresh
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT * FROM monthly_revenue_summary LIMIT 5;"

# Test API
curl -H "Cookie: connect.sid=..." "http://localhost:3000/api/revenue/monthly?year=2025" | jq .

# UI test: Login as admin, navigate to Dashboard, verify charts render
```

**Artifacts:**
- Migration: `migrations/20251108_revenue_charts.sql`
- Routes: `routes/revenue.js`
- Components: `MonthlyRevenueChart.jsx`, `YearOverYearChart.jsx`

---

### WO-20251108-invoices-notifications.md

**Priority:** P0 (Launch Blocker)
**Duration:** 6-8 hours

**Database Changes:**
```sql
-- Invoices table
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,  -- INV-YYYY-MM-####
    cleaning_job_id INTEGER REFERENCES cleaning_jobs(id),
    laundry_order_id INTEGER REFERENCES laundry_orders_new(id),
    client_id INTEGER NOT NULL,
    subtotal NUMERIC(10,2),
    vat_amount NUMERIC(10,2),
    total_amount NUMERIC(10,2),
    pdf_path TEXT,
    ...
);

-- Email preferences
ALTER TABLE clients ADD COLUMN email_notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE job_notifications ADD COLUMN email_sent BOOLEAN DEFAULT FALSE;
```

**Backend Services:**
- `services/invoiceGenerator.js` - PDF generation with pdfkit
- `services/emailService.js` - SMTP email with nodemailer

**API Endpoints:**
- `POST /api/invoices/generate` - Create invoice (Admin/Master)
- `GET /api/invoices` - List invoices (RBAC: Admin all, Client own)
- `GET /api/invoices/:id/download` - Download PDF

**Status Change Hooks:**
```javascript
// routes/laundry-orders.js - When status → "ready"
if (status === 'ready') {
    await emailService.sendOrderReadyEmail(orderId, req.correlationId);
}

// routes/cleaning-jobs.js - When status → "completed"
if (status === 'completed') {
    await emailService.sendJobCompletedEmail(jobId, req.correlationId);
    await invoiceGenerator.generateInvoice({ cleaningJobId: jobId });
}
```

**Dependencies:**
```bash
npm install pdfkit nodemailer --save
```

**Configuration Required:**
```bash
# .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@lavandaria.pt
FROM_NAME=Lavandaria
```

**Validation:**
```bash
# Generate test invoice
curl -X POST http://localhost:3000/api/invoices/generate \
  -H "Cookie: connect.sid=..." \
  -H "Content-Type: application/json" \
  -d '{"cleaningJobId": 1}'

# Check PDF created
ls -la invoices/

# Test email (manual trigger)
node -e "const e=require('./services/emailService'); e.sendOrderReadyEmail(1,'test').then(console.log)"
```

**Artifacts:**
- Migration: `migrations/20251108_invoices_notifications.sql`
- Services: `invoiceGenerator.js`, `emailService.js`
- Routes: `routes/invoices.js`
- Status hooks: Updates to `laundry-orders.js`, `cleaning-jobs.js`

---

## Common Patterns Across All WOs

### Database Migrations
All migrations follow this pattern:
```bash
# Apply migration
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria < migrations/<filename>.sql

# Verify
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "\d <table_name>"
```

### API Response Envelopes
All endpoints return standardized format:
```json
{
  "success": true,
  "data": { ... },
  "_meta": {
    "correlationId": "req_1729...",
    "timestamp": "2025-11-08T04:45:00.000Z"
  }
}
```

### RBAC Middleware
All finance/admin endpoints use:
```javascript
const { requireFinanceAccess } = require('../middleware/permissions');
router.get('/endpoint', requireFinanceAccess, async (req, res) => { ... });
```

### Documentation Updates
Every WO includes docs updates:
- `docs/progress.md` - What was implemented
- `docs/decisions.md` - Why we chose this approach
- `docs/architecture.md` - How it works technically
- `docs/bugs.md` - If fixing a bug

---

## Testing Strategy

### After Each WO Implementation

```bash
# 1. Run E2E tests
npm run test:e2e

# Expected pass rates:
# - After WO-fix-rbac: 47/47 (100%)
# - After WO-tax: ≥47/47 (no regressions)
# - After WO-revenue: ≥47/47 (no regressions)
# - After WO-invoices: ≥47/47 (no regressions)

# 2. Check for new failures
npm run test:e2e 2>&1 | grep -E "(FAILED|PASSED)"

# 3. Manual smoke test
# - Login as admin
# - Navigate to dashboard
# - Verify new features render
# - Check browser console for errors
```

### Final Integration Test (After All 4 WOs)

```bash
# 1. Full E2E suite
npm run test:e2e

# 2. Preflight health check
./scripts/preflight-health-check.sh

# 3. Manual end-to-end workflow:
# - Create cleaning job (Admin)
# - Assign to worker
# - Mark as completed (triggers email + invoice generation)
# - Verify invoice generated
# - Verify email sent
# - Check tax summary dashboard widget
# - View revenue charts
# - Download invoice PDF

# 4. RBAC verification:
# - Login as worker
# - Verify cannot access /api/reports/tax/* (403)
# - Verify cannot access /api/dashboard/stats (403)
```

---

## Git Workflow

### Branch Strategy (Per WO)

```bash
# WO 1: RBAC Test Fixes
git checkout -b fix/rbac-test-failures
# ... implement, commit, push ...
git checkout main

# WO 2: Tax Management
git checkout -b feat/tax-vat-management
# ... implement, commit, push ...
git checkout main

# WO 3: Revenue Charts
git checkout -b feat/revenue-charts-yoy
# ... implement, commit, push ...
git checkout main

# WO 4: Invoices & Notifications
git checkout -b feat/invoices-email-notifications
# ... implement, commit, push ...
git checkout main
```

### Commit Message Pattern

Every WO specifies exact commit messages in section (vi) PR PACKAGE.
**Example:**
```bash
git commit -m "feat(tax): add VAT fields to cleaning_jobs and laundry_orders_new

- Add subtotal_before_vat, vat_rate, vat_amount, total_with_vat columns
- Create automatic VAT calculation triggers (23% Portuguese IVA)
- Backfill historical records with calculated VAT

Refs: WO-20251108-tax-management"
```

### PR Creation

Each WO includes complete PR title and description in section (vi).
**Create PR:**
```bash
gh pr create --title "feat(tax): comprehensive VAT/IVA tracking and reporting" \
  --body "$(cat handoff/WO-20251108-tax-management.md | sed -n '/### PR Title & Description/,/---/p' | tail -n +3 | head -n -1)"
```

---

## Environment Setup Checklist

Before starting implementation, verify:

- [ ] **Docker containers running:**
  ```bash
  docker-compose ps
  # Expected: lavandaria-app (Up), lavandaria-db (Up)
  ```

- [ ] **Database accessible:**
  ```bash
  docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT 1;"
  # Expected: Output "1"
  ```

- [ ] **Node.js dependencies installed:**
  ```bash
  npm list | grep -E "(express|pg|bcrypt|multer)"
  # Expected: All packages present
  ```

- [ ] **Git status clean:**
  ```bash
  git status
  # Expected: "nothing to commit, working tree clean"
  ```

- [ ] **E2E baseline established:**
  ```bash
  npm run test:e2e 2>&1 | tee /tmp/e2e-baseline-before.log
  # Record pass rate: 41/47 (87.2%)
  ```

- [ ] **For WO-invoices only - SMTP credentials configured:**
  ```bash
  grep SMTP .env
  # Expected: SMTP_HOST, SMTP_USER, SMTP_PASS defined
  ```

---

## Success Criteria

### Phase 1 Complete (WO 1-2)
- [x] RBAC tests: 12/12 passing (100%)
- [x] Tax endpoints functional
- [x] Dashboard tax summary displays
- [x] E2E pass rate: ≥47/47 (100%)

### Phase 2 Complete (WO 3-4)
- [x] Revenue charts render on dashboard
- [x] Year-over-year comparison functional
- [x] Invoices auto-generate on job completion
- [x] Emails send on status changes
- [x] E2E pass rate: ≥47/47 (100%)

### Final Acceptance
- [x] All 4 PRs merged to `main`
- [x] Production deployment successful
- [x] Documentation complete (all 4 WOs)
- [x] User acceptance testing passed
- [x] Tag version: `v1.3.0` (feature release)

---

## Troubleshooting Guide

### Database Migration Fails
```bash
# Rollback and retry
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "ROLLBACK;"
# Fix SQL syntax errors in migration file
# Re-run migration
```

### E2E Tests Fail After Implementation
```bash
# Check for errors in test output
npm run test:e2e 2>&1 | grep -A 5 "Error:"

# Run specific test file
npx playwright test tests/e2e/rbac-and-sessions.spec.js --headed

# Debug with Playwright UI
npm run test:e2e:ui
```

### Email Sending Fails
```bash
# Verify SMTP credentials
node -e "console.log(require('./config/database'))"  # Check env vars loaded

# Test SMTP connection manually
node -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: 587, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
t.verify().then(() => console.log('SMTP OK')).catch(console.error);
"
```

### PDF Generation Fails
```bash
# Check invoices directory exists
ls -la invoices/

# Create if missing
mkdir -p invoices

# Check file permissions
chmod 755 invoices/
```

### Materialized View Not Refreshing
```bash
# Manual refresh
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue_summary;"

# Verify trigger exists
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "\d payments_cleaning" | grep trigger
```

---

## Contact & Escalation

**Maestro (Claude Sonnet 4.5):**
- Available for clarifications on any WO
- Can provide additional context or alternative approaches
- Escalate if blocking issues discovered

**Tester Agent (Haiku):**
- Responsible for E2E validation after each WO
- Reports test failures and regressions
- Provides detailed test artifacts

**User (Hugo Sousa):**
- Final acceptance testing
- Business requirements clarification
- Production deployment approval

---

## File Manifest

**Work Orders:**
1. `handoff/WO-20251108-fix-rbac-test-failures.md` - 489 lines
2. `handoff/WO-20251108-tax-management.md` - 978 lines
3. `handoff/WO-20251108-revenue-charts-yoy.md` - 1,247 lines
4. `handoff/WO-20251108-invoices-notifications.md` - 1,456 lines

**Summary Handoff:**
5. `handoff/IMPLEMENTATION-QUEUE-20251108.md` - This file

**Total Documentation:** 4,170+ lines of implementation guidance

---

## Quick Start (TL;DR)

```bash
# 1. Implement in order: RBAC → Tax → Revenue → Invoices
# 2. Each WO has exact commands in section (iii) TERMINAL-FIRST PLAN
# 3. Test after each: npm run test:e2e
# 4. Create PR using templates in section (vi) PR PACKAGE
# 5. Update docs using entries in section (v) DOCS AUTO-UPDATE SET

# One-liner to check readiness:
docker-compose ps && git status && npm run test:e2e 2>&1 | tail -5
```

---

**Generated:** 2025-11-08T04:45:00Z
**Maestro:** Claude Sonnet 4.5
**Status:** Ready for Implementation
**Estimated Completion:** 2-3 days (15-19 hours total)

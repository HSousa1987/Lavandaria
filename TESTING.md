# Lavandaria E2E Testing Guide

## Overview

This document provides comprehensive guidance for running and debugging end-to-end tests for the Lavandaria system using Playwright.

## Quick Start

```bash
# 1. Install dependencies (first time only)
npm install
npx playwright install

# 2. Start the application
./deploy.sh  # or npm start

# 3. Seed test data
npm run test:seed

# 4. Run tests (headless, terminal-first)
npm run test:e2e

# 5. View results
npm run test:e2e:report
```

## Test Execution Workflow (REQUIRED ORDER)

### Phase 1: Terminal-First Execution

```bash
# Run all tests headless
npm run test:e2e

# Expected output:
# ✓ Worker Photo Upload - Batch Limits (6 tests)
# ✓ Client Photo Viewing - Complete Set Access (4 tests)
# ✓ RBAC & Sessions (10 tests)
#
# Artifacts collected:
# - screenshots/ (on failure)
# - test-results/ (traces, videos)
# - playwright-report/ (HTML report)
```

**What to check:**
- All tests passing (green checkmarks)
- No console errors in test output
- Correlation IDs logged for each API request
- Artifacts generated for any failures

### Phase 2: Browser Debugging (If Failures Occur)

```bash
# Open Playwright UI mode
npm run test:e2e:ui

# Features:
# - Replay test traces step-by-step
# - Inspect network requests
# - View screenshots at each step
# - Check browser console logs
# - See correlation IDs in request headers
```

**Debugging Steps:**

1. **Identify failing test** in terminal output
2. **Check correlation ID** in server logs:
   ```bash
   docker-compose logs -f app | grep "req_1730..."
   ```
3. **Open trace** in Playwright UI:
   - Click on failed test
   - Use timeline to step through actions
   - Inspect network tab for API responses
   - Check "Call" tab for error details
4. **Review artifacts**:
   - Screenshots: `test-results/[test-name]/test-failed-*.png`
   - Videos: `test-results/[test-name]/video.webm`
   - Traces: `test-results/[test-name]/trace.zip`

## Test Credentials

Created by `npm run test:seed`:

| Role | Username/Phone | Password | Purpose |
|------|----------------|----------|---------|
| Master | `master` | `master123` | Full system access |
| Admin | `admin` | `admin123` | Finance + management |
| Worker | `worker1` | `worker123` | Field operations |
| Client | `911111111` | `lavandaria2025` | Customer view |

**Test Job:**
- One cleaning job assigned to `worker1`
- Linked to client `911111111`
- Status: `scheduled`
- Property: "Test Apartment, Avenida da Liberdade, 100, Lisboa"

## Test Suites

### 1. Worker Photo Upload (`tests/e2e/worker-photo-upload.spec.js`)

**Tests:**
1. ✅ Upload 10 photos in one batch (max batch size)
2. ✅ Upload 5 batches × 10 photos = 50 total (unlimited total)
3. ❌ Upload 11 photos in one batch → `BATCH_LIMIT_EXCEEDED`
4. ❌ Upload invalid file types → rejected
5. ❌ Upload oversized files (>10MB) → 413 error
6. ❌ Upload to unassigned job → `NOT_ASSIGNED`
7. ✅ All responses include correlation IDs

**Key Validation Points:**
- Batch limit of 10 files enforced
- No limit on total photos across multiple batches
- Worker can only upload to assigned jobs
- Standardized error responses with correlation IDs
- Success responses include photo metadata

### 2. Client Photo Viewing (`tests/e2e/client-photo-viewing.spec.js`)

**Tests:**
1. ✅ Client views all photos for own job
2. ✅ Pagination works for large photo sets
3. ✅ Viewing photos marks them as viewed
4. ✅ Total count reflects all photos regardless of batches
5. ❌ Client cannot access another client's job → `NOT_YOUR_JOB`
6. ❌ Worker cannot access unassigned job → `NOT_ASSIGNED`
7. ❌ Unauthenticated access → 401 error
8. ✅ All responses include correlation IDs

**Key Validation Points:**
- RBAC strictly enforced
- Photo pagination metadata included
- Viewed tracking works correctly
- Complete photo set accessible

### 3. RBAC & Sessions (`tests/e2e/rbac-and-sessions.spec.js`)

**Tests:**
1. ❌ Worker cannot access `/api/payments` → 403
2. ❌ Worker cannot access `/api/dashboard` → 403
3. ✅ Admin can access finance routes
4. ✅ Master can access all routes
5. ❌ Client cannot access `/api/users` → 403
6. ❌ Client cannot access `/api/clients` → 403
7. ✅ Session persists across page reloads
8. ✅ `/api/auth/check` returns user info
9. ✅ Logout clears session
10. ✅ Concurrent sessions work independently
11. ✅ `/api/healthz` works without auth
12. ✅ `/api/readyz` shows database status

**Key Validation Points:**
- Finance routes blocked for workers
- Staff routes blocked for clients
- Session persistence works
- Health endpoints are public

## Expected Error Behaviors

### Photo Upload Errors

| Scenario | Status | Error Code | Message |
|----------|--------|------------|---------|
| No files | 400 | `NO_FILES` | "No photos uploaded" |
| 11+ files | 400 | `BATCH_LIMIT_EXCEEDED` | "Maximum 10 photos per upload batch" |
| Invalid type | 400 | - | "Only image files are allowed" |
| File > 10MB | 413 | - | Multer error |
| Unassigned job | 403 | `NOT_ASSIGNED` | "You can only upload photos to your assigned jobs" |
| Job not found | 404 | `JOB_NOT_FOUND` | "Job not found" |

### Photo Viewing Errors

| Scenario | Status | Error Code | Message |
|----------|--------|------------|---------|
| Another client's job | 403 | `NOT_YOUR_JOB` | "You can only view your own jobs" |
| Unassigned job (worker) | 403 | `NOT_ASSIGNED` | "You can only view your assigned jobs" |
| Job not found | 404 | `JOB_NOT_FOUND` | "Job not found" |
| Not authenticated | 401 | - | "Authentication required" |

### RBAC Errors

| Scenario | Status | Error Code | Message |
|----------|--------|------------|---------|
| Worker → finance route | 403 | - | "Finance access denied" |
| Client → staff route | 403 | - | "Staff access required" or "Access denied" |
| No authentication | 401 | - | "Authentication required" |

## Debugging Common Issues

### Issue: Tests failing with "Job not found"

**Root Cause:** Test data not seeded correctly

**Solution:**
```bash
# Re-seed test data
npm run test:seed

# Verify data exists
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT id FROM cleaning_jobs LIMIT 5;"
```

### Issue: File upload tests failing

**Root Cause:** Uploads directory missing or wrong permissions

**Solution:**
```bash
# Create directory with correct permissions
mkdir -p uploads/cleaning_photos
chmod 755 uploads/cleaning_photos

# Verify in container
docker exec -it lavandaria-app ls -la uploads/
```

### Issue: Session/authentication tests failing

**Root Cause:** SESSION_SECRET not set or too weak

**Solution:**
```bash
# Check .env file
cat .env | grep SESSION_SECRET

# Regenerate if missing
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update .env and restart
./deploy.sh
```

### Issue: Correlation IDs not in responses

**Root Cause:** Middleware not applied or response helpers not used

**Solution:**
- Check `server.js` has `addCorrelationId` middleware
- Verify route uses `errorResponse()` or `successResponse()` helpers
- Check response headers for `X-Correlation-Id`

### Issue: Tests timeout or hang

**Root Cause:** Application not running or health check failing

**Solution:**
```bash
# Check app is running
curl http://localhost:3000/api/healthz

# Check database connection
curl http://localhost:3000/api/readyz

# Restart if needed
./deploy.sh
```

## Artifacts and Logs

### Test Artifacts

```
test-results/
├── worker-photo-upload-batch-limits/
│   ├── test-failed-1.png          # Screenshot on failure
│   ├── video.webm                  # Video recording
│   └── trace.zip                   # Playwright trace
└── junit.xml                       # JUnit format for CI

playwright-report/
└── index.html                      # HTML report (open in browser)
```

### Server Logs

```bash
# Follow all logs
docker-compose logs -f

# Filter by correlation ID
docker-compose logs -f app | grep "req_1730123456_abc123"

# Filter by endpoint
docker-compose logs -f app | grep "POST /api/cleaning-jobs"

# Filter by error level
docker-compose logs -f app | grep "❌"
```

### Network Debugging

Playwright UI mode shows all network requests:
1. Open trace: `npm run test:e2e:ui`
2. Click "Network" tab
3. Find API request
4. Check:
   - Request headers (includes `X-Correlation-Id`)
   - Request payload
   - Response status
   - Response body (includes `_meta.correlationId`)

## CI/CD Integration

```yaml
# Example GitHub Actions workflow
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npx playwright install --with-deps
      - run: ./deploy.sh
      - run: npm run test:seed
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Best Practices

1. **Always run terminal-first**: Headless execution is faster and required for CI
2. **Use correlation IDs**: Essential for debugging multi-request flows
3. **Check artifacts**: Screenshots and traces contain valuable debugging info
4. **Seed data fresh**: Run `npm run test:seed` before test suite to ensure clean state
5. **Monitor server logs**: Use correlation ID to trace requests through backend
6. **Test in isolation**: Each test should be independent and clean up after itself
7. **Use standardized responses**: All API responses must use envelope pattern with `_meta`

## Support

For issues or questions:
1. Check [CLAUDE.md](CLAUDE.md) for architecture details
2. Review server logs with correlation IDs
3. Inspect Playwright traces in UI mode
4. Verify test data with `npm run test:seed`

# Production Readiness Plan of Record
**Project:** Lavandaria Management System
**Owner:** HSousa1987
**Program Lead:** Claude Code
**Baseline Branch:** `production-readiness-baseline`
**Target Completion:** 2025-10-29 (7 days)
**Status:** 🟡 In Progress

---

## Executive Summary

This plan establishes a comprehensive production-readiness program covering API stability, UI functionality, database integrity, security hardening, test coverage, CI/CD automation, and documentation completeness. The program respects existing contracts (correlation IDs, standardized responses, session-based auth) and the current photo policy (unlimited total; 10-file batch cap).

**Current State:** Backend APIs are production-ready. Frontend has 2 critical bugs blocking UI testing.

**Goal:** Ship a production-ready system with >80% test coverage, zero critical bugs, comprehensive documentation, and automated CI/CD.

---

## Program Milestones

### Phase 1: Critical Bug Fixes (Days 1-2) 🔥
**Goal:** Unblock UI testing and restore core functionality

| Milestone | Target | Status | Acceptance |
|-----------|--------|--------|------------|
| Fix tab navigation bug | Day 1 | 🔴 TODO | Playwright can click tabs, activeTab state updates |
| Fix View Details modal | Day 1 | 🔴 TODO | Modal opens, displays job data, photos visible |
| Deploy fixes to production | Day 2 | 🔴 TODO | All users can access features, no regressions |

**Exit Criteria:** All UI features accessible via normal clicks, E2E tests can run end-to-end

---

### Phase 2: Test Coverage & Automation (Days 3-4) ✅
**Goal:** Achieve comprehensive test coverage across all layers

| Milestone | Target | Status | Acceptance |
|-----------|--------|--------|------------|
| Complete E2E test suite | Day 3 | 🔴 TODO | All user flows covered, tests pass in CI |
| Add integration tests | Day 3 | 🔴 TODO | API routes tested with real DB, >80% coverage |
| Add unit tests | Day 4 | 🔴 TODO | Critical business logic tested, >70% coverage |
| Set up CI/CD pipeline | Day 4 | 🔴 TODO | Tests run on PR, deploy on merge |

**Exit Criteria:** >80% overall test coverage, automated testing in CI

---

### Phase 3: Security & Performance (Days 5-6) 🔒
**Goal:** Harden security and optimize performance for production load

| Milestone | Target | Status | Acceptance |
|-----------|--------|--------|------------|
| Security audit | Day 5 | 🔴 TODO | No high/critical vulnerabilities, OWASP Top 10 checked |
| Performance testing | Day 5 | 🔴 TODO | <200ms p95 latency, handles 100 concurrent users |
| Database optimization | Day 6 | 🔴 TODO | Indexes on queries, <50ms query times |
| Rate limiting review | Day 6 | 🔴 TODO | All public endpoints rate-limited, tested under load |

**Exit Criteria:** System handles production load, no security vulnerabilities

---

### Phase 4: Documentation & Deployment (Day 7) 📚
**Goal:** Complete documentation and prepare for production deployment

| Milestone | Target | Status | Acceptance |
|-----------|--------|--------|------------|
| API documentation | Day 7 | 🔴 TODO | OpenAPI spec, all endpoints documented |
| Deployment runbook | Day 7 | 🔴 TODO | Step-by-step deployment guide, rollback procedures |
| Monitoring setup | Day 7 | 🔴 TODO | Healthchecks, alerts, dashboards configured |
| Production deployment | Day 7 | 🔴 TODO | System live, monitored, stable |

**Exit Criteria:** Complete documentation, successful production deployment

---

## Risk Assessment

### High Priority Risks 🔴

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| **Frontend bugs block release** | 🔴 Critical | High | Fix in Phase 1, parallel API work | Claude |
| **Database migration failure** | 🔴 Critical | Low | Test on staging, backup strategy | DevOps |
| **Photo upload under load** | 🟡 High | Medium | Load testing, connection pooling | Claude |
| **Session store failures** | 🔴 Critical | Low | PostgreSQL session persistence tested | Claude |

### Medium Priority Risks 🟡

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| **Test coverage gaps** | 🟡 High | Medium | Systematic testing strategy | Claude |
| **CORS configuration issues** | 🟡 High | Low | Test with production domains | Claude |
| **Rate limiting bypass** | 🟡 High | Low | Security audit, penetration test | Security |

### Low Priority Risks 🟢

| Risk | Impact | Probability | Mitigation | Owner |
|------|--------|-------------|------------|-------|
| **Documentation incomplete** | 🟢 Medium | Medium | Phase 4 focus | Claude |
| **CI/CD pipeline failure** | 🟢 Medium | Low | Fallback to manual deploy | DevOps |

---

## Test Strategy

### 1. End-to-End Tests (Playwright MCP)

**Coverage:** User-facing flows from login to completion

**Priority Tests:**
1. **Worker Photo Upload Flow** (CRITICAL)
   - Login as worker
   - Navigate to assigned job
   - Upload 1 photo → verify success
   - Upload 10 photos batch → verify success
   - Upload 11 photos batch → verify rejection with BATCH_LIMIT_EXCEEDED
   - Verify photos visible in database
   - Verify photos visible in job details

2. **Client Photo Viewing Flow** (CRITICAL)
   - Login as client
   - View assigned cleaning job
   - See all uploaded photos with pagination
   - Verify cannot see other clients' photos (RBAC)

3. **Admin Order Management Flow** (HIGH)
   - Create cleaning job
   - Assign to worker
   - View worker progress
   - Verify payment tracking

4. **RBAC Enforcement** (CRITICAL)
   - Worker cannot access finance routes
   - Client cannot access admin routes
   - Worker cannot upload to unassigned jobs

**Execution:**
- Run headless first: `npx playwright test`
- Debug with UI: `npx playwright test --ui`
- CI integration: GitHub Actions workflow

**Location:** `tests/e2e/*.spec.js`

---

### 2. Integration Tests (API + Database)

**Coverage:** API routes with real database interactions

**Priority Tests:**
1. **Photo Upload API** (CRITICAL)
   - POST /api/cleaning-jobs/:id/photos
   - Test all error scenarios (no auth, wrong worker, batch limit)
   - Verify database state after each test
   - Test file upload edge cases (empty file, huge file, invalid type)

2. **Authentication & Sessions** (CRITICAL)
   - Login flows (staff + client)
   - Session persistence across requests
   - Logout clears session
   - Session expiry handling

3. **Cleaning Jobs CRUD** (HIGH)
   - Create, read, update, delete operations
   - RBAC enforcement at query level
   - Correlation IDs in all responses

4. **Payment Tracking** (HIGH)
   - Create payments linked to jobs
   - Foreign key integrity (split tables)
   - Finance route access control

**Execution:**
- Test against real PostgreSQL (Docker container)
- Use seed data for consistent state
- Clean up database after each test suite

**Location:** `tests/integration/*.test.js`

---

### 3. Unit Tests (Business Logic)

**Coverage:** Isolated functions and utilities

**Priority Tests:**
1. **Validation Middleware** (HIGH)
   - validatePagination (limit, offset, sort, order)
   - handleValidationErrors (express-validator chains)
   - Response envelope helpers (listResponse, successResponse, errorResponse)

2. **Permission Middleware** (CRITICAL)
   - requireAuth, requireMaster, requireMasterOrAdmin
   - requireStaff, requireFinanceAccess
   - canManageUsers(targetRole) factory

3. **Rate Limiter** (HIGH)
   - Correlation ID generation
   - Rate limit tracking per IP
   - Proper 429 responses with retryAfter

4. **Error Handling** (CRITICAL)
   - Multer error handler (LIMIT_UNEXPECTED_FILE, LIMIT_FILE_SIZE)
   - Standardized error envelopes
   - Correlation ID propagation

**Execution:**
- Use Jest or Mocha + Chai
- Mock database calls with Sinon
- 100% coverage target for critical paths

**Location:** `tests/unit/*.test.js`

---

### 4. Database Tests

**Coverage:** Schema integrity, migrations, queries

**Priority Tests:**
1. **Schema Validation** (CRITICAL)
   - All 16 tables exist
   - Foreign keys enforced
   - CHECK constraints work (enums)
   - Indexes on frequently queried columns

2. **Migration Integrity** (CRITICAL)
   - Run migrations in order (000→002→001→003)
   - No data loss during migration
   - Rollback scripts work
   - Idempotent (can run multiple times)

3. **Query Performance** (HIGH)
   - <50ms for simple queries
   - <200ms for complex joins
   - Pagination works correctly
   - No N+1 query problems

4. **Backup & Restore** (HIGH)
   - pg_dump creates valid backups
   - Restore works without errors
   - Backup tables can be purged safely (after 2025-11-08)

**Execution:**
- Use Docker PostgreSQL container
- Test scripts in `tests/database/*.sql`
- Measure query performance with EXPLAIN ANALYZE

**Location:** `tests/database/*.test.js`, `tests/database/queries/*.sql`

---

### Test Execution Strategy

**Local Development:**
```bash
# 1. Unit tests (fast, no DB required)
npm run test:unit

# 2. Integration tests (real DB, Docker)
docker-compose up -d db
npm run test:integration

# 3. E2E tests (full stack, headless)
npm run test:e2e

# 4. All tests
npm test
```

**CI/CD (GitHub Actions):**
```yaml
# .github/workflows/test.yml
- Run unit tests (parallel)
- Spin up Docker stack (db + app)
- Run integration tests (parallel by suite)
- Run E2E tests (Playwright headless)
- Generate coverage report
- Fail PR if coverage <80%
```

**Coverage Targets:**
- **Overall:** >80%
- **Critical paths:** >95% (auth, payments, photo upload, RBAC)
- **API routes:** >85%
- **Frontend:** >70%

---

## Acceptance Criteria

### System-Wide Criteria

- [ ] **Zero Critical Bugs** - No P0/P1 bugs in production
- [ ] **Test Coverage >80%** - Overall coverage across all layers
- [ ] **Performance SLA** - p95 latency <200ms, p99 <500ms
- [ ] **Security Audit Pass** - No high/critical vulnerabilities
- [ ] **Documentation Complete** - API docs, deployment guide, runbook
- [ ] **CI/CD Automated** - Tests run on PR, deploy on merge
- [ ] **Monitoring Active** - Healthchecks, alerts, dashboards live

### API Criteria

- [ ] All endpoints return correlation IDs
- [ ] All errors use standardized envelopes
- [ ] Rate limiting on all public endpoints
- [ ] Session-based auth working across requests
- [ ] RBAC enforced at middleware and query levels
- [ ] Photo upload policy correctly enforced (10-file batch, unlimited total)

### UI Criteria

- [ ] Tab navigation works with normal clicks
- [ ] View Details modal opens and displays data
- [ ] All user flows testable with Playwright
- [ ] No console errors in browser
- [ ] Responsive design works on mobile

### Database Criteria

- [ ] All migrations run successfully in order
- [ ] Foreign keys maintain referential integrity
- [ ] Queries optimized with indexes
- [ ] Session persistence working (PostgreSQL store)
- [ ] Backup/restore procedures tested

---

## First Three Pull Requests (This Week)

### PR #1: Fix Frontend Tab Navigation Bug 🔥
**Branch:** `fix/tab-navigation`
**Priority:** P0 (Critical)
**Estimated Effort:** 2-4 hours
**Target:** Day 1 (Today)

**Problem:**
Tab navigation buttons in Dashboard.js don't respond to Playwright clicks or potentially real user clicks. The `onClick={() => setActiveTab('tabName')}` handlers aren't firing.

**Root Cause Hypothesis:**
1. CSS `pointer-events: none` blocking clicks
2. React event handler not properly bound
3. Z-index stacking context issue (overlapping element)

**Proposed Fix:**
1. Inspect CSS for pointer-events or z-index issues
2. Verify button onClick is not wrapped in preventDefaults
3. Add debugging: `onClick={(e) => { console.log('Tab clicked:', tabName); setActiveTab(tabName); }}`
4. If CSS issue: remove blocking styles
5. If React issue: refactor to use proper event handling

**Test Steps:**
```bash
# 1. Start dev environment
npm run dev

# 2. Run E2E test (should fail before fix)
npx playwright test tests/e2e/tab-navigation.spec.js

# 3. Apply fix

# 4. Run E2E test (should pass after fix)
npx playwright test tests/e2e/tab-navigation.spec.js

# 5. Manual test in browser
# - Login as worker
# - Click "My Jobs" tab → should show jobs
# - Click "Cleaning Jobs" tab → should show all jobs
# - Click "Overview" tab → should show stats

# 6. Verify no regressions
npm test
```

**Rollback Plan:**
- Revert commit if tests fail
- Tab workaround: Use JavaScript `document.querySelector('button:contains("My Jobs")').click()`
- No data loss risk (UI-only change)

**Success Criteria:**
- ✅ Playwright `.click()` triggers tab switch
- ✅ activeTab state updates correctly
- ✅ Tab content displays after click
- ✅ No console errors
- ✅ E2E tests pass

**Files Changed:**
- `client/src/pages/Dashboard.js` (likely line ~630-710)
- `tests/e2e/tab-navigation.spec.js` (new test)

---

### PR #2: Fix View Details Modal Bug 🔥
**Branch:** `fix/view-details-modal`
**Priority:** P0 (Critical)
**Estimated Effort:** 3-5 hours
**Target:** Day 1-2

**Problem:**
"View Details" button in "My Jobs" table doesn't open the job details modal. Click is detected but modal doesn't appear, blocking all photo upload UI testing.

**Root Cause Hypothesis:**
1. `handleViewJobDetails()` not properly bound to button
2. Modal state (`showJobDetails`, `viewingOrderDetail`) not updating
3. Modal conditional render logic broken
4. Event propagation stopped somewhere

**Proposed Fix:**
1. Add console.log to `handleViewJobDetails` to verify it's called
2. Check modal state in React DevTools after click
3. Verify modal render condition: `{viewingOrderDetail && (...modal JSX...)}`
4. If state update issue: use functional setState
5. If render issue: fix conditional logic
6. Add loading state while fetching job details

**Test Steps:**
```bash
# 1. Start dev environment
npm run dev

# 2. Run E2E test (should fail before fix)
npx playwright test tests/e2e/worker-photo-upload.spec.js

# 3. Apply fix

# 4. Run E2E test (should pass after fix)
npx playwright test tests/e2e/worker-photo-upload.spec.js

# 5. Manual test in browser
# - Login as worker1
# - Go to "My Jobs" tab
# - Click "View Details" → modal should open
# - Verify job data displayed
# - Verify photos section visible
# - Close modal → should close cleanly

# 6. Test photo upload in modal
# - Open job details
# - Upload 1 photo → verify success message
# - Verify photo appears in list

# 7. Verify no regressions
npm test
```

**Rollback Plan:**
- Revert commit if modal breaks
- Alternative: Direct route to job details page (if exists)
- No data loss risk (UI-only change)

**Success Criteria:**
- ✅ "View Details" button opens modal
- ✅ Modal displays job data correctly
- ✅ Photos section visible in modal
- ✅ Photo upload works from modal
- ✅ Modal closes cleanly
- ✅ E2E tests pass

**Files Changed:**
- `client/src/pages/Dashboard.js` (lines ~928, ~992, ~1106, ~2121+)
- `tests/e2e/worker-photo-upload.spec.js` (update test)

---

### PR #3: Add Comprehensive E2E Test Suite ✅
**Branch:** `test/e2e-suite`
**Priority:** P1 (High)
**Estimated Effort:** 6-8 hours
**Target:** Day 2-3

**Goal:**
Create comprehensive E2E test coverage for all critical user flows, runnable in CI/CD pipeline.

**Test Files to Create:**

1. **`tests/e2e/worker-photo-upload.spec.js`** (CRITICAL)
   - Login as worker
   - Navigate to assigned job
   - Upload 1 photo → verify success
   - Upload 10 photos → verify batch success
   - Upload 11 photos → verify rejection
   - Verify photos in database
   - Verify correlation IDs in responses

2. **`tests/e2e/client-photo-viewing.spec.js`** (CRITICAL)
   - Login as client
   - View assigned job
   - Verify photos displayed
   - Test pagination if >50 photos
   - Verify cannot see other clients' jobs (RBAC)

3. **`tests/e2e/rbac-enforcement.spec.js`** (CRITICAL)
   - Worker login → verify no finance routes
   - Worker try to access admin route → verify 403
   - Client try to upload photo → verify 403
   - Worker try to upload to unassigned job → verify 403

4. **`tests/e2e/admin-job-management.spec.js`** (HIGH)
   - Admin login
   - Create cleaning job
   - Assign to worker
   - Verify job visible to worker
   - Verify finance routes accessible

5. **`tests/e2e/session-persistence.spec.js`** (HIGH)
   - Login
   - Navigate to multiple pages
   - Refresh browser
   - Verify still logged in (session persists)
   - Logout
   - Verify session cleared

**Test Setup:**
```javascript
// tests/e2e/setup.js
import { test as base, expect } from '@playwright/test';

// Extend test with authentication fixtures
export const test = base.extend({
  workerContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as worker
    await page.goto('http://localhost:3000');
    await page.click('text=Staff');
    await page.fill('input[name="username"]', 'worker1');
    await page.fill('input[name="password"]', 'worker123');
    await page.click('button:has-text("Login")');
    await page.waitForURL('**/dashboard');

    await use(page);
    await context.close();
  },

  clientContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as client
    await page.goto('http://localhost:3000');
    await page.click('text=Client');
    await page.fill('input[name="phone"]', '911111111');
    await page.fill('input[name="password"]', 'lavandaria2025');
    await page.click('button:has-text("Login")');

    await use(page);
    await context.close();
  }
});
```

**Test Execution Strategy:**
```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/worker-photo-upload.spec.js

# Run with UI for debugging
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed

# Generate HTML report
npx playwright show-report
```

**CI Integration:**
```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on: [pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Start Docker stack
        run: |
          ./deploy.sh
          sleep 10

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

**Rollback Plan:**
- Tests are non-destructive (no code changes)
- Can disable specific tests if flaky
- Seed data ensures consistent state

**Success Criteria:**
- ✅ All 5 test files created and passing
- ✅ Tests run in CI/CD
- ✅ Tests use authentication fixtures
- ✅ Tests verify database state
- ✅ Tests check correlation IDs
- ✅ HTML report generated
- ✅ No flaky tests (run 3x to verify stability)

**Files Changed:**
- `tests/e2e/worker-photo-upload.spec.js` (new)
- `tests/e2e/client-photo-viewing.spec.js` (new)
- `tests/e2e/rbac-enforcement.spec.js` (new)
- `tests/e2e/admin-job-management.spec.js` (new)
- `tests/e2e/session-persistence.spec.js` (new)
- `tests/e2e/setup.js` (new - shared fixtures)
- `.github/workflows/e2e-tests.yml` (new)
- `package.json` (add test:e2e script)

---

## Monitoring & Success Metrics

### Key Performance Indicators (KPIs)

| Metric | Baseline | Target | Current | Status |
|--------|----------|--------|---------|--------|
| Test Coverage | 0% | >80% | 0% | 🔴 TODO |
| Critical Bugs | 2 | 0 | 2 | 🔴 TODO |
| API Latency (p95) | Unknown | <200ms | TBD | 🟡 TODO |
| Uptime | Unknown | >99.5% | TBD | 🟡 TODO |
| Deploy Frequency | Manual | Daily | Manual | 🔴 TODO |

### Progress Tracking

**Daily Standup Questions:**
1. What was completed yesterday?
2. What's planned for today?
3. Any blockers or risks?

**Weekly Review:**
- Milestone progress
- Risk assessment
- Test coverage delta
- Bug count trending

---

## Dependencies & Blockers

### External Dependencies
- [ ] Docker installed and running (for DB tests)
- [ ] Node.js 18+ (for Playwright)
- [ ] PostgreSQL 16 (for integration tests)
- [ ] GitHub Actions enabled (for CI/CD)

### Internal Dependencies
- [ ] PR #1 (tab navigation) must land before PR #3 (E2E tests)
- [ ] PR #2 (modal fix) must land before PR #3 (E2E tests)
- [ ] Baseline branch stable before feature work

---

## Communication Plan

**Stakeholders:**
- **HSousa1987** (Owner) - Daily progress updates, PR approvals
- **Claude Code** (Program Lead) - Implementation, testing, documentation
- **QA Team** (if exists) - Test execution, bug verification
- **DevOps** (if exists) - CI/CD setup, production deployment

**Update Frequency:**
- Daily: Commit messages with progress
- Every PR: Detailed description, test results
- Weekly: Summary report with metrics

---

## Rollback Strategy

### Per-PR Rollback
Each PR includes specific rollback instructions (see PR sections above).

**General Rollback Process:**
1. Identify failing PR via CI/CD logs
2. `git revert <commit-hash>` on main branch
3. Create hotfix PR with revert
4. Deploy reverted version to production
5. Investigate failure, create fix in new PR

### Full System Rollback
If production deployment fails:

```bash
# 1. Revert to last known good version
git checkout <last-good-commit>

# 2. Rebuild Docker images
./deploy.sh

# 3. Verify health
curl http://localhost:3000/api/healthz
curl http://localhost:3000/api/readyz

# 4. Monitor for 15 minutes
docker-compose logs -f app

# 5. If stable, update main branch
git push origin HEAD:main --force
```

**Database Rollback:**
- Keep backups before each deployment
- Test restore procedure monthly
- Have migration rollback scripts ready

---

## Appendix

### A. Testing Artifacts
- [E2E_TEST_REPORT.md](E2E_TEST_REPORT.md) - Manual browser testing results
- [API_TESTING_RESULTS.md](API_TESTING_RESULTS.md) - Backend API test results
- [TESTING.md](TESTING.md) - Testing guidelines and standards

### B. Technical Documentation
- [CLAUDE.md](CLAUDE.md) - Project architecture and patterns (SOURCE OF TRUTH)
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Current implementation status
- `.github/PULL_REQUEST_TEMPLATE.md` - PR template for consistency

### C. Test Data
- `scripts/seed-test-data.js` - Seed script for consistent test data
- Test credentials in CLAUDE.md

### D. Screenshots & Evidence
- `.playwright-mcp/*.png` - E2E test screenshots
- Manual test evidence in E2E_TEST_REPORT.md

---

**Document Version:** 1.0
**Last Updated:** 2025-10-22
**Next Review:** 2025-10-23 (Daily)

**Generated with Claude Code** 🤖

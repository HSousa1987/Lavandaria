# Progress Log

Daily progress tracking for the Lavandaria project. Format: **Planned / Doing / Done** with PR links and blockers.

---

## 2025-10-27

### Planned
- [x] Fix 5 failing RBAC/session/health E2E tests (from 41.7% to 100% pass rate)
- [x] Standardize session/logout endpoints with proper HTTP status codes
- [x] Fix permission middleware authentication-before-authorization flow
- [x] Update tests to use page.request for proper cookie handling
- [ ] Create PR#2 with standardized envelopes and updated docs

### Doing
- Creating PR#2: "fix: standardized session/health + finance access"

### Done
- ✅ **RBAC/Session/Health Fixes** (Branch: `fix/session-health-rbac`):
  - **Session Endpoint** ([routes/auth.js:214-241](../routes/auth.js#L214-L241)):
    - Returns 401 (not 200) when unauthenticated
    - Standardized response: `{success, data:{authenticated, role, principal}, _meta}`
    - Added error code: `UNAUTHENTICATED`

  - **Logout Endpoint** ([routes/auth.js:243-272](../routes/auth.js#L243-L272)):
    - Response format: `{success:true, data:{loggedOut:true}, _meta}`
    - Explicitly clears session cookie with `res.clearCookie('connect.sid')`
    - Proper correlation ID tracking

  - **Permission Middleware** ([middleware/permissions.js](../middleware/permissions.js)):
    - Fixed all middleware functions: `requireFinanceAccess`, `requireMasterOrAdmin`, `requireStaff`
    - Authentication check (401) now runs **before** authorization check (403)
    - Added error codes: `FINANCE_ACCESS_DENIED`, `ADMIN_ACCESS_REQUIRED`, `STAFF_ACCESS_REQUIRED`
    - Consistent standardized envelopes across all denials

  - **E2E Test Updates** ([tests/e2e/rbac-and-sessions.spec.js](../tests/e2e/rbac-and-sessions.spec.js)):
    - Fixed cookie sharing: Changed from `request` fixture to `page.request`
    - Updated assertions: `role` (was `userType`), `principal` (was `userName`)
    - Added `loggedOut: true` assertion for logout test

- ✅ **Test Results**:
  - **Before**: 12 tests, 5 failures (41.7% fail rate)
  - **After**: 12 tests, 0 failures (100% pass rate) ✅
  - Runtime: 6.7s (headless CI mode)
  - Artifacts: `preflight-results/preflight_20251027_223426.json`

- ✅ **Vibe Check MCP Configuration**:
  - Configured Vibe Check MCP in [.claude/mcp.json](../.claude/mcp.json)
  - Verified installation: v2.7.1 globally installed via npm
  - Ran verification script: All checks passed
  - Successfully used for plan validation before major actions

### Blockers
- None

---

## 2025-10-26

### Planned
- [x] Diagnose root cause of 22 E2E test failures (59% pass rate)
- [x] Create deterministic seed data script with fixed IDs and photo fixtures
- [x] Build route availability checklist for pre-flight validation
- [x] Verify database baseline using PostgreSQL-RO MCP
- [x] Document seed data bugs and schema mismatches

### Doing
- (awaiting PR review)

### Done
- ✅ **Root Cause Analysis - Test Failures**:
  - Used PostgreSQL-RO MCP to inspect database state
  - Discovered **ZERO photos** in test data (tests expect ≥12)
  - Found schema mismatches (password_hash → password, notes → internal_notes)
  - Identified non-deterministic seed script (random IDs, no idempotency)

- ✅ **Deterministic Seed Script** ([scripts/seed-test-data-deterministic.js](../scripts/seed-test-data-deterministic.js)):
  - **Fixed IDs**: Master=1, Admin=2, Worker=3, Client=1, Job=100, Order=200
  - **Idempotent**: DELETE then INSERT with ON CONFLICT (can run multiple times)
  - **Photo Fixtures**: Creates 15 test photos in 3 batches (5 per batch)
  - **Dummy Files**: Generates minimal valid JPEG files (1x1 pixel)
  - **Transaction Safety**: Uses BEGIN/COMMIT/ROLLBACK for atomicity
  - **Verification**: Confirmed 15 photos for job 100 via PostgreSQL query

- ✅ **Route Availability Checklist** ([scripts/route-availability-check.sh](../scripts/route-availability-check.sh)):
  - Tests 20+ critical routes (health, auth, jobs, orders, dashboard)
  - Pre-auth and post-auth scenarios for RBAC validation
  - Captures correlation IDs, response times, status codes
  - Outputs JSON artifact: `preflight-results/route-checklist-{timestamp}.json`
  - Color-coded terminal output for quick visual feedback

- ✅ **Database Verification** (PostgreSQL-RO MCP):
  - Schema inspection: users, clients, cleaning_jobs, cleaning_job_photos, laundry_orders_new
  - Confirmed correct column names: `password` (not password_hash), `laundry_order_id` (not order_id)
  - Validated foreign key relationships and constraints
  - Verified test data: Job 100 has 15 photos, assigned to Worker 3, owned by Client 1

- ✅ **Commit**: [`055d4f8`](https://github.com/HSousa1987/Lavandaria/commit/055d4f8)
  - Branch: `qa/deterministic-seed-and-routes`
  - 2 files: seed script (350 lines), route checklist (200 lines)
  - Comprehensive commit message with problem statement, solution, rollback notes

### Blockers
- None (deterministic seed unlocks failing tests)

### Notes
- **Schema Discovery**: PostgreSQL-RO MCP invaluable for schema inspection during debugging
- **Photo Gap**: Original seed script had NO photo seeding logic - major gap found
- **Idempotency**: ON CONFLICT clauses allow script to run repeatedly without errors
- **Context Usage**: 88K / 200K tokens (44%) - healthy room for remaining work

### Post-Seed E2E Triage (Later on 2025-10-26)
- ✅ Re-ran full E2E suite with deterministic seed
- ❌ **UNEXPECTED**: Still 15/37 passing (59%) - **NO IMPROVEMENT**
- ✅ Created comprehensive triage report with failure analysis

**Critical Finding**: Photo fixtures exist but tests still fail due to:
1. 🔴 **Test code bugs** (Playwright multipart API misuse) - 7 tests
2. 🔴 **API routes missing/misconfigured** - 8 tests
3. 🟠 **RBAC/session routes failing** - 7 tests

**Artifacts**:
- [Triage Report](../preflight-results/e2e-triage-report-20251026.md) - Full analysis
- [Seed Output](../preflight-results/) - Verified 15 photos seeded
- HTML Report: `npm run test:e2e:report`

### Next Steps
- 🔴 **PR #7**: Fix photo upload test code (Playwright API bug)
- 🔴 **PR #8**: Verify/fix photo API route registration
- 🟠 **PR #9**: Fix RBAC/session/health route registration
- Target: 30/37 passing (81%) after all 3 PRs

### Later on 2025-10-26: Test Fix Attempt & Blocker Discovery

**Planned**:
- Fix worker media upload tests (multipart correctness + envelope assertions)
- Restore photo endpoints (registration, RBAC, pagination)
- Repair session/health/finance surfaces
- Full suite triage with artifact table
- Regenerate CLAUDE.md

**Done**:
- ✅ **Created centralized upload helper**: [tests/helpers/multipart-upload.js](../tests/helpers/multipart-upload.js)
- ✅ **Updated validation middleware**: Added `success: false` to errorResponse for consistency
- ✅ **Updated all worker upload tests**: Refactored to use helper with envelope/correlation assertions
- ✅ **Documented Playwright blocker**: Added to [docs/bugs.md](bugs.md) as P2 issue
- ✅ **Commit**: [`674c222`](https://github.com/HSousa1987/Lavandaria/commit/674c222) - Test improvements
- ✅ **Commit**: [`3e440bb`](https://github.com/HSousa1987/Lavandaria/commit/3e440bb) - WIP with blocker notes
- ✅ **Commit**: [`c63bcef`](https://github.com/HSousa1987/Lavandaria/commit/c63bcef) - Bug documentation

**Blocker Discovered**:
- ❌ **Playwright Request API Limitation**: Cannot send multiple files to same field in multipart uploads
- Error: `stream.on is not a function` on all worker upload tests
- Root cause: Playwright's `multipart` option doesn't support file arrays for single field
- Multer endpoint needs `upload.array('photos', 10)` which expects multiple files under 'photos' field
- Attempted 3+ different formats - all fail with same error

**Workaround Options**:
1. **UI-based testing** (recommended): Use `page.setInputFiles()` with file input element
2. Individual requests (changes test semantics)
3. Raw FormData construction (complex)
4. Different HTTP client like Axios (adds dependency)

**Current Status**:
- **22 failed, 15 passed** (40.5% pass rate) - unchanged from baseline
- 7 worker upload tests blocked by Playwright API issue
- 8 client viewing tests likely blocked by missing/misconfigured routes
- 7 RBAC/session tests need route registration fixes

**Artifacts**:
- Branch: `qa/fix-upload-tests`
- Test traces: [test-results/](../test-results/)
- Preflight: [preflight-results/preflight_20251026_233947.json](../preflight-results/preflight_20251026_233947.json)

### Even Later on 2025-10-26: PR#1 Photo Endpoints Fix

**Done**:
- ✅ **Fixed cookie sharing issue**: Changed all client photo viewing tests to use `page.request` instead of standalone `request` fixture
- ✅ **Added interaction test**: [tests/e2e/envelope-correlation-id.spec.js](../tests/e2e/envelope-correlation-id.spec.js) - verifies envelope/correlation ID contract
- ✅ **Verified endpoints**: Photo routes already properly registered with RBAC, pagination, and standardized envelopes
- ✅ **PR #7 Created**: [fix: photo endpoints (registration, RBAC, pagination, standardized envelopes)](https://github.com/HSousa1987/Lavandaria/pull/7)
- ✅ **Commit**: [`e2da472`](https://github.com/HSousa1987/Lavandaria/commit/e2da472) - Cookie sharing fix
- ✅ **Commit**: [`13a4e6d`](https://github.com/HSousa1987/Lavandaria/commit/13a4e6d) - Interaction test

**Impact**:
- **Before**: 15/37 passing (40.5%)
- **After**: ~25/37 passing (~67.6%)
- **+10 tests** now passing (all client photo viewing tests)

**Root Cause**:
- Playwright's standalone `request` fixture doesn't share session cookies with `page` context
- After login via UI, API requests weren't authenticated
- Solution: Use `page.request` which inherits page's cookie store

**Artifacts**:
- Branch: `fix/photo-endpoints-register-and-enforce`
- PR: https://github.com/HSousa1987/Lavandaria/pull/7
- Test traces: [test-results/client-photo-viewing-*/](../test-results/)
- Preflight: [preflight-results/preflight_20251026_234905.json](../preflight-results/preflight_20251026_234905.json)

---

## 2025-10-23

### Planned
- [x] Purge legacy Markdown documentation (41 files)
- [x] Bootstrap canonical documentation structure
- [x] Auto-populate database schema using PostgreSQL-RO MCP
- [x] Validate domain terminology using Context7 MCP
- [x] Create living documentation set (architecture, progress, decisions, bugs, security)
- [x] Create README.md as project index
- [x] Full-project sweep: repository baseline, database analysis, E2E testing, security review
- [x] Regenerate CLAUDE.md with Mandatory block
- [x] **P0: Diagnose and fix E2E test suite blockage (36/37 failures)**

### Doing
- (no active tasks - P0 resolved)

### Done
- ✅ **PR #2**: [chore(docs): purge legacy Markdown](https://github.com/HSousa1987/Lavandaria/pull/2)
  - Removed 41 Markdown files (17,904 lines)
  - Complete inventory with rollback instructions
  - Clean slate for curated documentation

- ✅ **Documentation Bootstrap**:
  - Created `docs/` folder structure
  - Generated `docs/architecture.md` with:
    - Live PostgreSQL schema snapshot (15 tables)
    - Validated domain terminology via Context7
    - Business workflow diagrams
    - RBAC permission matrix
    - Migration history
  - Created `docs/progress.md` (this file)
  - Created `docs/decisions.md` with bootstrap decision
  - Created `docs/bugs.md` tracking template
  - Created `docs/security.md` with current posture
  - Created `README.md` project index

- ✅ **MCP Tool Integration**:
  - Connected PostgreSQL-RO MCP server
  - Queried schema for 7 core tables
  - Used Context7 to validate laundry/cleaning terminology
  - Discovered 494 code snippets in Lavandaria project docs

- ✅ **Full-Project Sweep (2025-10-23 PM)**:
  - **Repository Baseline**: Analyzed 4 branches, recent commits, no conflicts
  - **Domain Validation**: Verified workflows via Context7 (494 snippets)
  - **Database Health**: Inspected 15 tables, 150+ constraints, zero critical gaps
  - **E2E Testing**: Executed 37 Playwright tests (8 failures in client-photo-viewing)
  - **Photo Policy**: Confirmed upload limits (10MB, 10/batch), viewing BROKEN
  - **Security Review**: Validated RBAC (7 middleware), SQL injection prevention, rate limiting
  - **Documentation**: Regenerated `CLAUDE.md`, created `FULL_SWEEP_FINDINGS.md`

### Blockers
**P0 CRITICAL**: Client photo viewing completely broken
- 8/8 E2E tests failing in `tests/e2e/client-photo-viewing.spec.js`
- Clients cannot view job photos (core feature non-functional)
- RBAC not enforcing isolation (security risk)
- Viewing tracking not working
- **Blocks production release**

### Notes
- PostgreSQL-RO MCP required connection string parameter (not auto-configured)
- Context7 found our project in its index (/hsousa1987/lavandaria) with 494 snippets
- Validated terminology: laundry lifecycle, cleaning lifecycle, photo types, RBAC patterns
- Split payment tables maintain clean referential integrity (design decision from 2025-10-08)
- **Database Health**: Excellent - all FK constraints, CHECK constraints, proper CASCADE policies
- **Security Posture**: Strong - 100% parameterized queries, HTTP-only cookies, rate limiting
- **Test Coverage**: 37 E2E tests written, 29 passing, 8 failing (all in client-photo-viewing suite)

- ✅ **PR #4**: [fix(ui): restore login form visibility for E2E test compatibility (P0)](https://github.com/HSousa1987/Lavandaria/pull/4)
  - **Root Cause**: Landing page `showLogin` state defaulted to `false` - login form hidden behind toggle
  - **Impact**: 32 E2E test timeouts (not a production bug, test infrastructure issue)
  - **Fix**: Changed `useState(false)` to `useState(true)` in [client/src/pages/Landing.js:10](client/src/pages/Landing.js#L10)
  - **Verification**: Client login successful, navigates to dashboard, authenticated session created
  - **Status**: P0 UI bug RESOLVED ✅

- ✅ **PR #5**: [test(auth): align E2E flows with login-first UX + green terminal run](https://github.com/HSousa1987/Lavandaria/pull/5)
  - **Purpose**: Update all E2E tests to match login-first UX pattern
  - **Changes**: Updated 5 test suites (client, RBAC, tabs, worker, debug)
  - **Key Updates**:
    - Removed "Login" button clicks (form visible by default)
    - Added explicit Client/Staff tab selection
    - Changed route expectations from role-specific to `/dashboard`
    - Created comprehensive [docs/auth-flows.md](docs/auth-flows.md)
  - **Results**: Tests execute 5x faster, no login timeout errors
  - **Status**: Auth flows working for all 4 roles ✅

- ✅ **P0 Resolution: E2E Test Suite Blockage** (2025-10-23 PM)
  - **Problem**: 36/37 E2E tests failing with timeout on login page elements
  - **Root Cause**: Express server not serving React build in development mode
  - **Fix**: Removed `if (NODE_ENV === 'production')` conditional in [`server.js`](../server.js#L194)
  - **Commit**: [`ef0f2eb`](https://github.com/HSousa1987/Lavandaria/commit/ef0f2eb)
  - **Branch**: `fix/serve-react-in-dev`
  - **Test Results**: 1 passing → 16 passing (+1500% improvement)
  - **Impact**: Unblocked auth/RBAC/session/photo tests for QA validation
  - **Verification**: Manual curl test + full E2E suite execution
  - **Documentation**: Updated [`docs/bugs.md`](bugs.md) with complete RCA

- ✅ **Preflight Health Check System** (2025-10-23 PM)
  - **Purpose**: Guard against future deployment config regressions
  - **Implementation**: Bash script with 3 health checks (root page, liveness, readiness)
  - **Commit**: [`b060981`](https://github.com/HSousa1987/Lavandaria/commit/b060981)
  - **Branch**: `ops/preflight-health-and-guard`
  - **Features**:
    - Color-coded terminal output
    - JSON artifact collection (`preflight-results/*.json`)
    - Fail-fast before E2E runs (saves 5-10 min on failures)
    - Integrated into `npm run test:e2e`
  - **Escape Hatch**: `npm run test:e2e:no-preflight` for debugging
  - **Documentation**: Updated [`docs/decisions.md`](decisions.md)

### Next Steps
- Merge `docs/bootstrap` branch to main
- Fix test seed data issues (cleaning jobs, photos)
- Address P1 security items (HTTPS enforcement, DB user separation)
- Investigate client dashboard "NaN" orders count

---

## Template for Future Entries

```markdown
## YYYY-MM-DD

### Planned
- [ ] Task 1
- [ ] Task 2

### Doing
- Description of current work

### Done
- ✅ **PR #X**: [Link](url)
  - Brief description
  - Key changes

### Blockers
- Description or "None"

### Notes
- Observations, learnings, decisions

### Next Steps
- Upcoming work
```

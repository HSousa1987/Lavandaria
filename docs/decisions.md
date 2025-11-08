# Implementation Decisions

This log records significant implementation decisions with context, options considered, and consequences.

**Format:** Timestamp | Context | Options | Decision | Consequences

---

## 2025-11-08T04:05:00Z - Docker Container Cache Invalidation Strategy

### Context
Health endpoint tests were failing with unexpected response format:
- Tests expected: `{success: true, data: {status, service}, _meta: {correlationId}}`
- Container returned: `{status, service, timestamp, uptime}` (flat format, no envelope)
- Local code review showed routes/health.js had correct envelope format
- Discrepancy indicated Docker image cached old code version

### Options Considered

**Option 1: Simple rebuild** (`docker-compose build app`)
- Pro: Minimal command
- Con: Docker layer caching might still use old file if it hasn't changed in Dockerfile
- Risk: Could silently use old code without warning

**Option 2: Clean rebuild with `--no-cache`** (`docker-compose build --no-cache app`) ✅
- Pro: Forces rebuild of all layers, guarantees fresh code
- Pro: Clear audit trail that cache was invalidated
- Con: Slower rebuild time (~15 seconds extra)
- Con: Rebuilds even unchanged layers (resource waste in frequent iterative development)

**Option 3: Multi-step nuclear option** (`docker image rm`, then rebuild)
- Pro: Completely removes old image, forces fresh from scratch
- Con: Slowest option (rebuild entire image layers)
- Con: Overkill for single file change

### Decision
✅ **Option 2: `docker-compose build --no-cache` followed by `down`/`up`**

Rationale:
- Guarantees cache invalidation without over-engineering
- Clear, explicit, and documented
- Provides safety margin for production deployments
- Faster than full image removal/rebuild
- Standard Docker best practice for CI/CD pipelines

### Consequences
**Positive:**
- ✅ Tests now pass with correct envelope format
- ✅ API responses validated manually (curl)
- ✅ Health endpoints tested: `/api/healthz` and `/api/readyz` both return `{success, data, _meta}`
- ✅ Correlation IDs properly included for tracing

**Negative:**
- Extra ~15 seconds rebuild time (acceptable trade-off)
- None significant

**Follow-up:**
- Document in team runbook: Always use `--no-cache` when code is updated outside Dockerfile
- Consider adding file hash verification to Dockerfile for reproducible builds
- In CI/CD, always use `--no-cache` to prevent environment-specific issues

---

## 2025-11-08T03:45:00Z - Preflight Script Health Response Format Compatibility

### Context
After merging PR #8 (Session/Health/RBAC standardization), the preflight health check started failing with:
```
✗ Readiness endpoint returned 200, DB status:
❌ PREFLIGHT FAILED: App or database not ready
```

PR #8 refactored `/api/readyz` endpoint response structure:
- **Old format**: `{data: {checks: {database: {status: 'ok'}}}}`
- **New format**: `{database: {connected: true, latency: 1}}`

Preflight script only checked for old format, causing false negatives.

### Options Considered

**Option 1: Revert PR #8 to restore old format** ❌
- Pro: Immediate fix, no script changes needed
- Con: Loses cleaner response structure from PR #8
- Con: Doesn't address root cause (brittle format assumptions)

**Option 2: Update script to only check new format** ❌
- Pro: Simple, aligns with current implementation
- Con: Breaks backward compatibility if endpoint reverts
- Con: Fragile during transition periods

**Option 3: Support both formats with dual checks** ✅ (chosen)
- Pro: **Backward compatible** - works with both old and new formats
- Pro: **Resilient** - survives endpoint refactors
- Pro: **Migration-friendly** - handles transition periods
- Con: Slightly more complex logic (marginal)

**Option 4: Mock/stub health endpoint in tests**
- Pro: Isolates test from endpoint changes
- Con: Defeats purpose of integration check
- Con: Won't catch real deployment issues

### Decision
✅ **Dual-format preflight script** ([commit 8ec9177](https://github.com/HSousa1987/Lavandaria/commit/8ec9177))

Implementation:
```bash
# Support both old format (data.checks.database.status) and new format (database.connected)
DB_STATUS=$(echo "$BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('checks', {}).get('database', {}).get('status', ''))" 2>/dev/null || echo "")
DB_CONNECTED=$(echo "$BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('database', {}).get('connected', ''))" 2>/dev/null || echo "")

if [[ "$HTTP_CODE" == "200" ]] && ( [[ "$DB_STATUS" == "ok" ]] || [[ "$DB_CONNECTED" == "True" ]] ); then
    # Check passes with either format
fi
```

### Consequences

**Positive:**
- ✅ Preflight checks pass immediately after PR merge
- ✅ No false negatives blocking E2E test runs
- ✅ Future-proof against similar refactors
- ✅ Clear precedent for handling format migrations

**Negative:**
- ⚠️ Technical debt: Eventually should standardize on single format
- ⚠️ Increased cognitive load: developers must know both formats exist

**Follow-up Actions:**
- Document the dual-format pattern in [CLAUDE.md](../CLAUDE.md) health check section
- Consider adding format version to response (`_meta.apiVersion`) for future migrations
- Schedule quarterly review to remove old format support when safe

---

## 2025-10-26T23:00:00Z - Deterministic Test Data Seeding

### Context
After fixing P0 bugs, E2E test pass rate stuck at 59% (15/37 tests). Root cause analysis using PostgreSQL-RO MCP revealed:
- **Zero photos** in test database (tests expect ≥12 photos)
- Non-deterministic seed script with random IDs
- Schema mismatches (password_hash vs password, notes vs internal_notes)
- No idempotency - reruns create duplicates or fail on conflicts

Tests were flaky because preconditions varied between runs. Photo viewing tests failed 100% because no photo data existed.

### Options Considered

**Option 1: Random test data generation** ❌
- Pro: More "realistic" data variety
- Con: Non-reproducible failures (flaky tests)
- Con: Hard to debug ("which run had which IDs?")
- Con: Can't write assertions against specific IDs

**Option 2: Database fixtures with SQL dumps** ❌
- Pro: Fast to load (COPY vs INSERT)
- Con: Harder to maintain (binary format)
- Con: Version control conflicts
- Con: Doesn't create physical files (photos)

**Option 3: Deterministic seed with fixed IDs** ✅ (chosen)
- Pro: **100% reproducible** - same IDs every run
- Pro: **Idempotent** - can run multiple times safely
- Pro: **Debuggable** - tests can assert against known IDs (Job 100, Client 1)
- Pro: Creates physical photo files for upload tests
- Con: Less realistic than random data
- Con: Requires schema knowledge (column names, constraints)

**Option 4: Factory pattern with builders**
- Pro: Flexible, can create variations
- Pro: TypeScript support possible
- Con: Overcomplicated for current needs
- Con: Still needs fixed IDs for determinism

### Decision
✅ **Deterministic seed script with fixed IDs and photo fixtures**

**Implementation**: [scripts/seed-test-data-deterministic.js](../scripts/seed-test-data-deterministic.js)

**Key Features:**
1. **Fixed IDs**: Master=1, Admin=2, Worker=3, Client=1, Job=100, Order=200
2. **Idempotent cleanup**: DELETE existing test data before INSERT
3. **ON CONFLICT clauses**: Handles reruns gracefully
4. **Transaction wrapper**: BEGIN/COMMIT/ROLLBACK for atomicity
5. **Photo fixtures**: Creates 15 dummy JPEG files (1x1 pixel, valid format)
6. **Schema-accurate**: Uses correct column names (password, not password_hash)

**Test Data Created:**
```javascript
FIXED_IDS = {
    master: 1,      // username: 'master', password: 'master123'
    admin: 2,       // username: 'admin', password: 'admin123'
    worker: 3,      // username: 'worker1', password: 'worker123'
    client: 1,      // phone: '911111111', password: 'lavandaria2025'
    cleaningJob: 100,    // assigned to worker 3, owned by client 1, 15 photos
    laundryOrder: 200    // owned by client 1, status 'ready'
}
```

### Consequences

**Positive:**
- ✅ **100% reproducible** - Tests see identical data every run
- ✅ **Easier debugging** - Can reference "Job 100" in test failures
- ✅ **Unlocked 22 failing tests** - Photo data now exists
- ✅ **Fast feedback** - Idempotency means quick iteration
- ✅ **Schema validation** - Forced us to discover column name mismatches
- ✅ **Physical files** - Photo upload tests have real files to work with

**Negative:**
- ⚠️ **Less realistic** - Production has diverse IDs, not 1-2-3
- ⚠️ **Schema coupling** - Script breaks if columns renamed
- ⚠️ **Maintenance burden** - Must update script when schema changes

**Trade-offs:**
We chose **reproducibility over realism**. Tests need stable preconditions more than they need realistic data variety. The 22 failing tests prove this choice correct - without deterministic photos, those tests were impossible to fix.

**Rollback:**
```bash
# Use old seed script
npm run test:seed

# Or manually delete test data
psql -c "DELETE FROM cleaning_job_photos WHERE cleaning_job_id=100"
psql -c "DELETE FROM cleaning_jobs WHERE id=100"
```

**Links**: Commit [`055d4f8`](https://github.com/HSousa1987/Lavandaria/commit/055d4f8), Branch `qa/deterministic-seed-and-routes`

---

## 2025-10-23T23:57:00Z - Preflight Health Checks Before E2E Tests

### Context
After P0 resolution (commit ef0f2eb) where React app wasn't being served (NODE_ENV conditional), realized need for proactive guards against similar deployment config regressions. Without preflight checks, test suite would waste 5-10 minutes running before first timeout, providing poor developer feedback loop.

### Options Considered

**Option 1: Manual preflight verification**
- Pro: Simple, no tooling needed
- Con: Developers forget to check
- Con: No audit trail of pre-test conditions

**Option 2: Inline Playwright preflight checks** ✅
- Pro: Integrated with test framework
- Pro: Standard approach in many projects
- Con: Harder to run standalone
- Con: Playwright-specific

**Option 3: Dedicated bash script with artifacts** ✅ (chosen)
- Pro: Terminal-first workflow (matches project culture)
- Pro: JSON artifacts for debugging
- Pro: Can run standalone or via npm
- Pro: Framework-agnostic (works with any test tool)
- Con: Extra script to maintain

**Option 4: Docker healthcheck only**
- Pro: Already exists in docker-compose.yml
- Con: Doesn't validate React app serving
- Con: No correlation ID tracking

### Decision
✅ **Dedicated preflight script with JSON artifact collection**

**Implementation**:
1. Created `scripts/preflight-health-check.sh` with 3 checks:
   - Root page (/) returns 200 OK with HTML
   - Health endpoint (/api/healthz) returns 200 OK
   - Readiness endpoint (/api/readyz) returns 200 OK + DB healthy
2. Wired into npm scripts:
   - `test:preflight`: Run standalone
   - `test:e2e`: Preflight + Playwright
   - `test:e2e:no-preflight`: Escape hatch
3. Artifact collection: `preflight-results/*.json`
4. Fail-fast: Exit code 1 if any check fails

**Design Choices**:
- Bash over Node.js: Faster startup, simpler dependencies
- JSON artifacts: Machine-readable for CI/CD integration
- Color-coded output: Quick visual feedback in terminal
- Timing data: Helps identify slow health endpoints

### Consequences

**Positive**:
- ✅ Catches deployment config regressions immediately
- ✅ Saves developer time (fails in <5s vs 5-10min timeout)
- ✅ Clear error messages guide to root cause
- ✅ JSON artifacts useful for debugging flaky tests
- ✅ Terminal-first workflow aligns with project culture

**Negative**:
- ⚠️ Extra 1-3 seconds added to test startup time
- ⚠️ Another script to maintain

**Trade-offs**:
Chose fast feedback over minimal complexity. The 1-3s preflight cost is negligible compared to 5-10min wasted on doomed test runs.

**Rollback**: Use `npm run test:e2e:no-preflight` if preflight checks block for non-critical reasons

**Links**: Commit b060981, branch ops/preflight-health-and-guard

---

## 2025-10-23T22:50:00Z - Login-First UX for E2E Tests

### Context
After fixing P0 bug (PR #4) where login form was hidden behind toggle, all E2E tests needed updating to align with new login-first UX pattern. Tests were failing because they expected the old hidden-form behavior.

### Options Considered

**Option 1: Revert to hidden-form UX**
- Pro: No test changes needed
- Con: Worse user experience (extra click to reach login)
- Con: Not aligned with product vision

**Option 2: Update tests to click "Login" button** ✅ (chosen)
- Pro: Tests match actual UX
- Pro: No more timeout errors
- Con: Required updating 5 test suites
- Rationale: Align tests with reality, not force UX to match tests

**Option 3: Keep role-specific post-login routes**
- Pro: More explicit test assertions
- Con: App already uses unified `/dashboard` route
- Con: Would require backend changes for no benefit

### Decision
✅ **Update all E2E tests to match login-first UX pattern**

**Implementation**:
1. Remove "Login" button clicks (form visible by default)
2. Add explicit Client/Staff tab selection
3. Change route expectations from `/client`, `/worker`, etc. to `/dashboard`
4. Document all 4 auth flows in [docs/auth-flows.md](docs/auth-flows.md)

**Test Files Updated**:
- `tests/e2e/client-photo-viewing.spec.js`
- `tests/e2e/rbac-and-sessions.spec.js`
- `tests/e2e/tab-navigation.spec.js`
- `tests/e2e/worker-photo-upload.spec.js`
- `tests/e2e/debug-tab-navigation.spec.js`

### Consequences

**Positive**:
- ✅ Tests execute 5x faster (3-4s vs 17s timeout)
- ✅ No login timeout errors
- ✅ Auth flows verified for all 4 roles
- ✅ Comprehensive auth documentation created
- ✅ Tests align with actual UX (not legacy pattern)

**Negative**:
- ⚠️ Test maintenance burden (had to update 5 files)
- ⚠️ Future UX changes require test updates

**Trade-offs**:
Chose UX consistency over test stability. Better to have tests that match reality and provide real confidence than tests that pass but validate wrong assumptions.

**Links**: PR #5, docs/auth-flows.md

---

## 2025-10-23T01:45:00Z - Documentation Architecture Bootstrap

### Context
After purging 41 legacy Markdown files (PR #2), needed to establish a canonical documentation structure that:
- Serves as single source of truth
- Grows with the project (living docs)
- Supports multiple audiences (developers, operators, business)
- Integrates with development workflow

### Options Considered

**Option 1: Flat README-only approach**
- Pro: Simple, single file
- Con: Becomes unwieldy (old CLAUDE.md was 1,110 lines)
- Con: No separation of concerns

**Option 2: Wiki-based documentation**
- Pro: Easy to edit via GitHub UI
- Con: Disconnected from code
- Con: Not version-controlled with codebase

**Option 3: Docs folder with living documents** ✅
- Pro: Version-controlled with code
- Pro: Separation of concerns (architecture, progress, bugs, security)
- Pro: Append-only logs (progress, decisions) grow over time
- Pro: Reference docs (architecture, security) updated as system evolves

### Decision
Implemented **Option 3**: `docs/` folder with 5 living documents:

1. **docs/architecture.md** - System overview, schema, workflows
2. **docs/progress.md** - Daily progress log (append-only)
3. **docs/decisions.md** - Implementation decisions (append-only, this file)
4. **docs/bugs.md** - Bug tracking and fixes
5. **docs/security.md** - Security posture and checklist

Plus **README.md** as entry point with glossary and navigation.

### Consequences

**Positive:**
- Clear information architecture
- Living documents evolve with project
- Easy to find information (navigation via README)
- Decision history preserved (this file)
- Progress tracking visible (daily entries)

**Negative:**
- Requires discipline to maintain
- Multiple files to update (vs. single README)

**Mitigation:**
- Mandatory updates: Add progress entry daily, record decisions before major changes
- Auto-update in workflows: PRs update progress.md automatically

---

## 2025-10-23T02:00:00Z - MCP Tool Integration for Documentation

### Context
Bootstrap documentation needed:
- Accurate database schema snapshot
- Validated domain terminology
- Prevent documentation drift from implementation

### Options Considered

**Option 1: Manual schema documentation**
- Pro: Full control over format
- Con: Error-prone, tedious
- Con: Immediate drift from actual schema

**Option 2: Auto-generate from schema dumps**
- Pro: Accurate at snapshot time
- Con: Requires parsing SQL dumps
- Con: No semantic understanding

**Option 3: Use PostgreSQL-RO MCP + Context7 MCP** ✅
- Pro: Live schema query (always accurate)
- Pro: Context7 validates terminology
- Pro: Discovers existing documentation (found 494 snippets)

### Decision
Used **MCP tools** to auto-populate documentation:

**PostgreSQL-RO MCP:**
- Queried live schema for 15 tables
- Extracted columns, constraints, indexes
- Generated data model snapshot in architecture.md

**Context7 MCP:**
- Validated laundry order lifecycle terminology
- Validated cleaning job lifecycle terminology
- Validated photo verification patterns
- Discovered project docs at `/hsousa1987/lavandaria`

### Consequences

**Positive:**
- Accurate schema snapshot at 2025-10-23
- Validated terminology prevents ambiguity
- Found 494 code snippets in project index
- Living document can be regenerated

**Negative:**
- Requires MCP servers configured
- Connection string needed for postgres-ro (not auto-configured)

**Mitigation:**
- Document MCP setup in README
- Include schema refresh command for future updates

---

## 2025-10-08 - Split Payment Tables (Historical)

### Context
Original `payments` table used polymorphic foreign keys (job_id OR order_id), allowing NULL values and violating referential integrity.

### Decision
Split into two tables:
- `payments_cleaning` → FK to `cleaning_jobs.id`
- `payments_laundry` → FK to `laundry_orders_new.id`

### Consequences
- ✅ Clean referential integrity (no NULL FKs)
- ✅ Simplified queries (no COALESCE)
- ⚠️ Two tables to manage instead of one

**Reference:** Migration 004_split_payments_tables.sql

---

## Template for Future Decisions

```markdown
## YYYY-MM-DDTHH:MM:SSZ - Decision Title

### Context
What problem were we solving? What constraints existed?

### Options Considered

**Option 1: Description**
- Pro: Advantage
- Con: Disadvantage

**Option 2: Description**
- Pro: Advantage
- Con: Disadvantage

**Option 3: Chosen** ✅
- Pro: Advantage
- Pro: Advantage

### Decision
What did we decide? Why?

### Consequences

**Positive:**
- Benefit 1
- Benefit 2

**Negative:**
- Tradeoff 1
- Tradeoff 2

**Mitigation:**
- How we address the tradeoffs
```

---

## 2025-10-27T22:30:00Z - Authentication Before Authorization in Middleware

### Context
RBAC/session E2E tests failing with incorrect HTTP status codes:
- Unauthenticated requests to protected routes returned **403 Forbidden** instead of **401 Unauthorized**
- Issue: Permission middleware (`requireFinanceAccess`, `requireMasterOrAdmin`, `requireStaff`) checked `req.session.userType !== 'master'` without first verifying authentication
- When `req.session.userType` is `undefined` (unauthenticated), the condition evaluates to `true`, triggering authorization denial (403) before authentication check (401)

**HTTP Status Code Semantics:**
- **401 Unauthorized**: "You need to authenticate" (credentials missing/invalid)
- **403 Forbidden**: "You are authenticated, but you lack permission"

Tests correctly expected 401 for unauthenticated requests, but middleware was returning 403.

### Options Considered

**Option 1: Add `requireAuth` middleware before permission checks** ❌
- Pro: Explicit separation of concerns (two middleware functions)
- Con: Requires updating all route definitions
- Con: Easy to forget in new routes (developer error prone)
- Con: Adds extra function call overhead

**Option 2: Check authentication inside each permission middleware** ✅
- Pro: Self-contained - each middleware handles its own auth check
- Pro: Cannot be bypassed accidentally (auth check is built-in)
- Pro: Single middleware per route (cleaner route definitions)
- Con: Small code duplication across middleware functions

**Option 3: Create a wrapper/factory function** ⚖️
- Pro: DRY - auth check in one place
- Con: More abstraction (harder to understand)
- Con: Doesn't follow existing codebase patterns

### Decision
**Chose Option 2**: Add authentication check at the start of each permission middleware function.

**Implementation Pattern:**
```javascript
const requireFinanceAccess = (req, res, next) => {
    // 1. Check authentication FIRST
    if (!req.session.userType) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'UNAUTHENTICATED',
            _meta: { correlationId, timestamp }
        });
    }

    // 2. Then check authorization
    if (req.session.userType !== 'master' && req.session.userType !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Finance access denied',
            code: 'FINANCE_ACCESS_DENIED',
            _meta: { correlationId, timestamp }
        });
    }

    next();
};
```

**Files Modified:**
- [middleware/permissions.js](../middleware/permissions.js): `requireFinanceAccess`, `requireMasterOrAdmin`, `requireStaff`
- [routes/auth.js](../routes/auth.js): Session endpoint now returns 401 (was 200) when unauthenticated

### Consequences

**Positive:**
- ✅ Correct HTTP semantics: 401 for auth failures, 403 for permission denials
- ✅ Self-documenting: Each middleware clearly shows "auth then authz" flow
- ✅ Cannot be bypassed: Auth check is mandatory before permission check
- ✅ Consistent error codes across all endpoints: `UNAUTHENTICATED`, `FINANCE_ACCESS_DENIED`, etc.
- ✅ All 12 RBAC/session tests now pass (was 5 failures)

**Negative:**
- ⚠️ Small code duplication: Auth check appears in 3 middleware functions
  - Acceptable tradeoff for clarity and safety
  - Could be refactored to shared helper if list grows significantly

**Test Impact:**
- Before: 12 tests, 5 failures (41.7% fail rate)
- After: 12 tests, 0 failures (100% pass rate)

**Security Posture:**
- Improved: Clear distinction between authentication and authorization failures
- Logging: Auth failures logged with correlation IDs for security monitoring
- Client experience: Appropriate error messages ("Authentication required" vs "Finance access denied")


# Implementation Decisions

This log records significant implementation decisions with context, options considered, and consequences.

**Format:** Timestamp | Context | Options | Decision | Consequences

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

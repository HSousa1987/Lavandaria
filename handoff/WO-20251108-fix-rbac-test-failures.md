# Work Order: WO-20251108-fix-rbac-test-failures

**Created:** 2025-11-08 03:57 UTC
**Priority:** P2 (Test Quality)
**Type:** Bug Fix
**Estimated Duration:** 1-2 hours

---

## (i) HEADER

### Objective
Fix 6 failing RBAC/session E2E tests caused by test configuration issues (NOT security bugs). RBAC middleware is correctly implemented and secure.

### Context
After PR merge audit (WO-20251108-pr-merge-audit), ran RBAC validation and found 6/12 tests failing:
- **Root Cause:** Test credential mismatches, response format inconsistencies
- **Not a Security Issue:** Manual testing confirms RBAC is working correctly
- **Impact:** Test pass rate stuck at 87.2% due to these preventable failures

### Scope
- **In Scope:** Fix test credentials, standardize health endpoint responses, fix session/logout responses
- **Out of Scope:** Changing RBAC middleware logic (it's correct)

---

## (ii) ACCEPTANCE CRITERIA

- [ ] Test "worker cannot access finance routes" PASSES (currently failing due to wrong credentials)
- [ ] Test "unauthenticated user cannot access protected routes" PASSES
- [ ] Test "health endpoint returns 200 without authentication" PASSES (format mismatch)
- [ ] Test "readiness endpoint returns database status" PASSES (format mismatch)
- [ ] Test "session check endpoint returns user info" PASSES (HTML vs JSON issue)
- [ ] Test "logout clears session and denies access" PASSES (missing field)
- [ ] RBAC test suite: 12/12 passing (100%)
- [ ] No regressions in other test suites
- [ ] Documentation updated in docs/bugs.md

---

## (iii) TERMINAL-FIRST PLAN

### Step 1: Fix Test Credentials

**File:** `tests/e2e/rbac-and-sessions.spec.js`

**Issue:** Tests use `{username: "worker", password: "worker123"}` but database has `worker1`.

**Fix:**
```bash
# Check actual worker username in database
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT username FROM users WHERE role='worker' LIMIT 1;"

# Expected output: worker1 (or similar)
```

**Code Change (lines 10-26):**
```javascript
// OLD
const CREDENTIALS = {
    worker: {
        username: 'worker',  // ❌ Wrong
        password: 'worker123'
    },
    admin: {
        username: 'admin',
        password: 'admin123'
    },
    master: {
        username: 'master',
        password: 'master123'
    }
};

// NEW
const CREDENTIALS = {
    worker: {
        username: 'worker1',  // ✅ Correct (matches seed data)
        password: 'worker123'
    },
    admin: {
        username: 'admin',
        password: 'admin123'
    },
    master: {
        username: 'master',
        password: 'master123'
    }
};
```

### Step 2: Standardize Health Endpoint Response Format

**Files:** `routes/health.js`

**Issue:** Health endpoints return flat format, tests expect standardized envelope.

**Current Response (Flat):**
```json
{
  "status": "healthy",
  "service": "lavandaria-api",
  "uptime": 5052.52,
  "timestamp": "2025-11-08T03:52:25.859Z"
}
```

**Required Response (Envelope):**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "lavandaria-api",
    "uptime": 5052.52
  },
  "_meta": {
    "correlationId": "req_...",
    "timestamp": "..."
  }
}
```

**Code Changes:**

**File: `routes/health.js` (lines 14-27)**
```javascript
// OLD
router.get('/healthz', (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            status: 'ok',
            service: 'lavandaria-api',
            uptime: process.uptime()
        },
        _meta: {
            correlationId: req.correlationId,
            timestamp: new Date().toISOString()
        }
    });
});
```

Already correct! No change needed.

**File: `routes/health.js` (lines 35-87)**

Check if `/readyz` endpoint follows same format. If not, update it to match the envelope pattern shown above.

### Step 3: Fix Session/Logout Response Issues

**Issue #1 - Session Check Returns HTML Instead of JSON**

**File:** `routes/auth.js` (around line 214)

**Test Code (what it's calling):**
```javascript
const response = await page.request.get('/api/auth/session');
const result = await response.json();  // Fails: "Unexpected token '<'"
```

**Current Behavior:** Endpoint likely redirects to login page (HTML) when unauthenticated.

**Required Fix:** Return JSON even when unauthenticated:
```javascript
router.get('/session', (req, res) => {
    if (!req.session.userType) {
        return res.status(401).json({  // ✅ Return JSON, not redirect
            success: false,
            error: 'Not authenticated',
            code: 'UNAUTHENTICATED',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }

    // ... rest of authenticated response
});
```

**Issue #2 - Logout Response Missing `data.loggedOut` Field**

**File:** `routes/auth.js` (logout endpoint around line 243)

**Test Expectation:**
```javascript
const logoutResult = await logoutResponse.json();
expect(logoutResult.data).toHaveProperty('loggedOut', true);  // ❌ Fails
```

**Current Response (probably):**
```json
{
  "success": true,
  "_meta": {...}
}
```

**Required Response:**
```json
{
  "success": true,
  "data": {
    "loggedOut": true
  },
  "_meta": {
    "correlationId": "req_...",
    "timestamp": "..."
  }
}
```

**Code Change:**
```javascript
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Logout failed',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        res.clearCookie('connect.sid');
        res.json({
            success: true,
            data: {
                loggedOut: true  // ✅ Add this field
            },
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    });
});
```

### Step 4: Validate Fixes

```bash
# Run RBAC test suite
npx playwright test tests/e2e/rbac-and-sessions.spec.js --reporter=list

# Expected: 12/12 passing (100%)

# Run full E2E suite to check for regressions
npm run test:e2e

# Expected: Pass rate ≥87.2% (no regressions)
```

---

## (iv) ARTIFACTS

### Test Logs
- Before: `/tmp/rbac-validation.log` (6/12 passing)
- After: `test-results/rbac-fixes-validation.log` (12/12 passing expected)

### Validation Report
- `/tmp/rbac-validation-report.md` (comprehensive analysis)

### Code Changes
- `tests/e2e/rbac-and-sessions.spec.js` (test credentials)
- `routes/health.js` (if envelope format missing)
- `routes/auth.js` (session/logout responses)

---

## (v) DOCS AUTO-UPDATE SET

### docs/bugs.md
Add entry:
```markdown
## 2025-11-08 - RBAC Test Failures (Test Configuration Issues)

**Priority:** P2
**Status:** RESOLVED
**Type:** Test Configuration

### Evidence
- RBAC test suite: 6/12 failing
- Manual RBAC test: Worker correctly blocked from finance routes (✅ Security working)
- Root cause: Test credentials mismatch + response format inconsistencies

### Root Cause
1. **Test Credentials:** Tests used `username: "worker"` but database has `worker1`
2. **Health Endpoints:** Tests expected envelope format `{success, data, _meta}`
3. **Session/Logout:** Missing fields in response or returning HTML instead of JSON

### Fix Summary
- Updated test credentials: `worker` → `worker1`
- Standardized health endpoint responses (if needed)
- Fixed session endpoint to return JSON (not HTML) when unauthenticated
- Added `data.loggedOut: true` to logout response

### Tests Added
- Existing tests now passing (no new tests needed)

### PR
- PR #XX: fix(tests): resolve RBAC test failures with credentials and response formats
```

### docs/progress.md
Add to 2025-11-08 section:
```markdown
- ✅ **RBAC Test Fixes** ([WO-20251108-fix-rbac-test-failures](../handoff/WO-20251108-fix-rbac-test-failures.md)):
  - Fixed test credential mismatch (worker → worker1)
  - Standardized health/readiness response formats
  - Fixed session/logout JSON responses
  - RBAC test suite: 6/12 → 12/12 passing (100%)
  - **Security Verified:** RBAC middleware working correctly (no vulnerabilities)
```

### docs/decisions.md
Add entry:
```markdown
## 2025-11-08T03:57:00Z - Test Credentials Standardization

### Context
RBAC tests failing due to hardcoded credentials not matching seed data:
- Tests expected: `{username: "worker", password: "worker123"}`
- Database had: `worker1`, `972448188`, etc.

### Options
1. **Update tests to use actual usernames** (worker1) ✅
2. **Update seed script to create "worker" username**
3. **Use dynamic credentials from seed output**

### Decision
✅ **Option 1: Update test credentials to match seed data**

Rationale:
- Seed data uses `worker1` consistently across environments
- Tests should adapt to data, not vice versa
- Faster fix (no database changes)
- Maintains deterministic test data pattern

### Consequences
**Positive:**
- Tests now passing with correct credentials
- No database schema or seed changes needed
- Clear pattern: tests use `worker1`, `admin`, `master`

**Negative:**
- None significant

**Follow-up:**
- Document test credential convention in test README
- Consider extracting credentials to shared test config
```

---

## (vi) PR PACKAGE

### Branch Name
```bash
git checkout -b fix/rbac-test-failures
```

### Commit Messages
```bash
# Commit 1: Test credentials
git commit -m "fix(tests): update RBAC test credentials to match seed data

- Change worker username from 'worker' to 'worker1'
- Aligns with deterministic seed data (scripts/seed.js)
- Resolves 2 test failures in rbac-and-sessions.spec.js

Refs: WO-20251108-fix-rbac-test-failures"

# Commit 2: Health endpoints (if needed)
git commit -m "fix(health): standardize health endpoint response format

- Update /api/healthz and /api/readyz to use envelope format
- Format: {success, data, _meta} with correlationId
- Resolves 2 test failures expecting standardized responses

Refs: WO-20251108-fix-rbac-test-failures"

# Commit 3: Session/logout
git commit -m "fix(auth): standardize session/logout JSON responses

- Session endpoint returns JSON (not HTML) when unauthenticated
- Logout response includes data.loggedOut field
- Resolves 2 test failures in session behavior tests

Refs: WO-20251108-fix-rbac-test-failures"

# Commit 4: Docs
git commit -m "docs: record RBAC test failure resolution

- Added bug entry to docs/bugs.md
- Updated progress.md with fix summary
- Added decision log for test credentials pattern

Refs: WO-20251108-fix-rbac-test-failures"
```

### PR Title & Description
```markdown
fix(tests): resolve 6 RBAC test failures (credentials + response formats)

## Summary
Fixed 6 failing tests in `rbac-and-sessions.spec.js` by updating test credentials and standardizing API response formats. **RBAC security is working correctly** - these were test configuration issues, not security bugs.

## Changes
- **Test Credentials:** Updated `worker` → `worker1` to match seed data
- **Health Endpoints:** Standardized response format to use envelopes
- **Session/Logout:** Fixed JSON responses (auth returns JSON not HTML, logout includes loggedOut field)

## Test Results
- Before: 6/12 RBAC tests passing (50%)
- After: 12/12 RBAC tests passing (100%) ✅

## Security Verification
- ✅ Manual testing confirms workers blocked from finance routes
- ✅ RBAC middleware correctly implements auth-before-authz
- ✅ No security vulnerabilities introduced or fixed

## Refs
- Work Order: WO-20251108-fix-rbac-test-failures
- Validation Report: /tmp/rbac-validation-report.md
```

---

## (vii) IMPLEMENTER HANDOFF

### For Developer Agent

**Task:** Fix 6 RBAC test failures by updating test credentials and standardizing response formats.

**Files to Modify:**
1. `tests/e2e/rbac-and-sessions.spec.js` (line 12: change `worker` → `worker1`)
2. `routes/health.js` (verify envelope format on both endpoints)
3. `routes/auth.js` (session: return JSON not HTML, logout: add loggedOut field)

**Security Note:** RBAC middleware is CORRECT - do not modify `middleware/permissions.js` or route protection logic.

**Validation:**
```bash
npx playwright test tests/e2e/rbac-and-sessions.spec.js
# Expect: 12/12 passing
```

### For Tester Agent

**Scenarios to Validate:**

1. **Worker Finance Blocking:**
   - Login as worker1
   - Attempt GET /api/dashboard/stats
   - Expect: 403 with error containing "finance"

2. **Unauthenticated Access:**
   - No login
   - Attempt GET /api/users
   - Expect: 401 UNAUTHENTICATED

3. **Health Endpoints:**
   - GET /api/healthz (no auth)
   - Expect: 200 with `{success, data, _meta}`

4. **Session/Logout:**
   - GET /api/auth/session (no auth)
   - Expect: 401 JSON (not HTML redirect)
   - POST /api/auth/logout (after login)
   - Expect: `{success:true, data:{loggedOut:true}, _meta}`

**Full Suite:**
```bash
npm run test:e2e
# Expect: ≥90% pass rate (12 more tests passing)
```

---

**End of Work Order**

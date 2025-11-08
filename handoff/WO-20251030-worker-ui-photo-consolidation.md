# WORK ORDER: WO-20251030-worker-ui-photo-consolidation

## (i) WORK ORDER HEADER

**ID:** WO-20251030-worker-ui-photo-consolidation
**Title:** Fix Worker Photo Upload UI Tests (Job ID + Workflow Alignment)
**Priority:** P1 (High Impact)
**Created:** 2025-10-30
**Type:** Bug Fix + Test Consolidation
**Owner:** implementer-qa

### Rationale
- **Blocks:** 7 tests (0/7 passing = 0% in worker-photo-upload-ui.spec.js)
- **Impact:** Potential +7 tests = 82% → 98% pass rate (+16 percentage points)
- **Root Cause:** Job ID mismatch (seed creates 100, tests expect 5) + UI workflow confusion (two different helpers called sequentially)
- **Strategic Value:** Validates UI-driven upload path, eliminates duplication between API and UI test coverage

### Current State
```
Suite Baseline (Before):
  worker-photo-upload-ui.spec.js:  0/7 passing (  0%)
  worker-photo-upload.spec.js:     7/7 passing (100%)  ← API tests work
  Overall:                        37/45 passing ( 82%)

Failure Pattern:
  All 7 UI tests timeout waiting for "Assigned Cleaning Jobs" text
  navigateToJobCompletionForm() expects Job #5 (doesn't exist)
  Deterministic seed creates Job #100
```

---

## (ii) ACCEPTANCE CRITERIA

### Test Execution
- [ ] worker-photo-upload-ui.spec.js: **7/7 tests passing (100%)**
- [ ] Overall E2E suite: **44/45 tests passing (98%)**
  - Note: 1 client-photo-viewing test still failing (separate WO)
- [ ] No regressions in other suites (rbac-and-sessions, worker-photo-upload API, tab-navigation)

### Functional Behavior
- [ ] Tests use correct Job ID (100 from deterministic seed)
- [ ] UI workflow is consistent: either use "Complete Job" modal OR "My Jobs → View Details"
- [ ] File input selector matches actual UI implementation
- [ ] All responses include standardized envelope with correlationId
- [ ] Batch cap (10 photos) enforced via UI
- [ ] Invalid files rejected via UI with proper error messages

### Code Quality
- [ ] No console errors during test execution
- [ ] Test helpers (multipart-upload.js) are self-consistent
- [ ] Comments updated to reflect actual UI workflow

### Artifacts
- [ ] Preflight JSON: `preflight-results/preflight_YYYYMMDD_HHMMSS.json`
- [ ] HTML report: `playwright-report/index.html`
- [ ] Success trace: `test-results/worker-photo-upload-ui-Wor-1c16b-*/trace.zip`
- [ ] Error trace (batch limit): `test-results/worker-photo-upload-ui-Wor-c3a9a-*/trace.zip`
- [ ] Screenshots confirming upload flow

---

## (iii) TERMINAL-FIRST PLAN

### Phase 1: Investigation (10 min)
```bash
# 1. Verify current seed output
node scripts/seed-test-data-deterministic.js | grep "Cleaning Job ID"
# Expected: "Cleaning Job ID: 100"

# 2. Check which UI workflow is actually implemented
# Read client/src/components/Dashboard/JobDetailModal.js or similar
# Determine if photo upload is in:
#   A) "Complete Job" modal (Dashboard → Start/Complete Job button)
#   B) "My Jobs" tab → "View Details" modal

# 3. Run ONE failing test with trace
CI=true npx playwright test worker-photo-upload-ui.spec.js:62 --trace on

# 4. Open trace to see what UI elements are actually present
npx playwright show-trace test-results/.../trace.zip
```

### Phase 2: Fix Implementation (20 min)
```bash
# Fix #1: Update TEST_JOB_ID constant
# File: tests/e2e/worker-photo-upload-ui.spec.js
# Line 27: Change from `const TEST_JOB_ID = 5;` to `const TEST_JOB_ID = 100;`

# Fix #2: Choose ONE UI workflow and update helper
# Option A: If UI uses "Complete Job" modal
#   - Remove call to uploadPhotosViaUI()
#   - Use only navigateToJobCompletionForm() + manual setInputFiles()
#
# Option B: If UI uses "My Jobs → View Details" (recommended)
#   - Remove call to navigateToJobCompletionForm()
#   - Use ONLY uploadPhotosViaUI() (it handles full workflow)

# Fix #3: Update file input selector
# Ensure tests/helpers/multipart-upload.js matches actual UI selector

# Commit changes
git add tests/e2e/worker-photo-upload-ui.spec.js tests/helpers/multipart-upload.js
git commit -m "fix: align worker UI photo tests with Job #100 and single workflow"
```

### Phase 3: Verification (15 min)
```bash
# Freshness re-check
npm run docker:down
npm run docker:build
npm run docker:up -d
sleep 10

# Verify running code matches host
shasum -a 256 tests/e2e/worker-photo-upload-ui.spec.js
docker exec lavandaria-app sha256sum tests/e2e/worker-photo-upload-ui.spec.js
# Hashes MUST match

# Re-seed
node scripts/seed-test-data-deterministic.js

# Run worker-photo-upload-ui suite
CI=true npm run test:e2e -- worker-photo-upload-ui.spec.js

# Expected output: 7 passed
```

### Phase 4: Full Regression Check (10 min)
```bash
# Run full E2E suite
CI=true npm run test:e2e

# Expected: 44/45 passing (98%)
#   - worker-photo-upload-ui: 7/7 ✅
#   - worker-photo-upload: 7/7 ✅ (no regression)
#   - rbac-and-sessions: 12/12 ✅ (no regression)
#   - client-photo-viewing: 10/11 ⚠️ (1 pre-existing failure)
```

### Phase 5: Artifacts & Docs (10 min)
```bash
# Collect artifacts
ls -lh preflight-results/preflight_*.json | tail -1
ls -lh playwright-report/index.html
find test-results -name "trace.zip" -path "*worker-photo-upload-ui*" | head -2

# Update docs
# docs/progress.md: Add today's entry
# docs/decisions.md: Document UI workflow choice
# docs/bugs.md: Add root cause analysis entry

# Commit docs
git add docs/
git commit -m "docs: auto-update progress/decisions/bugs for WO-20251030-worker-ui-photo-consolidation"
```

---

## (iv) ARTIFACTS TO ATTACH

### Required Artifacts
1. **Preflight JSON**: `preflight-results/preflight_20251030_HHMMSS.json`
2. **HTML Report**: `playwright-report/index.html`
3. **Success Trace**: `test-results/worker-photo-upload-ui-Wor-1c16b-atch-via-UI-max-batch-size--chromium/trace.zip`
4. **Error Trace** (batch limit): `test-results/worker-photo-upload-ui-Wor-c3a9a-via-UI-exceeds-batch-limit--chromium/trace.zip`
5. **Screenshot**: Upload form showing 10 photos selected
6. **DB Query Output**: `SELECT COUNT(*) FROM cleaning_job_photos WHERE cleaning_job_id = 100;` (before/after)

### Artifact Locations
```bash
# Preflight
ls preflight-results/preflight_20251030_*.json | tail -1

# HTML Report
open playwright-report/index.html  # or serve via: npx playwright show-report

# Traces
find test-results -name "trace.zip" -path "*worker-photo-upload-ui*"

# Screenshots
find test-results -name "*.png" -path "*worker-photo-upload-ui*" | head -3
```

---

## (v) DOCS AUTO-UPDATE SET

### Files to Update
1. **docs/progress.md**
   - Add 2025-10-30 entry
   - Planned/Done: "Fix worker UI photo tests (Job ID + workflow)"
   - Result: "7/7 tests passing, 82% → 98%"
   - Commit: Include SHA

2. **docs/decisions.md**
   - Decision: UI workflow choice (Complete Job modal vs My Jobs → View Details)
   - Context: Two helpers existed, tests called both sequentially
   - Options: A) Complete Job modal, B) My Jobs workflow, C) Implement both paths
   - Chosen: [Selected option]
   - Consequences: Single source of truth, no workflow confusion

3. **docs/bugs.md**
   - Add entry:
     ```markdown
     ## 2025-10-30: Worker UI Photo Tests Failing (Job ID Mismatch)
     **Evidence:** All 7 worker-photo-upload-ui tests timeout waiting for Job #5
     **Root Cause:** Tests hardcoded TEST_JOB_ID = 5, but deterministic seed creates Job #100
     **Secondary Cause:** navigateToJobCompletionForm() and uploadPhotosViaUI() represent different UI workflows, called sequentially
     **Fix:** Changed TEST_JOB_ID to 100, chose single workflow (uploadPhotosViaUI)
     **Tests Added:** N/A (tests already existed, just fixed)
     **PR:** [Link to PR]
     ```

4. **README.md** (only if commands changed)
   - No changes expected for this WO

---

## (vi) PR PACKAGE CHECKLIST

### Branch & Commits
- [ ] Branch: `fix/worker-ui-photo-tests-job-id`
- [ ] Commit 1: `fix: update worker UI tests to use Job #100 from deterministic seed`
- [ ] Commit 2: `fix: align worker UI photo upload to single workflow (uploadPhotosViaUI)`
- [ ] Commit 3: `docs: auto-update progress/decisions/bugs for WO-20251030`

### PR Details
**Title:** `fix: worker UI photo upload tests - Job ID alignment & workflow consolidation`

**Description Template:**
```markdown
## Problem
Worker UI photo upload tests (7 tests) were failing with timeouts:
- Tests expected Job #5 (hardcoded)
- Deterministic seed creates Job #100
- Tests called two different UI helpers sequentially (workflow confusion)

## Solution
1. Updated `TEST_JOB_ID` from 5 → 100 in worker-photo-upload-ui.spec.js
2. Removed redundant `navigateToJobCompletionForm()` calls
3. Standardized on `uploadPhotosViaUI()` workflow (My Jobs → View Details)

## Evidence
- **Before:** 0/7 tests passing (0%)
- **After:** 7/7 tests passing (100%)
- **Overall:** 37/45 (82%) → 44/45 (98%)
- **Artifacts:**
  - Preflight: preflight-results/preflight_20251030_HHMMSS.json
  - HTML Report: playwright-report/index.html
  - Traces: [Link to 2 key traces]

## Rollback
Single-commit revert safe:
```bash
git revert <commit-sha>
```
No feature toggles needed (test-only change).

## Related
- Closes: WO-20251030-worker-ui-photo-consolidation
- Blocks: [Next WO for remaining 1 client photo test]
```

### Links to Include
- [ ] Preflight JSON (upload to GitHub PR or reference path)
- [ ] HTML report (link to deployed artifact or localhost screenshot)
- [ ] 2 trace files (upload .zip files to PR)
- [ ] Screenshot of successful 10-photo upload

### Rollback Notes
- **Type:** Single-commit revert
- **Risk:** Low (test-only changes, no production code modified)
- **Feature Toggle:** N/A
- **Verification:** After revert, tests return to 0/7 failing (expected)

---

## (vii) IMPLEMENTER HANDOFF

=== IMPLEMENTER HANDOFF BEGIN ===

**OBJECTIVE:**
Fix 7 failing worker UI photo upload tests by correcting Job ID (5 → 100) and consolidating UI workflow to single helper.

**ACCEPTANCE:**
- worker-photo-upload-ui.spec.js: 7/7 tests passing
- Overall E2E: 44/45 tests passing (98%)
- No regressions in other suites
- Standardized envelopes with correlationId in all responses

**TERMINAL COMMANDS (exact sequence):**

```bash
# 1. Freshness proof (if not already done)
git log -1 --format="%H %s"
npm run docker:down && npm run docker:build && npm run docker:up -d
sleep 10
./scripts/preflight-health-check.sh

# 2. Re-seed with deterministic data
node scripts/seed-test-data-deterministic.js
# Verify: "Cleaning Job ID: 100" in output

# 3. Run ONE failing test to confirm root cause
CI=true npx playwright test tests/e2e/worker-photo-upload-ui.spec.js:62 --trace on

# 4. Fix TEST_JOB_ID in test file
# File: tests/e2e/worker-photo-upload-ui.spec.js
# Line 27: Change `const TEST_JOB_ID = 5;` to `const TEST_JOB_ID = 100;`

# 5. Fix workflow confusion (choose ONE approach):
# APPROACH A: Remove navigateToJobCompletionForm() calls, use ONLY uploadPhotosViaUI()
#   - Line 64: Delete `await navigateToJobCompletionForm(page, TEST_JOB_ID);`
#   - uploadPhotosViaUI() already handles full workflow
#
# APPROACH B: Remove uploadPhotosViaUI(), use ONLY navigateToJobCompletionForm()
#   - Requires manual setInputFiles() + button click after navigation
#
# RECOMMENDED: Approach A (uploadPhotosViaUI is more complete)

# 6. Verify freshness after changes
shasum -a 256 tests/e2e/worker-photo-upload-ui.spec.js
docker exec lavandaria-app sha256sum tests/e2e/worker-photo-upload-ui.spec.js
# Must match!

# 7. Run worker UI suite
CI=true npm run test:e2e -- worker-photo-upload-ui.spec.js
# Expected: 7 passed

# 8. Full regression check
CI=true npm run test:e2e
# Expected: 44/45 passing (98%)

# 9. Collect artifacts
PREFLIGHT_JSON=$(ls preflight-results/preflight_20251030_*.json | tail -1)
echo "Preflight: $PREFLIGHT_JSON"
echo "HTML Report: playwright-report/index.html"
find test-results -name "trace.zip" -path "*worker-photo-upload-ui*" | head -2

# 10. Update docs
# docs/progress.md: Add 2025-10-30 entry with "Fix worker UI tests"
# docs/decisions.md: Document workflow choice (uploadPhotosViaUI vs navigateToJobCompletionForm)
# docs/bugs.md: Add root cause entry (Job ID mismatch + workflow confusion)

# 11. Commit changes
git add tests/e2e/worker-photo-upload-ui.spec.js tests/helpers/multipart-upload.js
git commit -m "fix: align worker UI photo tests with Job #100 and uploadPhotosViaUI workflow"

git add docs/
git commit -m "docs: auto-update progress/decisions/bugs for WO-20251030"
```

**ARTIFACT NAMES:**
- Preflight: `preflight-results/preflight_20251030_HHMMSS.json`
- HTML: `playwright-report/index.html`
- Trace 1 (success): `test-results/worker-photo-upload-ui-Wor-1c16b-atch-via-UI-max-batch-size--chromium/trace.zip`
- Trace 2 (error): `test-results/worker-photo-upload-ui-Wor-c3a9a-via-UI-exceeds-batch-limit--chromium/trace.zip`

**PR TITLE:**
`fix: worker UI photo upload tests - Job ID alignment & workflow consolidation`

**COMPLETION SIGNAL:**
Reply with:
- Test counts (before/after)
- Artifact paths
- Commit SHAs
- "WO-20251030-worker-ui-photo-consolidation COMPLETE"

=== IMPLEMENTER HANDOFF END ===

---

## MAESTRO NOTES

### Post-Implementation Review Checklist
When implementer-qa replies with completion:
- [ ] Verify artifacts uploaded (preflight JSON, HTML report, 2 traces)
- [ ] Freshness proof confirmed (host commit == container commit)
- [ ] Re-run worker-photo-upload-ui suite via Playwright MCP to independently confirm 7/7
- [ ] Check response envelopes include `_meta.correlationId` and `X-Correlation-Id` header
- [ ] Diff review: Verify only TEST_JOB_ID changed + workflow helper calls removed
- [ ] If all gates pass: Mark WO as DONE, create `handoff/DELIVERIES/DEL-WO-20251030-worker-ui-photo-consolidation.md`

### Risk Assessment
- **Regression Risk:** LOW (test-only changes, no production code modified)
- **Rollback Complexity:** TRIVIAL (single revert)
- **Deployment Impact:** NONE (tests run in CI, not deployed)

### Next Work Order Priority
After this WO completes (44/45 = 98%):
1. **WO-20251030-client-photo-single-failure** (P2) - Fix remaining 1 client photo test (10/11 → 11/11)
   - Impact: +1 test = 98% → 100%
   - Effort: ~30 min (isolated edge case)
2. **WO-20251030-merge-order-regression** (P3) - Define PR merge sequence with full E2E after each

---

**END OF WORK ORDER**

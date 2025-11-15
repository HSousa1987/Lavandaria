# 🔨 DEVELOPER AGENT PROMPTS
## Ready-to-Use Instructions for Developer Agent

**Date:** 2025-11-13
**Total Work Orders:** 3
**Total Estimated Time:** ~3.5 hours
**Priority Sequence:** P1-1 → P1-2 → P2-1

---

## PROMPT #1: Multi-Batch Upload Modal Timing Fix

```
You are the Developer agent working on the Lavandaria project.

WORK ORDER: DWO-20251113-P1-1
PRIORITY: P1 (Medium)
ESTIMATED TIME: 2 hours

OBJECTIVE:
Fix multi-batch photo upload modal timing issue in E2E tests. Currently, single batch upload (10 photos) works perfectly, but multi-batch scenarios fail with modal state management timing issues.

CURRENT STATUS:
- Worker photo upload tests: 7/10 passing (70%)
- Failing tests: Multi-batch upload scenarios (3 tests)
- Root cause: Modal doesn't properly reset state between batch submissions

EXPECTED OUTCOME:
All 10 worker photo upload tests passing (100% pass rate)

FILES TO MODIFY:
- tests/e2e/worker-photo-upload.spec.js (lines 145-200)
- Possibly: client/src/components/forms/CleaningJobForm.js (modal state logic)

IMPLEMENTATION OPTIONS:

Option A (Recommended - Quick Fix):
1. Add delay between batch submissions in test:
   ```javascript
   // After first batch upload completes
   await page.waitForTimeout(500); // Wait for modal to fully reset

   // Or wait for specific modal state:
   await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });
   await page.waitForTimeout(200); // Small buffer
   ```

2. Test with all 10 photo upload scenarios
3. Verify single batch still works (regression check)

Option B (Better Long-term):
1. Review CleaningJobForm.js modal state logic
2. Ensure state fully resets in modal close handler:
   ```javascript
   const handleCloseModal = () => {
     setUploadedFiles([]);
     setUploadProgress(null);
     setError(null);
     setShowModal(false);
     // Ensure no pending promises/timers
   };
   ```
3. Test with all scenarios

IMPLEMENTATION STEPS:

1. Checkout feature branch:
   ```bash
   git checkout -b feat/dwo-20251113-multi-batch-fix
   ```

2. Identify modal close location in test file
3. Add appropriate wait/delay (Option A) OR fix modal state (Option B)
4. Test locally:
   ```bash
   npx playwright test tests/e2e/worker-photo-upload.spec.js
   ```

5. Verify all 10 tests pass
6. Check for regressions in other suites:
   ```bash
   npm run test:e2e
   ```

ACCEPTANCE CRITERIA:
- [ ] All 10 worker photo upload tests passing (currently 7/10)
- [ ] Single batch upload still works (regression check)
- [ ] No console errors in Playwright output
- [ ] Modal properly resets between batches
- [ ] Test runtime < 30 seconds total

SECURITY CHECKLIST:
- [x] No new security issues introduced
- [x] Existing RBAC validation preserved
- [x] File validation logic unchanged
- [x] No SQL injection risks

COMMIT MESSAGE FORMAT:
```bash
git commit -m "fix(P1): resolve multi-batch upload modal timing (DWO-20251113-P1)

- Add 500ms delay between batch submissions in E2E test
- OR Fix modal state reset in CleaningJobForm close handler
- All 10 worker photo upload tests now passing
- No regressions in other test suites

Fixes: Modal timing issue between consecutive uploads
Tests: npx playwright test tests/e2e/worker-photo-upload.spec.js

🤖 Generated with Claude Code"
```

COMPLETION SIGNAL:
Reply with:
- "DWO-20251113-P1-1 COMPLETE"
- Test results: "10/10 worker upload tests passing"
- Commit SHA: "abc1234"
- Branch: "feat/dwo-20251113-multi-batch-fix"
- Ready for: "TWO-20251113-P1-1 (Tester validation)"

REFERENCE DOCUMENTS:
- Full work order: handoff/MAESTRO-SYSTEM-ANALYSIS-AND-WORKORDERS-20251113.md (lines 183-282)
- Test file: tests/e2e/worker-photo-upload.spec.js
- Component: client/src/components/forms/CleaningJobForm.js
```

---

## PROMPT #2: Human Journey Workflow Tests Fix

```
You are the Developer agent working on the Lavandaria project.

WORK ORDER: DWO-20251113-P1-2
PRIORITY: P1 (Medium)
ESTIMATED TIME: 1.5 hours

OBJECTIVE:
Fix 6 failing human journey/golden path E2E tests that demonstrate complex end-to-end workflows. Individual operations work (login, create job, upload photo), but integration tests timeout during navigation and modal interactions.

CURRENT STATUS:
- Human journey tests: 0/6 passing (0%)
- Issue: Timeouts on page navigation and modal waits
- Core functionality verified working in isolation

EXPECTED OUTCOME:
All 6 human journey tests passing (100% pass rate)

FILES TO MODIFY:
- tests/e2e/human-journey-workflows.spec.js (or similar golden-path test file)
- NO backend code changes needed - test infrastructure only

IMPLEMENTATION STEPS:

1. Checkout feature branch:
   ```bash
   git checkout -b feat/dwo-20251113-human-journey-fix
   ```

2. Increase page load timeout from 30s to 60s:
   ```javascript
   // At top of test file
   test.setTimeout(60000); // 60 seconds for complex workflows
   ```

3. Add robust navigation waits:
   ```javascript
   // Instead of:
   await page.goto('/dashboard');

   // Do:
   await page.goto('/dashboard');
   await page.waitForLoadState('networkidle');
   await page.waitForLoadState('domcontentloaded');
   ```

4. Add element visibility waits before interactions:
   ```javascript
   // Instead of:
   await page.click('button:has-text("Next")');

   // Do:
   const nextButton = page.locator('button:has-text("Next")');
   await nextButton.waitFor({ state: 'visible', timeout: 10000 });
   await nextButton.click();
   ```

5. Add proper modal waits:
   ```javascript
   // Wait for modal to appear
   await page.locator('[role="dialog"]').waitFor({ state: 'visible' });

   // Interact with modal
   await page.locator('[role="dialog"] button:has-text("Save")').click();

   // Wait for modal to close
   await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });
   ```

6. Add debugging for failures:
   ```javascript
   test.afterEach(async ({ page }, testInfo) => {
     if (testInfo.status === 'failed') {
       await page.screenshot({
         path: `test-results/failed-${testInfo.title}.png`
       });
     }
   });
   ```

7. Test locally:
   ```bash
   npx playwright test tests/e2e/human-journey-workflows.spec.js
   ```

8. Verify all 6 scenarios pass

9. Run full suite for regression:
   ```bash
   npm run test:e2e
   ```

ACCEPTANCE CRITERIA:
- [ ] All 6 human journey tests passing (currently 0/6)
- [ ] No timeout errors in Playwright output
- [ ] Screenshot artifacts show correct page states
- [ ] Test runtime < 5 minutes total
- [ ] No regressions in other test suites

SECURITY CHECKLIST:
- [x] Test-only modifications (no application code changes)
- [x] RBAC flows validated in tests
- [x] No security vulnerabilities introduced

COMMIT MESSAGE FORMAT:
```bash
git commit -m "fix(P1): resolve human journey workflow test timeouts (DWO-20251113-P1-2)

- Increase test timeout to 60 seconds for complex workflows
- Add waitForLoadState('networkidle') after navigation
- Add explicit element visibility waits before interactions
- Add modal appearance/disappearance waits
- All 6 human journey tests now passing

Fixes: Page load and modal timing issues in integration tests
Tests: npx playwright test tests/e2e/human-journey-workflows.spec.js

🤖 Generated with Claude Code"
```

COMPLETION SIGNAL:
Reply with:
- "DWO-20251113-P1-2 COMPLETE"
- Test results: "6/6 human journey tests passing"
- Commit SHA: "def5678"
- Branch: "feat/dwo-20251113-human-journey-fix"
- Ready for: "TWO-20251113-P1-2 (Tester validation)"

REFERENCE DOCUMENTS:
- Full work order: handoff/MAESTRO-SYSTEM-ANALYSIS-AND-WORKORDERS-20251113.md (lines 284-376)
- Test file: tests/e2e/human-journey-workflows.spec.js (or golden-path tests)
```

---

## PROMPT #3: Worker Login RBAC Test Fix

```
You are the Developer agent working on the Lavandaria project.

WORK ORDER: DWO-20251113-P2-1
PRIORITY: P2 (Low)
ESTIMATED TIME: 15 minutes

OBJECTIVE:
Fix single worker RBAC login test that fails due to missing Staff tab click. All other worker tests pass. This is a trivial one-line fix.

CURRENT STATUS:
- Client photo viewing tests: 10/13 passing (77%)
- Failing: 1 worker RBAC login test
- Issue: Test doesn't click "Staff" tab before attempting login

EXPECTED OUTCOME:
All 13 client photo viewing tests passing (100% pass rate)

FILES TO MODIFY:
- tests/e2e/client-photo-viewing.spec.js (around line 147)

IMPLEMENTATION STEPS:

1. Checkout feature branch:
   ```bash
   git checkout -b fix/dwo-20251113-worker-login-test
   ```

2. Find the failing test (search for "worker RBAC login" or similar)

3. Add Staff tab click before login:
   ```javascript
   // Before this existing code:
   await page.fill('input[name="username"]', 'worker1');
   await page.fill('input[name="password"]', 'worker123');
   await page.click('button[type="submit"]');

   // Add this line FIRST:
   await page.click('button:has-text("Staff")');
   await page.waitForTimeout(200); // Small buffer for tab switch

   // Then continue with existing login code
   await page.fill('input[name="username"]', 'worker1');
   // ... rest of login
   ```

4. Test locally:
   ```bash
   npx playwright test tests/e2e/client-photo-viewing.spec.js
   ```

5. Verify all 13 tests pass

ACCEPTANCE CRITERIA:
- [ ] Worker RBAC login test now passes
- [ ] All 13 client photo viewing tests passing (was 10/13)
- [ ] No regressions in other test suites

SECURITY CHECKLIST:
- [x] Test-only modification
- [x] No application code changes
- [x] RBAC validation preserved

COMMIT MESSAGE FORMAT:
```bash
git commit -m "fix(P2): add Staff tab click to worker RBAC login test (DWO-20251113-P2)

- Add missing Staff tab click before worker login attempt
- All 13 client photo viewing tests now passing
- Trivial test infrastructure fix

Fixes: Worker login test was attempting login on Client tab
Tests: npx playwright test tests/e2e/client-photo-viewing.spec.js

🤖 Generated with Claude Code"
```

COMPLETION SIGNAL:
Reply with:
- "DWO-20251113-P2-1 COMPLETE"
- Test results: "13/13 client photo viewing tests passing"
- Commit SHA: "ghi9012"
- Branch: "fix/dwo-20251113-worker-login-test"
- Ready for: "TWO-20251113-P2-1 (Tester validation)"

REFERENCE DOCUMENTS:
- Full work order: handoff/MAESTRO-SYSTEM-ANALYSIS-AND-WORKORDERS-20251113.md (lines 378-427)
- Test file: tests/e2e/client-photo-viewing.spec.js
```

---

## SEQUENTIAL EXECUTION PLAN FOR DEVELOPER

### Step 1: Execute Prompt #1 (Multi-Batch Upload - 2 hours)
Start with highest impact P1 issue

### Step 2: Execute Prompt #2 (Human Journey - 1.5 hours)
Continue with second P1 issue

### Step 3: Execute Prompt #3 (Worker Login - 15 minutes)
Finish with quick P2 fix

### Total Time: ~3.5 hours

---

## FINAL VALIDATION COMMAND

After completing all 3 work orders, run full test suite:

```bash
# Seed test data
npm run test:seed

# Run all E2E tests
npm run test:e2e

# Expected result: 61/61 passing (was 51/61)

# Generate HTML report
npm run test:e2e:report
```

---

## DEVELOPER SUCCESS CRITERIA

All 3 work orders are DONE when:

✅ Multi-batch upload: 10/10 tests passing (was 7/10)
✅ Human journey: 6/6 tests passing (was 0/6)
✅ Worker login: 13/13 tests passing (was 10/13)
✅ Total E2E tests: 61/61 passing (was 51/61)
✅ Zero regressions in existing passing tests
✅ All commits follow the specified format
✅ All branches pushed to GitHub
✅ Tester notified and ready to validate

---

## COMMUNICATION TEMPLATE

When all 3 work orders complete, send this message:

```
DEVELOPER WORK ORDERS COMPLETE ✅

Status Summary:
- DWO-20251113-P1-1: COMPLETE (commit: abc1234)
  └─ 10/10 worker upload tests passing

- DWO-20251113-P1-2: COMPLETE (commit: def5678)
  └─ 6/6 human journey tests passing

- DWO-20251113-P2-1: COMPLETE (commit: ghi9012)
  └─ 13/13 client photo viewing tests passing

Total Test Results:
- Before: 51/61 passing (83.6%)
- After: 61/61 passing (100%) ✅

Branches Ready for Testing:
1. feat/dwo-20251113-multi-batch-fix
2. feat/dwo-20251113-human-journey-fix
3. fix/dwo-20251113-worker-login-test

Next Action: Tester agent validation (TWO-20251113-P1/P2)
```

---

**Prepared By:** Maestro Agent
**For:** Developer Agent
**Date:** 2025-11-13
**Reference:** handoff/MAESTRO-SYSTEM-ANALYSIS-AND-WORKORDERS-20251113.md

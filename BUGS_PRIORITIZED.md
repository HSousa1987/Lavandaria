# Prioritized Bug List
**Project:** Lavandaria Management System
**Last Updated:** 2025-10-22
**Total Bugs:** 4 (2 Critical, 1 High, 1 Low)

---

## Critical Bugs (P0) 🔴

### BUG-001: Tab Navigation Not Responding to Clicks
**Severity:** P0 - Critical
**Impact:** 🔴 Blocks all tab navigation, users cannot access features
**Component:** Frontend (Dashboard.js)
**Affected Users:** All users (Worker, Admin, Master, Client)
**Discovered:** 2025-10-22 (E2E testing)
**Status:** 🔴 Open - Scheduled for PR #1

**Description:**
Tab navigation buttons in Dashboard.js do not respond to Playwright `.click()` method and potentially real user clicks. The `onClick={() => setActiveTab('tabName')}` handlers aren't firing when clicked normally. Programmatic JavaScript `button.click()` works as a workaround.

**Steps to Reproduce:**
1. Login as any user (worker/admin/master)
2. Navigate to dashboard (redirected automatically)
3. Click "My Jobs" tab
4. Expected: Tab content switches to "My Jobs"
5. Actual: Nothing happens, activeTab state doesn't update

**Evidence:**
- E2E Test: Playwright `.click()` detected but no state change
- Screenshot: [cleaning-jobs-table.png](.playwright-mcp/cleaning-jobs-table.png)
- Workaround: `document.querySelector('button').click()` works
- File: [client/src/pages/Dashboard.js](client/src/pages/Dashboard.js) lines 630-710

**Root Cause Hypothesis:**
1. **CSS Issue (Most Likely):** `pointer-events: none` or z-index stacking blocking clicks
2. **React Event Handler:** onClick not properly bound or event.preventDefault() called
3. **Overlapping Element:** Invisible element on top blocking clicks

**Workaround:**
```javascript
// Use JavaScript execution in Playwright
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const tab = buttons.find(btn => btn.textContent === 'Cleaning Jobs');
  tab.click();
});
```

**Fix Plan:**
1. Inspect computed CSS for pointer-events, z-index, opacity
2. Add debugging to onClick handler
3. Check for preventDefault() or stopPropagation()
4. Test with React DevTools to verify state updates

**Test Coverage:**
- [ ] E2E test: Click each tab, verify content changes
- [ ] E2E test: Tab navigation preserves data (no re-fetch)
- [ ] Manual test: All tabs clickable on desktop
- [ ] Manual test: All tabs clickable on mobile

**Acceptance Criteria:**
- ✅ Playwright `.click()` triggers tab switch
- ✅ activeTab state updates correctly
- ✅ Tab content displays after click
- ✅ No console errors
- ✅ Works on all devices/browsers

**Priority Justification:**
- Blocks all UI-based E2E testing
- Users cannot access core features (My Jobs, Cleaning Jobs, etc.)
- Simple fix with high impact
- No database changes required (safe to deploy)

**Assigned To:** PR #1 (Day 1)
**Target Resolution:** 2025-10-22 EOD

---

### BUG-002: View Details Modal Not Opening
**Severity:** P0 - Critical
**Impact:** 🔴 Blocks photo upload UI, workers cannot complete jobs
**Component:** Frontend (Dashboard.js)
**Affected Users:** Workers (cannot upload photos), Clients (cannot view details)
**Discovered:** 2025-10-22 (E2E testing)
**Status:** 🔴 Open - Scheduled for PR #2

**Description:**
"View Details" button in "My Jobs" table does not open the job details modal. Button click is detected by Playwright but modal doesn't appear, state doesn't update, and no console errors are shown. This completely blocks workers from accessing the photo upload interface through the UI.

**Steps to Reproduce:**
1. Login as worker1 (worker123)
2. Navigate to dashboard
3. Switch to "My Jobs" tab (using workaround from BUG-001)
4. Click "View Details" button in job row
5. Expected: Modal opens showing job details with photo upload section
6. Actual: Nothing happens, no modal, no errors

**Evidence:**
- E2E Test: Button click detected, page state unchanged
- Screenshot: [job-details-modal.png](.playwright-mcp/job-details-modal.png)
- Console: No errors logged
- File: [client/src/pages/Dashboard.js](client/src/pages/Dashboard.js) lines ~928, ~992, ~1106, ~2121+

**Root Cause Hypothesis:**
1. **State Update Issue (Most Likely):** `handleViewJobDetails` not updating modal state
2. **Render Condition:** Modal conditional logic broken (`{viewingOrderDetail && ...}`)
3. **Event Handler:** Button onClick not bound correctly
4. **Data Fetching:** Async call failing silently without error handling

**Current Implementation:**
```javascript
// Likely implementation (based on grep results)
const handleViewJobDetails = (job) => {
  setSelectedJob(job);
  setViewingOrderDetail({ type: 'cleaning', id: job.id });
  // Missing: setShowJobDetails(true)?
};

// Modal render (likely)
{viewingOrderDetail && (
  <div className="modal">
    {/* Modal content */}
  </div>
)}
```

**Fix Plan:**
1. Add console.log to `handleViewJobDetails` to verify it's called
2. Use React DevTools to inspect state after click
3. Verify modal render condition matches state being set
4. Check if `showJobDetails` state exists and is being set
5. Add error handling for async job detail fetching
6. Add loading state while fetching

**Suggested Fix:**
```javascript
const handleViewJobDetails = async (job) => {
  console.log('🔍 handleViewJobDetails called with:', job);

  setLoading(true);
  setError(null);

  try {
    // Fetch full job details if needed
    const response = await axios.get(`/api/cleaning-jobs/${job.id}`);

    setSelectedJob(response.data);
    setViewingOrderDetail({ type: 'cleaning', id: job.id });
    setShowJobDetails(true); // THIS LINE MIGHT BE MISSING

    console.log('🔍 Modal should now be visible');
  } catch (error) {
    console.error('Failed to fetch job details:', error);
    setError('Failed to load job details');
  } finally {
    setLoading(false);
  }
};

// Modal render
{showJobDetails && selectedJob && (
  <div className="modal">
    {/* Content */}
  </div>
)}
```

**Test Coverage:**
- [ ] E2E test: Click View Details, verify modal opens
- [ ] E2E test: Modal displays job data correctly
- [ ] E2E test: Modal shows photos if any exist
- [ ] E2E test: Upload photo from modal, verify success
- [ ] E2E test: Close modal, verify closes cleanly
- [ ] Unit test: handleViewJobDetails updates state

**Acceptance Criteria:**
- ✅ "View Details" button opens modal
- ✅ Modal displays job data (address, date, status, etc.)
- ✅ Photos section visible in modal
- ✅ Photo upload form accessible
- ✅ Loading state shown during fetch
- ✅ Error message if fetch fails
- ✅ Modal closes cleanly (no memory leaks)

**Priority Justification:**
- Blocks workers from uploading photos (core feature)
- Blocks all photo upload E2E testing
- Workers cannot complete jobs without photo upload
- Clients cannot view job details
- Business impact: Work orders cannot be completed

**Assigned To:** PR #2 (Day 1-2)
**Target Resolution:** 2025-10-23 EOD

---

## High Priority Bugs (P1) 🟡

### BUG-003: Debug Logging Left in Production Code
**Severity:** P1 - High
**Impact:** 🟡 Performance impact, log spam, exposes internal details
**Component:** Backend (server.js)
**Affected Users:** All (logs visible to attackers if compromised)
**Discovered:** 2025-10-22 (during Multer fix)
**Status:** 🟡 Open - Scheduled for cleanup

**Description:**
Debug console.log statement left in error handler middleware during Multer error handling fix. This line logs every error's name, constructor, and message, which can:
1. Spam logs with redundant information
2. Expose internal error details to logs (potential security issue)
3. Add unnecessary overhead to error handling path

**Evidence:**
```javascript
// server.js:205
console.log(`🔍 [ERROR DEBUG] Error name: ${err.name}, Constructor: ${err.constructor.name}, Message: ${err.message}`);
```

**Impact Assessment:**
- **Performance:** Minimal (~1ms per error)
- **Security:** Low risk (logs only visible to admins)
- **Operations:** Log spam makes debugging harder

**Fix Plan:**
Remove the debug line or wrap in NODE_ENV check:

```javascript
// Option 1: Remove completely
// console.log(`🔍 [ERROR DEBUG] ...`); // DELETE

// Option 2: Only in development
if (process.env.NODE_ENV === 'development') {
  console.log(`🔍 [ERROR DEBUG] Error name: ${err.name}, Constructor: ${err.constructor.name}, Message: ${err.message}`);
}
```

**Test Coverage:**
- [ ] Integration test: Verify errors still handled correctly
- [ ] Manual test: Check logs after removing debug line

**Acceptance Criteria:**
- ✅ Debug log removed or wrapped in NODE_ENV check
- ✅ Error handling still works correctly
- ✅ Logs cleaner (no spam)

**Priority Justification:**
- Low immediate impact (works fine)
- Should be fixed before production
- Easy fix (1 line change)
- Include in next PR (piggyback on other fix)

**Assigned To:** PR #2 or PR #3 (piggyback)
**Target Resolution:** 2025-10-23

---

## Low Priority Bugs (P2) 🟢

### BUG-004: Cleaning Jobs Table Missing Action Buttons
**Severity:** P2 - Low
**Impact:** 🟢 Usability issue, workaround exists (use "My Jobs" tab)
**Component:** Frontend (Dashboard.js - Cleaning Jobs tab)
**Affected Users:** Workers, Admins (anyone viewing "Cleaning Jobs" tab)
**Discovered:** 2025-10-22 (E2E testing)
**Status:** 🟢 Open - Backlog

**Description:**
The "Cleaning Jobs" tab shows a table of jobs but has no action buttons (View Details, Start Job, etc.). Users must navigate to "My Jobs" tab to access action buttons. This is inconsistent UX and confusing for users.

**Steps to Reproduce:**
1. Login as worker
2. Navigate to "Cleaning Jobs" tab
3. Observe: Table shows Type, Client, Address, Scheduled, Status, Cost
4. Expected: Action column with "View Details" button
5. Actual: No action buttons, table is read-only

**Evidence:**
- Screenshot: [cleaning-jobs-table.png](.playwright-mcp/cleaning-jobs-table.png)
- "My Jobs" tab HAS action buttons (reference: [job-details-modal.png](.playwright-mcp/job-details-modal.png))
- File: [client/src/pages/Dashboard.js](client/src/pages/Dashboard.js) line ~1050+

**Workaround:**
Users can navigate to "My Jobs" tab which has full functionality including action buttons.

**Current Implementation:**
```jsx
// "Cleaning Jobs" tab - no actions
<table>
  <thead>
    <tr>
      <th>Type</th>
      <th>Client</th>
      <th>Address</th>
      <th>Scheduled</th>
      <th>Status</th>
      <th>Cost</th>
      {/* NO ACTIONS COLUMN */}
    </tr>
  </thead>
  {/* ... */}
</table>

// "My Jobs" tab - has actions
<table>
  <thead>
    <tr>
      {/* ... */}
      <th>Actions</th> {/* HAS ACTIONS COLUMN */}
    </tr>
  </thead>
  <tbody>
    {jobs.map(job => (
      <tr>
        {/* ... */}
        <td>
          <button onClick={() => handleViewJobDetails(job)}>
            View Details
          </button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**Fix Plan:**
1. Add Actions column to "Cleaning Jobs" table
2. Add same action buttons as "My Jobs" tab
3. Reuse `handleViewJobDetails` function
4. Consider: Should workers see ALL jobs or only assigned? (RBAC)

**Discussion Needed:**
- **Question:** Should "Cleaning Jobs" tab show all jobs or only assigned jobs for workers?
- **Current Behavior:** "Cleaning Jobs" shows all jobs (API returns all)
- **My Jobs Behavior:** Shows only assigned jobs (filtered)
- **Recommendation:** Keep both tabs but clarify purpose:
  - "Cleaning Jobs" = All jobs (read-only, for context)
  - "My Jobs" = Assigned jobs (with actions)

**Alternative Fix:**
Hide "Cleaning Jobs" tab for workers, only show for admins:

```jsx
{(isMaster || isAdmin) && (
  <button onClick={() => setActiveTab('cleaningJobs')}>
    Cleaning Jobs
  </button>
)}
```

**Test Coverage:**
- [ ] E2E test: Worker sees "My Jobs" but not "Cleaning Jobs"
- [ ] E2E test: Admin sees both tabs
- [ ] Manual test: Verify RBAC is correct

**Acceptance Criteria:**
- ✅ Consistent UX across tabs
- ✅ RBAC enforced (workers only see assigned jobs with actions)
- ✅ Documentation updated (explain tab purposes)

**Priority Justification:**
- Workaround exists ("My Jobs" tab)
- No business impact (functionality accessible)
- Nice-to-have UX improvement
- Can be addressed in future sprint

**Assigned To:** Backlog
**Target Resolution:** TBD (future sprint)

---

## Bug Summary Statistics

| Priority | Count | % Total |
|----------|-------|---------|
| P0 (Critical) | 2 | 50% |
| P1 (High) | 1 | 25% |
| P2 (Low) | 1 | 25% |
| **Total** | **4** | **100%** |

| Component | Bug Count |
|-----------|-----------|
| Frontend (Dashboard.js) | 3 |
| Backend (server.js) | 1 |

| Status | Count |
|--------|-------|
| 🔴 Open - Scheduled | 3 |
| 🟢 Open - Backlog | 1 |
| ✅ Fixed | 0 |

---

## Bugs Fixed (Recently)

### ✅ BUG-FIXED-001: Multer Returns Generic 500 Instead of 400
**Fixed:** 2025-10-22
**PR:** [Baseline commit a726ce3]
**Severity:** P0 - Critical (when discovered)

**Problem:**
Uploading 11+ photos returned HTTP 500 with message "Something went wrong!" instead of proper 400 error with `BATCH_LIMIT_EXCEEDED` code.

**Fix:**
Added Multer error handler in [server.js:204-240](server.js#L204-L240) to catch `MulterError` and return standardized error envelopes.

**Result:**
- ✅ HTTP 400 returned for batch limit exceeded
- ✅ Proper error code `BATCH_LIMIT_EXCEEDED`
- ✅ Correlation ID included in error response
- ✅ Also handles file size limits (413 Payload Too Large)

**Test Coverage:**
- ✅ API test: Upload 11 photos → verify 400 with correct error code
- ✅ API test: Upload oversized file → verify 413 with FILE_TOO_LARGE

---

### ✅ BUG-FIXED-002: Seed Script Schema Mismatches
**Fixed:** 2025-10-22
**PR:** [Baseline commit a726ce3]
**Severity:** P1 - High (blocked testing)

**Problem:**
Test data seeding script used incorrect column names and enum values, causing database constraint violations.

**Issues Fixed:**
1. Used `category` column instead of `service_type` in laundry_services table
2. Used `apartment_cleaning` enum instead of valid `airbnb` value for job_type

**Fix:**
Updated [scripts/seed-test-data.js](scripts/seed-test-data.js):
- Lines 153-187: Changed `category` to `service_type`
- Line 213: Changed `apartment_cleaning` to `airbnb`

**Result:**
- ✅ Seed script runs without errors
- ✅ Test data created successfully
- ✅ E2E tests can use consistent test data

---

## Bug Triage Process

### Severity Definitions

| Level | Definition | Response Time | Examples |
|-------|------------|---------------|----------|
| **P0 - Critical** | System unusable, core features broken, data loss risk | <4 hours | Login broken, payment failure, data corruption |
| **P1 - High** | Major feature broken, workaround exists, security issue | <24 hours | Photo upload UI broken (API works), performance degradation |
| **P2 - Medium** | Minor feature broken, usability issue, cosmetic bug | <1 week | Inconsistent UI, missing validation message |
| **P3 - Low** | Nice-to-have, future enhancement, documentation | Backlog | Missing tooltip, color inconsistency |

### Triage Checklist

For each new bug:
1. **Reproduce:** Can you reproduce it consistently?
2. **Impact:** How many users affected? What's the business impact?
3. **Workaround:** Is there a workaround? How easy is it?
4. **Root Cause:** What's the likely root cause? Frontend/Backend/DB?
5. **Fix Complexity:** How hard is it to fix? Hours/days/weeks?
6. **Test Coverage:** What tests would catch this? Do they exist?
7. **Priority:** P0/P1/P2/P3 based on above factors
8. **Assignment:** Which PR or sprint should fix it?

---

## Next Actions

### Immediate (Today)
- [ ] **Start PR #1:** Fix tab navigation bug (BUG-001)
- [ ] **Start PR #2:** Fix View Details modal (BUG-002)
- [ ] **Schedule:** BUG-003 cleanup in PR #2 or PR #3

### This Week
- [ ] **Complete:** PRs #1, #2, #3
- [ ] **Verify:** All P0 bugs fixed and deployed
- [ ] **Retest:** E2E tests pass with bug fixes

### Future
- [ ] **Triage:** BUG-004 (low priority)
- [ ] **Document:** Bug fix process in CONTRIBUTING.md
- [ ] **Automate:** Bug template in GitHub Issues

---

**Document Version:** 1.0
**Last Updated:** 2025-10-22
**Next Review:** Daily (during PR work)

**Generated with Claude Code** 🤖

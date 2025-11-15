# Tester Prompt: Validate P0 Login Fix

## 🚨 CRITICAL: Validate Login Redirect for All User Roles

**Your Task**: Once the Developer completes the login redirect fix, perform comprehensive validation to ensure the system is working correctly before user testing.

---

## Context

The Maestro agent discovered via browser automation that **login is completely broken** for all user roles. After successful authentication:
- Backend creates session ✅
- Frontend DOES NOT redirect to dashboard ❌
- Users are stuck on login page ❌

The Developer has been tasked with fixing this P0 blocker. Your job is to validate the fix.

---

## Pre-Test Checklist

Before starting tests, verify:

- [ ] Developer has marked their PR as "Ready for Review"
- [ ] Developer has provided fix commit SHA or branch name
- [ ] Backend server is running: `docker-compose ps` shows `lavandaria-app` and `lavandaria-db` healthy
- [ ] Frontend build is current: `cd client && npm run build` (if testing production build)
- [ ] Database has seed data: `npm run test:seed` (if needed)

---

## Test Credentials

Use these seeded test accounts:

| Role | Login Type | Username/Phone | Password |
|------|------------|----------------|----------|
| Master | Staff | `master` | `master123` |
| Admin | Staff | `admin` | `admin123` |
| Worker | Staff | `worker1` | `worker123` |
| Client | Client | `911111111` | `lavandaria2025` |

---

## Manual Validation Tests

### Test 1: Master User Login Flow

**Steps**:
1. Open http://localhost:3000 in **fresh incognito window**
2. Verify landing page loads with "Welcome Back" heading
3. Click "Staff" tab
4. Enter username: `master`
5. Enter password: `master123`
6. Click "Login" button
7. **WAIT** - Should redirect within 2 seconds

**Expected Result**:
- ✅ URL changes to `http://localhost:3000/dashboard`
- ✅ Dashboard page displays
- ✅ User name visible: "Master User" or "master"
- ✅ No error messages
- ✅ No infinite loading spinner

**If Test Fails**:
- Screenshot the page state after clicking Login
- Open DevTools Console and copy all logs
- Open DevTools Network tab and export as HAR file
- Report to Developer with evidence

---

### Test 2: Admin User Login Flow

**Steps**:
1. Open http://localhost:3000 in **fresh incognito window**
2. Click "Staff" tab
3. Enter username: `admin`
4. Enter password: `admin123`
5. Click "Login" button

**Expected Result**:
- ✅ Redirects to `/dashboard`
- ✅ Shows "Admin User" or similar
- ✅ Admin-specific content visible (if applicable)

---

### Test 3: Worker User Login Flow

**Steps**:
1. Open http://localhost:3000 in **fresh incognito window**
2. Click "Staff" tab
3. Enter username: `worker1`
4. Enter password: `worker123`
5. Click "Login" button

**Expected Result**:
- ✅ Redirects to `/dashboard`
- ✅ Shows worker name
- ✅ Worker-specific UI elements visible (e.g., "My Jobs")

---

### Test 4: Client User Login Flow

**Steps**:
1. Open http://localhost:3000 in **fresh incognito window**
2. **DO NOT** click Staff tab (stay on Client tab)
3. Enter phone: `911111111`
4. Enter password: `lavandaria2025`
5. Click "Login" button

**Expected Result**:
- ✅ Redirects to `/dashboard`
- ✅ Shows client name or phone
- ✅ Client-specific UI (read-only, no admin features)

---

### Test 5: Session Persistence (Refresh)

**Steps**:
1. Login as Master user (follow Test 1)
2. Verify dashboard loads successfully
3. Press F5 (or Cmd+R) to refresh page
4. Wait for page reload

**Expected Result**:
- ✅ Page reloads and stays on `/dashboard`
- ✅ User still authenticated (not redirected to login)
- ✅ User info still visible

**If Test Fails**:
- This indicates session cookies aren't persisting
- Report: "Session lost after page refresh"

---

### Test 6: Invalid Credentials

**Steps**:
1. Open http://localhost:3000 in fresh incognito window
2. Click "Staff" tab
3. Enter username: `master`
4. Enter password: `wrongpassword`
5. Click "Login" button

**Expected Result**:
- ❌ Does NOT redirect to dashboard
- ✅ Stays on login page
- ✅ Shows error message: "Invalid credentials" or similar
- ✅ Error message styled in red

---

### Test 7: Direct Dashboard Access (Not Logged In)

**Steps**:
1. Open http://localhost:3000 in fresh incognito window
2. Manually navigate to: http://localhost:3000/dashboard

**Expected Result**:
- ❌ Dashboard does NOT load
- ✅ Redirects back to http://localhost:3000/
- ✅ Shows login page

---

### Test 8: Logout and Re-login

**Steps**:
1. Login as Master user (follow Test 1)
2. Verify dashboard loads
3. Click "Logout" button (if visible in UI)
4. Verify redirected to login page
5. Login again with same credentials

**Expected Result**:
- ✅ First login succeeds
- ✅ Logout clears session
- ✅ Second login also succeeds

---

## Automated E2E Test Validation

The Developer should have created this test file:
`tests/e2e/login-all-roles.spec.js`

### Run E2E Tests

```bash
# Headless mode (CI)
npx playwright test tests/e2e/login-all-roles.spec.js

# Headed mode (watch browser)
npx playwright test tests/e2e/login-all-roles.spec.js --headed

# With trace for debugging
npx playwright test tests/e2e/login-all-roles.spec.js --trace on
```

**Expected Output**:
```
Running 5 tests using 1 worker

  ✓  [chromium] › login-all-roles.spec.js:5:3 › Master login redirects to dashboard (2.3s)
  ✓  [chromium] › login-all-roles.spec.js:15:3 › Admin login redirects to dashboard (1.8s)
  ✓  [chromium] › login-all-roles.spec.js:25:3 › Worker login redirects to dashboard (1.9s)
  ✓  [chromium] › login-all-roles.spec.js:35:3 › Client login redirects to dashboard (2.1s)
  ✓  [chromium] › login-all-roles.spec.js:45:3 › Session persists after page refresh (3.2s)

  5 passed (11.3s)
```

**If Any Test Fails**:
```bash
# View test report
npx playwright show-report

# Export failure evidence
npx playwright test tests/e2e/login-all-roles.spec.js --trace on
# Trace files saved to: test-results/*/trace.zip
```

Report failures to Developer with:
- Test name that failed
- Error message
- Trace file (upload to GitHub PR)

---

## Browser Compatibility Testing

Test login flow in multiple browsers:

### Chrome/Chromium
```bash
npx playwright test login-all-roles.spec.js --project=chromium
```

### Firefox
```bash
npx playwright test login-all-roles.spec.js --project=firefox
```

### WebKit (Safari)
```bash
npx playwright test login-all-roles.spec.js --project=webkit
```

**Expected**: All tests pass in all browsers

---

## Network Inspection (DevTools)

### What to Check

Open browser DevTools (F12) → Network tab during login:

**Request #1: POST /api/auth/login/user**
- Status: `200 OK`
- Response Headers: Should include `Set-Cookie: connect.sid=...`
- Response Body: `{ "success": true, "data": { "userId": 1, "userType": "master" }, "_meta": {...} }`

**Request #2: GET /api/auth/check** (automatic after login)
- Status: `200 OK`
- Request Headers: Should include `Cookie: connect.sid=...`
- Response Body: `{ "success": true, "data": { "authenticated": true, "userType": "master", ... } }`

**Red Flags**:
- ❌ No `Set-Cookie` header in login response → Backend session issue
- ❌ No `Cookie` header in auth check request → Frontend axios config issue
- ❌ `403 Forbidden` or `401 Unauthorized` → RBAC issue
- ❌ `500 Server Error` → Backend crash (check Docker logs)

---

## Console Log Inspection

Developer should have added diagnostic logs. During login, Console should show:

**Expected Console Output** (from Developer's instrumentation):
```
🔐 [AuthContext] login() called
  - isClient: false
  - credentials: { username: 'master', password: '***' }
📡 [AuthContext] Calling endpoint: /api/auth/login/user
✅ [AuthContext] Login response: { success: true, data: { userId: 1, userType: 'master' } }
🔍 [AuthContext] Calling checkAuth()...
🔍 [AuthContext] checkAuth() called
📡 [AuthContext] /api/auth/check response: { success: true, data: { authenticated: true, ... } }
✅ [AuthContext] Auth check passed, setting user state to: { authenticated: true, userType: 'master', ... }
✅ [AuthContext] User state updated
✅ [AuthContext] checkAuth() completed
🔄 [AuthContext] User state changed: { authenticated: true, userType: 'master', ... }
```

**If logs differ**:
- Screenshot full console output
- Report deviation to Developer

---

## Performance Testing

### Login Speed

Measure time from clicking "Login" button to dashboard appearing:

**Acceptable**: < 2 seconds
**Good**: < 1 second
**Excellent**: < 500ms

**If > 3 seconds**:
- Report as performance issue
- Developer should investigate slow DB queries or network delays

---

## Accessibility Testing

### Keyboard Navigation

**Steps**:
1. Open http://localhost:3000
2. **DO NOT** use mouse
3. Press `Tab` repeatedly to navigate form
4. Use `Arrow Keys` to switch between Client/Staff tabs
5. Press `Enter` on "Login" button

**Expected Result**:
- ✅ All form elements accessible via keyboard
- ✅ Login succeeds when pressing Enter
- ✅ Redirects to dashboard

---

## Mobile/Responsive Testing

### Test on Mobile Viewport

**Browser DevTools**:
1. Open DevTools (F12)
2. Click "Toggle device toolbar" (Ctrl+Shift+M)
3. Select "iPhone 12 Pro" or "Pixel 5"
4. Test login flow

**Expected Result**:
- ✅ Login form fits screen (no horizontal scroll)
- ✅ Buttons are tappable (min 44x44px)
- ✅ Text is readable (min 16px font)
- ✅ Login works correctly

---

## Acceptance Criteria Checklist

After all tests, verify these criteria are met:

- [ ] Master login → dashboard redirect ✅
- [ ] Admin login → dashboard redirect ✅
- [ ] Worker login → dashboard redirect ✅
- [ ] Client login → dashboard redirect ✅
- [ ] Session persists after page refresh ✅
- [ ] Invalid credentials show error message ✅
- [ ] Direct dashboard access without login blocked ✅
- [ ] Logout clears session ✅
- [ ] All E2E tests passing ✅
- [ ] Works in Chrome, Firefox, Safari ✅
- [ ] No console errors ✅
- [ ] No network errors (4xx, 5xx) ✅
- [ ] Login completes in < 2 seconds ✅
- [ ] Keyboard navigation works ✅
- [ ] Mobile responsive ✅

---

## Test Report Template

**Copy this template and fill in results**:

```markdown
# Test Report: P0 Login Redirect Fix Validation

**Tested by**: [Your Name]
**Date**: 2025-11-08
**Developer PR**: #[PR_NUMBER]
**Commit SHA**: [COMMIT_HASH]

## Manual Test Results

| Test | Status | Notes |
|------|--------|-------|
| Master Login | ✅ PASS | Redirected in 1.2s |
| Admin Login | ✅ PASS | Redirected in 1.1s |
| Worker Login | ✅ PASS | Redirected in 1.0s |
| Client Login | ✅ PASS | Redirected in 1.3s |
| Session Persistence | ✅ PASS | Survived page refresh |
| Invalid Credentials | ✅ PASS | Error shown correctly |
| Unauthorized Access | ✅ PASS | Redirected to login |
| Logout | ✅ PASS | Session cleared |

## E2E Test Results

```
5 passed (11.3s)
```

## Browser Compatibility

- ✅ Chrome 120
- ✅ Firefox 121
- ✅ Safari 17

## Performance

- Average login time: 1.15s ✅

## Issues Found

[None / List any issues with screenshots]

## Recommendation

✅ **APPROVE** - All tests passing, ready for production
❌ **REJECT** - [List blocking issues]
```

---

## What to Do If Tests Fail

### Immediate Actions

1. **Document the failure**:
   - Screenshot the failure state
   - Copy full console logs
   - Export Network tab as HAR file
   - Note exact steps to reproduce

2. **Gather diagnostic data**:
   ```bash
   # Backend logs
   docker-compose logs app --tail=100 > logs/backend-$(date +%Y%m%d_%H%M%S).log

   # Database sessions
   docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT * FROM session ORDER BY expire DESC LIMIT 10;" > logs/sessions-$(date +%Y%m%d_%H%M%S).log

   # Frontend build
   cd client && npm run build 2>&1 | tee ../logs/frontend-build-$(date +%Y%m%d_%H%M%S).log
   ```

3. **Report to Developer**:
   - Create GitHub issue or comment on PR
   - Attach all evidence files
   - Mark PR as "Changes Requested"

### Developer Handback Format

```markdown
## Test Failure Report

**Test**: [Name of failed test]
**Failure Type**: [Redirect not working / Error message / Console error / etc.]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Actual result]

### Expected Behavior
[What should have happened]

### Evidence
- Screenshot: [attach]
- Console logs: [attach]
- Network HAR: [attach]
- Backend logs: [attach]

### Environment
- Browser: Chrome 120
- OS: macOS 14
- Frontend: localhost:3000
- Backend: Docker container lavandaria-app
```

---

## Timeline

- **Test Duration**: 1-2 hours
- **Report Writing**: 30 minutes
- **Total**: 2-3 hours maximum

---

## Questions?

If you encounter unexpected behavior not covered in this document:

1. Try to reproduce in different browser
2. Check if issue exists before Developer's fix (checkout main branch)
3. Document the unexpected behavior with screenshots
4. Ask Developer or Maestro for guidance

---

**Priority**: P0 - Block all other testing until this passes
**Blocker**: This fix unlocks all subsequent development/testing
**Expected completion**: Today (2025-11-08)

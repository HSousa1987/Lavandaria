# Bugs & Fixes

This log tracks bugs discovered, their root causes, fixes applied, and tests added to prevent regression.

**Format:** Date | Evidence | Root Cause | Fix | Tests | Links

---

## Active Bugs

*None currently tracked*

---

## Resolved Bugs

### 2025-10-22 - Tab Navigation Not Working in Dashboard

**Evidence:**
- Tab key navigation not working in admin dashboard
- Screenshot: `.playwright-mcp/tab-navigation-bug-before-fix.png`
- Accessibility issue affecting keyboard users

**Root Cause:**
- ARIA attributes removed during React component refactoring
- `tabIndex` attributes missing from interactive elements
- Playwright accessibility tree couldn't find focusable elements

**Fix Applied:**
- Restored ARIA attributes (`role`, `aria-label`, `aria-selected`)
- Added `tabIndex={0}` to tab buttons
- Fixed focus management in modal dialogs
- Commit: `38c2e85`

**Tests Added:**
- E2E test: `tests/e2e/debug-tab-navigation.spec.js`
- Validates tab navigation with Playwright
- Checks ARIA attributes presence
- Verifies focus order

**Screenshot After Fix:**
- `.playwright-mcp/tab-navigation-fixed.png`

**PR:**
- Branch: `fix/tab-navigation`
- Status: Merged

---

## Template for New Bugs

```markdown
### YYYY-MM-DD - Bug Title

**Evidence:**
- How was it discovered?
- Error messages, screenshots, logs
- Correlation IDs for debugging
- User reports or automated test failures

**Root Cause:**
- What caused the bug?
- Why did it happen?
- Was it a regression? From what change?

**Fix Applied:**
- What changes were made?
- File(s) modified
- Commit SHA
- Configuration changes

**Tests Added:**
- Unit tests added
- E2E tests added
- Manual test procedures
- How to verify the fix

**Prevention:**
- Process improvements
- Code review checklist items
- Automated checks added

**Links:**
- PR: [#X](url)
- Related Issues: [#Y](url)
- Correlation IDs: req_1234...
```

---

## Bug Prevention Checklist

When implementing new features, verify:

- [ ] **Authentication**: All endpoints require appropriate auth middleware
- [ ] **Authorization**: RBAC enforced (workers see only assigned jobs)
- [ ] **Input Validation**: express-validator chains added
- [ ] **SQL Injection**: Parameterized queries ($1, $2, etc.)
- [ ] **File Uploads**: Type, size, extension checks
- [ ] **Error Handling**: Proper try/catch with correlation IDs
- [ ] **Response Format**: Standard envelope pattern
- [ ] **Rate Limiting**: Applied to sensitive endpoints
- [ ] **CORS**: Whitelist validated
- [ ] **Session Security**: HTTP-only, SameSite cookies
- [ ] **Accessibility**: ARIA attributes, keyboard navigation
- [ ] **E2E Tests**: Playwright tests cover new functionality
- [ ] **Database Constraints**: CHECK constraints for valid values
- [ ] **Foreign Keys**: Proper CASCADE/SET NULL policies

---

## Common Bug Patterns

### Authentication Bypass
**Symptom:** Unauthenticated users accessing protected routes
**Root Cause:** Missing auth middleware
**Fix:** Add `requireAuth`, `requireStaff`, or role-specific middleware
**Test:** Verify 401 response without session cookie

### RBAC Violation
**Symptom:** Workers seeing unassigned jobs
**Root Cause:** Missing WHERE clause filtering
**Fix:** Add role-specific query filters
**Test:** Verify workers only see assigned resources

### SQL Injection
**Symptom:** SQL errors with user input
**Root Cause:** String concatenation in queries
**Fix:** Use parameterized queries ($1, $2, etc.)
**Test:** Inject SQL payloads, verify sanitization

### File Upload Exploits
**Symptom:** Unexpected file types uploaded
**Root Cause:** Missing fileFilter in multer config
**Fix:** Add type/extension validation
**Test:** Upload non-image files, verify rejection

### Session Issues
**Symptom:** Users logged out unexpectedly
**Root Cause:** Weak SESSION_SECRET or memory store
**Fix:** Strong secret (32+ chars), PostgreSQL session store
**Test:** Restart container, verify session persistence

### CORS Errors
**Symptom:** Browser blocks cross-origin requests
**Root Cause:** Missing origin in CORS_ORIGINS
**Fix:** Add origin to whitelist
**Test:** Request from different origin, verify Access-Control headers

---

## Debugging Resources

**Correlation IDs:**
```bash
# Find all requests with correlation ID
docker-compose logs -f app | grep "req_1729..."
```

**Database Session Debugging:**
```sql
-- View active sessions
SELECT * FROM session;

-- Count sessions by user type
SELECT
  sess::json->'userType' as user_type,
  COUNT(*)
FROM session
GROUP BY user_type;
```

**Health Check Debugging:**
```bash
# Check liveness
curl http://localhost:3000/api/healthz

# Check readiness (includes DB latency)
curl http://localhost:3000/api/readyz
```

**E2E Test Artifacts:**
```bash
# View Playwright HTML report
npm run test:e2e:report

# Replay trace in UI
npm run test:e2e:ui

# Check screenshots
ls -la test-results/
```

---

**Document Maintenance:** Update this file when:
- New bug discovered
- Bug fixed
- Common pattern identified
- Prevention checklist updated

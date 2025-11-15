# Developer Prompt: Fix P0 Login Redirect Failure

## 🚨 URGENT: Critical Blocker - Login Broken for All Users

**Your Task**: Diagnose and fix the login redirect failure that prevents ALL users (Master/Admin/Worker/Client) from accessing the dashboard after successful authentication.

---

## Context

The Maestro agent performed a browser automation test attempting to log in as the `master` user. Here's what was discovered:

### ✅ What's Working (Backend)
- Login POST request succeeds (200 OK)
- Session created in database
- Backend logs: `✅ [AUTH] Login successful for user: master`
- `/api/auth/check` returns `authenticated: true` with correct user data

### ❌ What's Broken (Frontend)
- Page does NOT redirect to `/dashboard` after login
- React AuthContext `user` state remains `null`
- ProtectedRoute blocks dashboard access (no user state)
- Manual navigation to `/dashboard` redirects back to `/`

---

## Your Mission

1. **Add diagnostic logging** to AuthContext to trace the exact failure point
2. **Identify root cause** - Why is `setUser()` not updating the React state?
3. **Implement fix** - Restore login → dashboard redirect flow
4. **Test all 4 user roles** - Master, Admin, Worker, Client
5. **Create E2E test** - Prevent regression

---

## Step-by-Step Instructions

### STEP 1: Add Diagnostic Logging

**File to edit**: `client/src/context/AuthContext.js`

Add console.log statements to trace execution flow:

```javascript
const checkAuth = async () => {
    try {
      console.log('🔍 [AuthContext] checkAuth() called');
      const response = await axios.get('/api/auth/check');
      console.log('📡 [AuthContext] /api/auth/check response:', response.data);
      console.log('  - response.status:', response.status);
      console.log('  - response.data.success:', response.data.success);
      console.log('  - response.data.data:', response.data.data);
      console.log('  - response.data.data?.authenticated:', response.data.data?.authenticated);

      if (response.data.success && response.data.data?.authenticated) {
        console.log('✅ [AuthContext] Auth check passed, setting user state to:', response.data.data);
        setUser(response.data.data);
        console.log('✅ [AuthContext] User state updated');
      } else {
        console.warn('⚠️  [AuthContext] Auth check failed - condition not met');
        console.warn('  - success:', response.data.success);
        console.warn('  - authenticated:', response.data.data?.authenticated);
      }
    } catch (error) {
      console.error('❌ [AuthContext] Auth check error:', error);
      console.error('  - error.response?.status:', error.response?.status);
      console.error('  - error.response?.data:', error.response?.data);
      console.error('  - error.message:', error.message);
    } finally {
      setLoading(false);
    }
};

const login = async (credentials, isClient = false) => {
    console.log('🔐 [AuthContext] login() called');
    console.log('  - isClient:', isClient);
    console.log('  - credentials:', { ...credentials, password: '***' });

    const endpoint = isClient ? '/api/auth/login/client' : '/api/auth/login/user';
    console.log('📡 [AuthContext] Calling endpoint:', endpoint);

    const response = await axios.post(endpoint, credentials);
    console.log('✅ [AuthContext] Login response:', response.data);
    console.log('  - status:', response.status);

    console.log('🔍 [AuthContext] Calling checkAuth()...');
    await checkAuth();
    console.log('✅ [AuthContext] checkAuth() completed');

    return response.data;
};
```

Also add logging to the useEffect hook:

```javascript
useEffect(() => {
    console.log('🔄 [AuthContext] User state changed:', user);
}, [user]);
```

### STEP 2: Test with Logging Enabled

```bash
# Terminal 1: Ensure backend is running
npm run server

# Terminal 2: Start frontend dev server
cd client && npm start
```

**Browser Test**:
1. Open http://localhost:3000 in a **fresh incognito window**
2. Open DevTools Console (F12 → Console tab)
3. Also open Network tab to monitor requests
4. Click "Staff" tab
5. Enter credentials: `master` / `master123`
6. Click "Login"
7. **Observe console output** - capture ALL logs

**Expected Flow**:
```
🔐 [AuthContext] login() called
  - isClient: false
  - credentials: { username: 'master', password: '***' }
📡 [AuthContext] Calling endpoint: /api/auth/login/user
✅ [AuthContext] Login response: { success: true, data: { userId: 1, ... } }
🔍 [AuthContext] Calling checkAuth()...
🔍 [AuthContext] checkAuth() called
📡 [AuthContext] /api/auth/check response: { success: true, data: { authenticated: true, ... } }
✅ [AuthContext] Auth check passed, setting user state to: { authenticated: true, userType: 'master', ... }
✅ [AuthContext] User state updated
✅ [AuthContext] checkAuth() completed
🔄 [AuthContext] User state changed: { authenticated: true, userType: 'master', ... }
```

**If flow is different**, document EXACTLY where it deviates.

### STEP 3: Check Network Tab

In browser Network tab, verify:

**Request #1: POST /api/auth/login/user**
- Request Headers: Should include `Content-Type: application/json`
- Request Payload: `{ "username": "master", "password": "master123" }`
- Response Status: `200 OK`
- Response Headers: Should include `Set-Cookie: connect.sid=...`
- Response Body: `{ "success": true, "data": { ... }, "_meta": { ... } }`

**Request #2: GET /api/auth/check** (should happen automatically after login)
- Request Headers: Should include `Cookie: connect.sid=...`
- Response Status: `200 OK`
- Response Body: `{ "success": true, "data": { "authenticated": true, ... } }`

**Red Flag #1**: If `Set-Cookie` header is missing → backend session issue
**Red Flag #2**: If `Cookie` header is missing in #2 → axios credentials issue
**Red Flag #3**: If `/api/auth/check` returns `success: false` → session not persisting

### STEP 4: Verify axios Configuration

Check that `axios.defaults.withCredentials` is set **before** any requests:

```javascript
// client/src/context/AuthContext.js (top of file)
import axios from 'axios';

// Configure axios to send cookies with requests
axios.defaults.withCredentials = true;
console.log('⚙️  [AuthContext] axios.defaults.withCredentials =', axios.defaults.withCredentials);
```

**Also check** if there's a global axios config in `client/src/index.js` or `client/src/App.js`.

### STEP 5: Verify CORS Configuration

**File**: `server.js`

Ensure CORS middleware allows credentials:

```javascript
app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true  // ← MUST be true for cookies
}));
```

Run this test:

```bash
curl -v http://localhost:3000/api/auth/check \
  -H "Origin: http://localhost:3000" \
  2>&1 | grep -i "access-control"
```

Expected output:
```
< Access-Control-Allow-Origin: http://localhost:3000
< Access-Control-Allow-Credentials: true
```

### STEP 6: Check Session Configuration

**File**: `server.js`

Verify session middleware:

```javascript
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,  // ← Should be false in development (no HTTPS)
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));
```

Verify `.env` file has:
```
SESSION_SECRET=<your-secret-here>
NODE_ENV=development
```

### STEP 7: Possible Fixes

Based on your diagnostic logs, apply the appropriate fix:

#### Fix A: State Update Issue (React batching)

If logs show `setUser()` called but state not updating:

```javascript
// Force state update by creating new object
setUser({ ...response.data.data });

// OR use callback form
setUser(prev => response.data.data);
```

#### Fix B: Response Structure Mismatch

If `response.data.data` is undefined:

```javascript
// Add null check and fallback
const userData = response.data?.data || response.data;
if (response.data.success && userData?.authenticated) {
  setUser(userData);
}
```

#### Fix C: Axios Credentials Not Sent

If cookies aren't being sent with requests:

```javascript
// Set withCredentials per-request instead of globally
const response = await axios.get('/api/auth/check', {
  withCredentials: true
});
```

#### Fix D: CORS Blocking Credentials

If CORS headers missing:

```javascript
// server.js - Update CORS config
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],  // Include dev server port
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### STEP 8: Create E2E Test

**File to create**: `tests/e2e/login-all-roles.spec.js`

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Login Redirect - All User Roles', () => {

  test('Master login redirects to dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByRole('button', { name: 'Staff' }).click();
    await page.getByPlaceholder('Enter your username').fill('master');
    await page.getByPlaceholder('Enter your password').fill('master123');
    await page.getByRole('button', { name: 'Login' }).click();

    // Should redirect to dashboard within 5 seconds
    await page.waitForURL('http://localhost:3000/dashboard', { timeout: 5000 });

    // Dashboard should show user info
    await expect(page.getByText(/Master User/i)).toBeVisible({ timeout: 3000 });
  });

  test('Admin login redirects to dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByRole('button', { name: 'Staff' }).click();
    await page.getByPlaceholder('Enter your username').fill('admin');
    await page.getByPlaceholder('Enter your password').fill('admin123');
    await page.getByRole('button', { name: 'Login' }).click();

    await page.waitForURL('http://localhost:3000/dashboard', { timeout: 5000 });
    await expect(page.getByText(/Admin User/i)).toBeVisible({ timeout: 3000 });
  });

  test('Worker login redirects to dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByRole('button', { name: 'Staff' }).click();
    await page.getByPlaceholder('Enter your username').fill('worker1');
    await page.getByPlaceholder('Enter your password').fill('worker123');
    await page.getByRole('button', { name: 'Login' }).click();

    await page.waitForURL('http://localhost:3000/dashboard', { timeout: 5000 });
    await expect(page.getByText(/Worker/i)).toBeVisible({ timeout: 3000 });
  });

  test('Client login redirects to dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByRole('button', { name: 'Client' }).click();
    await page.getByPlaceholder(/phone/i).fill('911111111');
    await page.getByPlaceholder(/password/i).fill('lavandaria2025');
    await page.getByRole('button', { name: 'Login' }).click();

    await page.waitForURL('http://localhost:3000/dashboard', { timeout: 5000 });
    await expect(page.locator('h1, h2').filter({ hasText: /dashboard|welcome/i })).toBeVisible({ timeout: 3000 });
  });

  test('Session persists after page refresh', async ({ page }) => {
    // Login as master
    await page.goto('http://localhost:3000');
    await page.getByRole('button', { name: 'Staff' }).click();
    await page.getByPlaceholder('Enter your username').fill('master');
    await page.getByPlaceholder('Enter your password').fill('master123');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('http://localhost:3000/dashboard', { timeout: 5000 });

    // Refresh page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL('http://localhost:3000/dashboard');
    await expect(page.getByText(/Master User/i)).toBeVisible({ timeout: 3000 });
  });
});
```

**Run the test**:
```bash
npx playwright test tests/e2e/login-all-roles.spec.js --headed
```

---

## Deliverables

When you respond, provide:

1. **Diagnostic Report**
   - Console logs from Step 2 (copy-paste full output)
   - Network tab screenshots (login POST + auth check GET)
   - Exact failure point identified

2. **Root Cause**
   - What was broken?
   - Why was it broken?
   - Evidence (logs, screenshots, code references)

3. **Fix Implementation**
   - Files modified
   - Code changes with inline comments
   - Explanation of fix

4. **Test Results**
   - Manual test: Screenshot/video of successful login flow (all 4 roles)
   - E2E test: Output of `npx playwright test login-all-roles.spec.js`
   - All tests passing: ✅

5. **PR Creation**
   - Branch: `fix/p0-login-redirect-failure`
   - Commit message: `fix(P0): restore login redirect to dashboard for all user roles`
   - PR description with before/after comparison

---

## Related Documentation

- [URGENT-P0-login-redirect-failure.md](handoff/URGENT-P0-login-redirect-failure.md) - Full technical analysis
- [CLAUDE.md](CLAUDE.md) - Session configuration and auth patterns
- [docs/architecture.md](docs/architecture.md) - Auth flow diagrams

---

## Time Estimate

- Diagnosis: 30-60 minutes
- Fix implementation: 30-60 minutes
- Testing: 30 minutes
- **Total: 2-3 hours**

---

## Need Help?

If stuck after 1 hour, respond with:
- Console logs captured so far
- Network tab screenshots
- Specific error message or unexpected behavior
- What you've tried

Maestro will provide additional guidance.

---

**Priority**: P0 - Drop everything else
**Blocking**: All user workflows
**Expected completion**: Today (2025-11-08)

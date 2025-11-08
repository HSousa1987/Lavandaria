# Authentication Flows - Login-First UX

**Last Updated**: 2025-10-23
**UX Pattern**: Login-first (form visible by default)

This document describes the authentication journey for all user roles in the Lavandaria application, aligned with the current login-first UX design.

---

## Design Principles

1. **Login-First UX**: Landing page (`/`) shows the login form immediately (no toggle button click required)
2. **Unified Post-Login Route**: All authenticated users navigate to `/dashboard` after successful login
3. **Role-Based Dashboard**: Dashboard content adapts based on user role (Client vs. Staff)
4. **Tab-Based Navigation**: Staff users (Master/Admin/Worker) access role-specific features via dashboard tabs

---

## Landing Page Structure

The landing page contains:
- Header with logo and "Back" button (to toggle marketing view when clicked)
- Login form with two tabs:
  - **Client** tab (default): Phone number + password fields
  - **Staff** tab: Username + password fields
- Submit button (`type="submit"`)
- Footer with default password hint

**State**: `showLogin = true` by default (changed from `false` on 2025-10-23)

---

## Role: Client

### Credentials
- **Identifier**: Phone number (e.g., `911111111`)
- **Password**: `lavandaria2025` (default seed password)
- **Database Table**: `clients`

### Login Flow
1. Navigate to `/`
2. Login form is visible by default
3. Click "Client" tab (already selected by default)
4. Fill `input[name="phone"]` with phone number
5. Fill `input[name="password"]` with password
6. Click `button[type="submit"]`
7. **Navigate to**: `/dashboard`
8. **Session Created**: `connect.sid` cookie (HTTP-only)

### Post-Login: Dashboard View
- Header: "Welcome, [Full Name] (client)"
- Tabs visible:
  - **Overview** (default)
  - **All Jobs**
  - **Cleaning Jobs**
  - **Laundry Orders**
- Logout button (top-right)

### First Protected API Request
After login, the first API call to fetch dashboard data:
```bash
GET /api/cleaning-jobs?limit=10
Authorization: Session cookie
```

**Response Envelope**:
```json
{
  "data": [...],
  "_meta": {
    "correlationId": "req_1729...",
    "timestamp": "2025-10-23T...",
    "pagination": { ... }
  }
}
```

---

## Role: Worker

### Credentials
- **Username**: `worker1`
- **Password**: `worker123` (from seed script)
- **Database Table**: `users` (role='worker')

### Login Flow
1. Navigate to `/`
2. Login form is visible by default
3. Click "Staff" tab
4. Fill `input[name="username"]` with username
5. Fill `input[name="password"]` with password
6. Click `button[type="submit"]`
7. **Navigate to**: `/dashboard`
8. **Session Created**: `connect.sid` cookie (HTTP-only)

### Post-Login: Dashboard View
- Header: "Welcome, [Full Name]"
- Tabs visible:
  - **Overview** (default)
  - **My Jobs** (worker-specific)
  - **Cleaning Jobs**
  - **Laundry Orders**
- Logout button (top-right)

### Permissions
- ✅ Can view assigned cleaning jobs
- ✅ Can upload photos to assigned jobs
- ✅ Can view laundry orders
- ❌ Cannot access finance routes (`/api/payments`, `/api/dashboard`)
- ❌ Cannot manage users

### First Protected API Request
```bash
GET /api/cleaning-jobs?assignedTo=me
Authorization: Session cookie
```

**Response Envelope**:
```json
{
  "data": [...],
  "_meta": {
    "correlationId": "req_1729...",
    "timestamp": "2025-10-23T...",
    "user": {
      "id": 3,
      "username": "worker1",
      "userType": "worker",
      "role": "worker"
    }
  }
}
```

---

## Role: Admin

### Credentials
- **Username**: `admin`
- **Password**: `admin123` (from seed script)
- **Database Table**: `users` (role='admin')

### Login Flow
1. Navigate to `/`
2. Login form is visible by default
3. Click "Staff" tab
4. Fill `input[name="username"]` with username
5. Fill `input[name="password"]` with password
6. Click `button[type="submit"]`
7. **Navigate to**: `/dashboard`
8. **Session Created**: `connect.sid` cookie (HTTP-only)

### Post-Login: Dashboard View
- Header: "Welcome, Administrator"
- Tabs visible:
  - **Overview** (default)
  - **All Jobs**
  - **Cleaning Jobs**
  - **Laundry Orders**
  - **Finance** (admin-only)
  - **Users** (admin-only)
- Logout button (top-right)

### Permissions
- ✅ Can view all cleaning jobs
- ✅ Can manage users (create workers)
- ✅ Can access finance routes (`/api/payments`, `/api/dashboard`)
- ✅ Can view payment splits
- ❌ Cannot delete master user
- ❌ Cannot promote to master role

### First Protected API Request
```bash
GET /api/dashboard
Authorization: Session cookie
```

**Response Envelope**:
```json
{
  "data": {
    "totalRevenue": 12450.00,
    "pendingPayments": 3,
    "activeJobs": 7
  },
  "_meta": {
    "correlationId": "req_1729...",
    "timestamp": "2025-10-23T...",
    "user": {
      "id": 2,
      "username": "admin",
      "userType": "admin",
      "role": "admin"
    }
  }
}
```

---

## Role: Master

### Credentials
- **Username**: `master`
- **Password**: `master123` (from seed script)
- **Database Table**: `users` (role='master')

### Login Flow
1. Navigate to `/`
2. Login form is visible by default
3. Click "Staff" tab
4. Fill `input[name="username"]` with username
5. Fill `input[name="password"]` with password
6. Click `button[type="submit"]`
7. **Navigate to**: `/dashboard`
8. **Session Created**: `connect.sid` cookie (HTTP-only)

### Post-Login: Dashboard View
- Header: "Welcome, Master Admin"
- Tabs visible:
  - **Overview** (default)
  - **All Jobs**
  - **Cleaning Jobs**
  - **Laundry Orders**
  - **Finance** (all access)
  - **Users** (can promote to admin)
  - **Settings** (master-only)
- Logout button (top-right)

### Permissions
- ✅ Full access to all routes
- ✅ Can create/delete all users including admins
- ✅ Can promote users to admin role
- ✅ Can access all finance data
- ✅ Can modify system settings

### First Protected API Request
```bash
GET /api/users
Authorization: Session cookie
```

**Response Envelope**:
```json
{
  "data": [
    {
      "id": 1,
      "username": "master",
      "role": "master",
      "full_name": "Master Admin"
    },
    ...
  ],
  "_meta": {
    "correlationId": "req_1729...",
    "timestamp": "2025-10-23T...",
    "user": {
      "id": 1,
      "username": "master",
      "userType": "master",
      "role": "master"
    }
  }
}
```

---

## Session Management

### Cookie Configuration
- **Name**: `connect.sid`
- **Attributes**: `HttpOnly`, `SameSite=Lax`
- **Storage**: PostgreSQL (table: `session`)
- **TTL**: 24 hours (configurable)

### Session Check Endpoint
```bash
GET /api/auth/check
```

**Authenticated Response**:
```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "username": "master",
    "userType": "master",
    "role": "master",
    "full_name": "Master Admin"
  },
  "_meta": {
    "correlationId": "req_1729...",
    "timestamp": "2025-10-23T..."
  }
}
```

**Unauthenticated Response**:
```json
{
  "authenticated": false,
  "_meta": {
    "correlationId": "req_1729...",
    "timestamp": "2025-10-23T..."
  }
}
```

### Logout
```bash
POST /api/auth/logout
```

**Response**:
```json
{
  "message": "Logged out successfully",
  "_meta": {
    "correlationId": "req_1729...",
    "timestamp": "2025-10-23T..."
  }
}
```

---

## E2E Testing Patterns

### Recommended Login Helper (Client)
```javascript
async function loginAsClient(page) {
    await page.goto('/');
    // Login form is visible by default (login-first UX)
    // Select client tab (form has client/staff tabs)
    await page.click('button:has-text("Client")').catch(() => {
        console.log('Client tab already selected');
    });
    await page.fill('input[name="phone"]', '911111111');
    await page.fill('input[name="password"]', 'lavandaria2025');
    await page.click('button[type="submit"]');
    // All users navigate to /dashboard after login
    await page.waitForURL('/dashboard', { timeout: 10000 });
}
```

### Recommended Login Helper (Staff: Worker/Admin/Master)
```javascript
async function loginAsStaff(page, username, password) {
    await page.goto('/');
    // Login form is visible by default (login-first UX)
    // Select Staff tab
    await page.click('button:has-text("Staff")');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    // All users navigate to /dashboard after login
    await page.waitForURL('/dashboard', { timeout: 10000 });
}
```

### Key Changes from Previous Pattern
1. **No "Login" button click required** - form is visible by default
2. **Route expectation**: Changed from role-specific routes (`/client`, `/worker`, `/admin`, `/master`) to unified `/dashboard`
3. **Tab selection**: Explicitly click "Client" or "Staff" tab before filling credentials

---

## Migration Notes (2025-10-23)

### What Changed
- Landing page `showLogin` state changed from `false` to `true`
- Tests updated to remove "Login" button click
- All `waitForURL` assertions changed from role-specific routes to `/dashboard`

### Test Files Updated
- ✅ `tests/e2e/client-photo-viewing.spec.js`
- ✅ `tests/e2e/rbac-and-sessions.spec.js`
- ✅ `tests/e2e/tab-navigation.spec.js`
- ✅ `tests/e2e/worker-photo-upload.spec.js`
- ✅ `tests/e2e/debug-tab-navigation.spec.js`

### Database Updates
- Client password fixed: bcrypt hash now matches `lavandaria2025`
- `must_change_password` flag set to `false` for test client

---

## Troubleshooting

### Test Timeout: "waiting for input[name='phone']"
**Cause**: App container not serving updated build with `showLogin=true`
**Fix**: Rebuild React client in container and restart:
```bash
docker exec lavandaria-app sh -c "cd /app/client && npm run build"
docker restart lavandaria-app
```

### Test Fails: "Invalid credentials"
**Cause**: Bcrypt hash in database doesn't match test password
**Fix**: Regenerate hash and update database:
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('lavandaria2025', 10, (err, hash) => console.log(hash));"
# Copy hash and run SQL: UPDATE clients SET password = '<hash>' WHERE phone = '911111111';
```

### Test Fails: Redirected to /change-password
**Cause**: `must_change_password` flag is `true`
**Fix**: Update flag in database:
```sql
UPDATE clients SET must_change_password = false WHERE phone = '911111111';
```

---

## Security Considerations

1. **Session Fixation**: Sessions regenerated on login
2. **CSRF Protection**: SameSite=Lax cookie attribute
3. **XSS Prevention**: HttpOnly cookies prevent JavaScript access
4. **SQL Injection**: 100% parameterized queries
5. **Rate Limiting**: Login endpoints limited to 5 attempts/minute

**Known Gaps** (documented in `docs/security.md`):
- HTTPS not enforced (P1)
- No 2FA support (P2)
- Database user separation not implemented (P1)

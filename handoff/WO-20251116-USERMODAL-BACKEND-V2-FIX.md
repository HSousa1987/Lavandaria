# Work Order: Fix POST /api/users V1→V2 Schema Mismatch

**WO ID**: WO-20251116-USERMODAL-BACKEND-V2-FIX
**Priority**: P0 (Blocker)
**Assigned To**: Developer Agent
**Estimated Time**: 30 minutes
**Created**: 2025-11-16

---

## Context

The tester's validation report (handoff/TESTER-VALIDATION-REPORT-20251116.md) found:
- ✅ Frontend UserModal is perfect (V2-compliant)
- ✅ GET /api/role-types works
- ❌ POST /api/users still uses V1 schema columns

**Test Result**: 3/4 PASS (75%)
**Blocker**: Test Case 5 (Create User) fails with PostgreSQL error 42703 (undefined column)

---

## Problem

Location: `routes/users.js:117-123`

```javascript
// ❌ CURRENT (BROKEN) - V1 schema columns
const result = await pool.query(
  `INSERT INTO users (username, password, role, full_name, first_name, last_name,
                      address_line1, address_line2, city, postal_code, district, country, ...)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ...)`,
  [username, hashedPassword, role, fullName, firstName, lastName,
   addressLine1, addressLine2, city, postalCode, district, country, ...]
);
```

**Error**: PostgreSQL rejects because `first_name`, `last_name`, and all address fields don't exist in V2 schema.

---

## Required Fix

### V2 Schema (Current Database)

From `db/migrations/003_v2_schema.sql`:

```sql
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role_id INTEGER REFERENCES role_types(role_id) ON DELETE SET NULL,
  name VARCHAR(100),              -- ✅ Single field (not first_name + last_name)
  email VARCHAR(100),
  phone VARCHAR(20),
  date_of_birth DATE,
  nif VARCHAR(20),
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- NOTE: NO address fields (moved to properties table)
```

### Step 1: Update POST /api/users Endpoint

File: `routes/users.js` (~line 117)

```javascript
// ✅ FIXED - V2 schema columns
const result = await pool.query(
  `INSERT INTO users (username, password, role_id, name, email, phone, date_of_birth, nif, must_change_password)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
   RETURNING user_id, username, role_id, name, email, phone, date_of_birth, nif, created_at`,
  [
    username,
    hashedPassword,
    role_id,          // ✅ FK to role_types (not string 'master'/'admin'/'worker')
    name,             // ✅ Single field from req.body.name
    email,
    phone,
    date_of_birth,
    nif
  ]
);
```

### Step 2: Update Request Body Extraction

Before the INSERT, extract V2 fields:

```javascript
// ✅ Extract V2 fields from request body
const { username, password, role_id, name, email, phone, date_of_birth, nif } = req.body;

// Validate required fields
if (!username || !password || !role_id) {
  return res.status(400).json({
    success: false,
    error: 'USERNAME_PASSWORD_ROLE_REQUIRED',
    message: 'Username, password, and role_id are required',
    _meta: {
      correlationId: req.correlationId,
      timestamp: new Date().toISOString()
    }
  });
}
```

### Step 3: Update Response Envelope

Return V2 fields in response:

```javascript
return res.status(201).json({
  success: true,
  data: {
    user: {
      user_id: result.rows[0].user_id,
      username: result.rows[0].username,
      role_id: result.rows[0].role_id,
      name: result.rows[0].name,
      email: result.rows[0].email,
      phone: result.rows[0].phone,
      date_of_birth: result.rows[0].date_of_birth,
      nif: result.rows[0].nif,
      created_at: result.rows[0].created_at
    }
  },
  _meta: {
    correlationId: req.correlationId,
    timestamp: new Date().toISOString()
  }
});
```

---

## Testing Instructions

### MANDATORY: Browser Test After Fix

1. **Rebuild** (if you modified routes/users.js):
```bash
# Restart backend only (no React rebuild needed)
docker-compose restart app
```

2. **Test in Browser**:
```
1. Login as admin (username: admin, password: admin123)
2. Click "Users" tab
3. Click "Add User" button
4. Fill form:
   - Username: testworker5
   - Password: worker123
   - Role: worker (from dropdown)
   - Name: Test Worker Five
   - Email: test5@example.com
   - Phone: 912345005
5. Click "Create User"
6. Expected: ✅ Success message, user appears in table
7. Verify in database:
   docker exec -it lavandaria-db psql -U lavandaria -d lavandaria \
     -c "SELECT user_id, username, role_id, name FROM users WHERE username = 'testworker5';"
```

3. **Document Results**:
Create `handoff/BACKEND-V2-FIX-RESULTS-20251116.md`:
```markdown
# Backend V2 Fix - Test Results

**Date**: 2025-11-16
**Developer**: [Your Name]
**Work Order**: WO-20251116-USERMODAL-BACKEND-V2-FIX

## Changes Made
- [ ] Updated POST /api/users to use V2 schema columns
- [ ] Removed first_name, last_name, address fields
- [ ] Changed role → role_id (FK to role_types)
- [ ] Tested in browser (attached screenshot)

## Test Results
- [ ] User creation successful (no 500 error)
- [ ] User appears in table
- [ ] Database query confirms V2 schema
- [ ] Console has no errors

## Screenshot
[Attach screenshot of successful user creation]

## Database Verification
```
lavandaria=# SELECT user_id, username, role_id, name FROM users WHERE username = 'testworker5';
 user_id | username     | role_id | name
---------+--------------+---------+------------------
      XX | testworker5  |       3 | Test Worker Five
```

## Status
✅ COMPLETE - Ready for tester validation
```

---

## Acceptance Criteria

- [ ] POST /api/users uses only V2 schema columns
- [ ] No references to first_name, last_name, or address fields
- [ ] role_id is INTEGER FK (not string)
- [ ] Browser test successful (user created without error)
- [ ] Database verification confirms V2 schema
- [ ] Results documented in handoff/BACKEND-V2-FIX-RESULTS-20251116.md
- [ ] Code committed and pushed

---

## Definition of Done

1. Code modified: routes/users.js POST endpoint
2. Backend restarted (docker-compose restart app)
3. Browser test performed and screenshot captured
4. Database verification query executed
5. Results documented in handoff/BACKEND-V2-FIX-RESULTS-20251116.md
6. Git commit with message: `fix(P0): update POST /api/users to V2 schema (WO-20251116)`
7. Git push to remote

---

## Handoff to Tester

After completing this work order:
1. Notify tester that backend fix is complete
2. Provide path to results document
3. Tester will re-run Test Case 5 only
4. Expected final result: 4/4 PASS (100%)

---

**Estimated Completion**: 30 minutes
**Next WO**: Property Management feature (pending 100% pass rate)

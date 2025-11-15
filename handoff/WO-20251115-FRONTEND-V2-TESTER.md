# Work Order: Frontend V2 Schema Fix - Tester Validation

**Date**: 2025-11-15
**Work Order ID**: WO-20251115-TESTER-FRONTEND-V2
**Assigned To**: Tester Agent
**Priority**: P0 (CRITICAL - Validation of P0 blocker fixes)
**Estimated Duration**: 1 hour (focused validation)
**Prerequisites**: WO-20251115-DEV-FRONTEND-V2-FIX must be completed

---

## Executive Summary

Validate that the P0 blocker issues found in `PROPERTY-MGMT-TEST-REPORT-20251114.md` have been **fixed by the developer**. This is a **FOCUSED re-test** of specific P0 issues, NOT a full test suite run.

**Original Issues (from previous test report)**:
- ❌ P0-1: UserModal component missing
- ❌ P0-2: ClientModal component missing
- ❌ P0-5: Frontend displays empty Name fields (V1/V2 mismatch)

**Expected State After Developer Fixes**:
- ✅ UserModal exists and opens when "Add User" clicked
- ✅ ClientModal exists and opens when "Add Client" clicked
- ✅ Users table shows correct names from database
- ✅ Clients table shows correct names from database

---

## Test Scope

**IN SCOPE** (This Work Order):
- ✅ Verify V1/V2 field name mismatch is fixed (empty Name columns)
- ✅ Verify UserModal component exists and works
- ✅ Verify ClientModal component exists and works
- ✅ Verify basic user creation workflow
- ✅ Verify basic client creation workflow
- ✅ Verify NO V1 field artifacts in modals

**OUT OF SCOPE** (Deferred to Next Iteration):
- ❌ Property management (PropertyListModal, PropertyFormModal)
- ❌ Side-by-side client+property creation
- ❌ CleaningJobModal property selection
- ❌ Full RBAC testing
- ❌ Cleaning job workflow testing

---

## Prerequisites Verification

**Before Starting Tests**:

1. **Confirm Developer Smoke Test Passed**:
   - Check file exists: `handoff/SMOKE-TEST-RESULTS-20251115.md`
   - Read smoke test results
   - If smoke test FAILED, **STOP and return work order to developer**

2. **Docker Services Running**:
   ```bash
   docker-compose ps
   # Expected: lavandaria-app and lavandaria-db both "Up (healthy)"
   ```

3. **Application Accessible**:
   - Open browser and navigate to http://localhost:3000/
   - Should see login page (NOT dashboard)
   - Login form should be visible

4. **Test Credentials Available**:
   ```
   Master:  username=master   password=master123
   Admin:   username=admin    password=admin123
   ```

**IMPORTANT - Login Method**:
- ✅ **DO** login through WebUI (fill form + click button like a human)
- ❌ **DO NOT** inject credentials through backend
- ❌ **DO NOT** navigate directly to `/dashboard` without logging in
- Start every test session at `http://localhost:3000/` with proper login flow

---

## Test Suite: P0 Blocker Validation

### Test Case 1: Verify Users Table Name Column Fixed

**Objective**: Confirm empty Name column issue is resolved

**Priority**: P0

**Steps**:
1. Navigate to http://localhost:3000/ (landing page with login form)
2. Fill login form credentials:
   - Username: **master**
   - Password: **master123**
3. Click "Login" button
4. Wait for redirect to dashboard (`http://localhost:3000/dashboard`)
5. Navigate to "All Users" tab
6. Locate Name column in users table

**Expected Results**:
- [ ] Name column shows "Master User" for master account
- [ ] Name column shows "Admin User" for admin account
- [ ] Name column shows "Test Worker" for worker1 account
- [ ] NO empty cells in Name column

**FAIL Scenarios**:
- Name column is empty (still showing blank cells)
- Name column shows "undefined" or "null"
- Name column missing from table

**Evidence Required**:
- Screenshot of Users table showing populated Name column
- Save as: `test-results/fixed-users-name-column.png`

**Pass Criteria**: Name column displays correct data from database for all users

---

### Test Case 2: Verify Clients Table Name Column Fixed

**Objective**: Confirm empty Name column issue is resolved

**Priority**: P0

**Steps**:
1. Still logged in as master
2. Navigate to "Clients" tab
3. Locate Name column in clients table

**Expected Results**:
- [ ] Name column shows "Test Client" for test client
- [ ] NO empty cells in Name column

**FAIL Scenarios**:
- Name column is empty
- Name column shows "undefined" or "null"

**Evidence Required**:
- Screenshot of Clients table showing populated Name column
- Save as: `test-results/fixed-clients-name-column.png`

**Pass Criteria**: Name column displays correct data from database for all clients

---

### Test Case 3: Verify UserModal Component Exists

**Objective**: Confirm UserModal was created and wired correctly

**Priority**: P0

**Steps**:
1. Still in "All Users" tab
2. Locate "Add User" button
3. Click "Add User"

**Expected Results**:
- [ ] UserModal opens (modal overlay appears)
- [ ] Modal shows title "Add User"
- [ ] Modal has close button (×)
- [ ] Form is visible

**FAIL Scenarios**:
- Nothing happens on button click
- JavaScript error in console
- Modal flashes and disappears
- Button doesn't exist

**Evidence Required**:
- Screenshot of open UserModal
- Save as: `test-results/usermodal-opened.png`

**Pass Criteria**: UserModal opens successfully on "Add User" click

---

### Test Case 4: Verify UserModal V2 Schema Fields

**Objective**: Confirm UserModal uses V2 schema (no V1 artifacts)

**Priority**: P0

**Steps**:
1. With UserModal open (from Test Case 3)
2. Inspect form fields

**Expected Fields (V2 Schema)**:
- [ ] Username (text input)
- [ ] Password (password input)
- [ ] Role (dropdown select - NOT text input)
- [ ] Full Name (single text input labeled "Name" or "Full Name")
- [ ] Email (text input)
- [ ] Phone (text input)
- [ ] Date of Birth (date picker)
- [ ] NIF (text input)
- [ ] Submit button ("Create User" or similar)
- [ ] Cancel button

**MUST NOT Have (V1 Artifacts)**:
- [ ] NO "First Name" field
- [ ] NO "Last Name" field
- [ ] NO "Address Line 1" field
- [ ] NO "City" field
- [ ] NO "Postal Code" field
- [ ] NO "District" field
- [ ] NO "Country" field

**Role Dropdown Verification**:
- [ ] Role field is dropdown (SELECT element, not INPUT text)
- [ ] Dropdown shows options: Master, Admin, Worker, Client (or subset)

**Evidence Required**:
- Screenshot of UserModal form showing all V2 fields
- Save as: `test-results/usermodal-v2-fields.png`

**Pass Criteria**: Form has ALL V2 fields and ZERO V1 fields

---

### Test Case 5: Create User via UserModal

**Objective**: Verify end-to-end user creation workflow

**Priority**: P0

**Steps**:
1. Fill UserModal form:
   ```
   Username: tester_worker_20251115
   Password: test123
   Role: Worker (select from dropdown)
   Full Name: Tester Worker 2025-11-15
   Email: tester@test.com
   Phone: 918888888
   Date of Birth: 1990-01-01
   NIF: 999888777
   ```
2. Click "Create User" button
3. Wait for modal to close
4. Check users table

**Expected Results**:
- [ ] Modal closes automatically
- [ ] NO error messages
- [ ] New user appears in users table
- [ ] User row shows:
  - Name: "Tester Worker 2025-11-15"
  - Email: "tester@test.com"
  - Role: "Worker"
- [ ] NO empty Name column for new user

**FAIL Scenarios**:
- Form submission error (alert/error message)
- Modal doesn't close
- User doesn't appear in table
- User appears but Name column is empty
- Console error

**Evidence Required**:
- Screenshot of users table showing new user with populated Name
- Save as: `test-results/usermodal-create-success.png`

**Database Verification** (optional):
```bash
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c \
"SELECT id, username, name, role_id FROM users WHERE username='tester_worker_20251115';"
```
Expected: 1 row with `name='Tester Worker 2025-11-15'`

**Pass Criteria**: User created successfully with correct V2 data

---

### Test Case 6: Verify ClientModal Component Exists

**Objective**: Confirm ClientModal was created and wired correctly

**Priority**: P0

**Steps**:
1. Navigate to "Clients" tab
2. Locate "Add Client" button
3. Click "Add Client"

**Expected Results**:
- [ ] ClientModal opens (modal overlay appears)
- [ ] Modal shows title "Add Client"
- [ ] Modal has close button (×)
- [ ] Form is visible

**FAIL Scenarios**:
- Nothing happens on button click
- JavaScript error in console
- Modal flashes and disappears

**Evidence Required**:
- Screenshot of open ClientModal
- Save as: `test-results/clientmodal-opened.png`

**Pass Criteria**: ClientModal opens successfully on "Add Client" click

---

### Test Case 7: Verify ClientModal V2 Schema Fields

**Objective**: Confirm ClientModal uses V2 schema (no V1 artifacts, no property fields yet)

**Priority**: P0

**Steps**:
1. With ClientModal open (from Test Case 6)
2. Inspect form fields

**Expected Fields (V2 Schema - Basic Client Only)**:
- [ ] Enterprise Client (checkbox toggle)
- [ ] Company Name (text input - shown only when Enterprise checked)
- [ ] Full Name or Contact Name (single text input)
- [ ] Phone (text input)
- [ ] Email (text input)
- [ ] Date of Birth (date picker)
- [ ] NIF (text input)
- [ ] Notes (textarea)
- [ ] Submit button ("Create Client" or similar)
- [ ] Cancel button

**MUST NOT Have (V1 Artifacts)**:
- [ ] NO "First Name" field
- [ ] NO "Last Name" field
- [ ] NO "Address Line 1" field (address is deferred to property management)
- [ ] NO "City" field
- [ ] NO "Postal Code" field

**DEFERRED (Not Expected in This Iteration)**:
- ⚠️ NO property fields (property management deferred to next work order)
- ⚠️ NO "Property Name" field
- ⚠️ NO "Property Type" dropdown
- ⚠️ NO side-by-side layout with property section

**Evidence Required**:
- Screenshot of ClientModal form showing V2 client fields only
- Save as: `test-results/clientmodal-v2-fields.png`

**Pass Criteria**: Form has V2 client fields, NO V1 artifacts, NO property fields (deferred)

---

### Test Case 8: Create Client via ClientModal

**Objective**: Verify end-to-end client creation workflow

**Priority**: P0

**Steps**:
1. Fill ClientModal form:
   ```
   Enterprise Client: UNCHECKED
   Full Name: Tester Client 2025-11-15
   Phone: 919999111
   Email: testerclient@test.com
   Date of Birth: 1985-05-15
   NIF: 888777666
   Notes: Created by tester for validation
   ```
2. Click "Create Client" button
3. Wait for modal to close
4. Check clients table

**Expected Results**:
- [ ] Modal closes automatically
- [ ] NO error messages
- [ ] New client appears in clients table
- [ ] Client row shows:
  - Name: "Tester Client 2025-11-15"
  - Phone: "919999111"
  - Email: "testerclient@test.com"
- [ ] NO empty Name column for new client

**FAIL Scenarios**:
- Form submission error
- Modal doesn't close
- Client doesn't appear in table
- Client appears but Name column is empty

**Evidence Required**:
- Screenshot of clients table showing new client with populated Name
- Save as: `test-results/clientmodal-create-success.png`

**Database Verification** (optional):
```bash
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c \
"SELECT id, phone, name, email FROM clients WHERE phone='919999111';"
```
Expected: 1 row with `name='Tester Client 2025-11-15'`

**Pass Criteria**: Client created successfully with correct V2 data

---

### Test Case 9: Verify Enterprise Client Creation

**Objective**: Test enterprise toggle and company_name field

**Priority**: P0

**Steps**:
1. Click "Add Client" again
2. Check "Enterprise Client" checkbox
3. Verify "Company Name" field appears
4. Fill form:
   ```
   Enterprise Client: CHECKED
   Company Name: Tester Corporation Lda
   Contact Name: Maria Silva (Manager)
   Phone: 919999222
   Email: contact@testercorp.com
   NIF: 777666555
   ```
5. Submit

**Expected Results**:
- [ ] "Company Name" field appears when Enterprise checked
- [ ] "Company Name" field disappears when Enterprise unchecked
- [ ] Client created successfully
- [ ] Clients table shows new enterprise client with correct name

**Pass Criteria**: Enterprise client creation works with company_name field

---

### Test Case 10: Console Error Check

**Objective**: Ensure no JavaScript errors during workflows

**Priority**: P0

**Steps**:
1. Open browser DevTools → Console tab
2. Clear console
3. Repeat Test Cases 1-9
4. Check console for errors

**Expected Results**:
- [ ] NO red error messages
- [ ] NO warnings about undefined properties (e.g., `Cannot read property 'first_name' of undefined`)
- [ ] NO 404 errors for missing endpoints

**Acceptable Warnings**:
- React DevTools warnings (non-critical)
- Minor CSS warnings

**FAIL Scenarios**:
- Errors like: `Cannot read property 'first_name' of undefined`
- Errors like: `user.full_name is not defined`
- Network errors: `GET /api/role-types 404 Not Found`

**Evidence Required**:
- Screenshot of clean console (or acceptable warnings only)
- Save as: `test-results/console-clean.png`

**Pass Criteria**: Console is clean with no critical errors

---

## Deliverables

### Test Report Document

Create file: `handoff/FRONTEND-V2-FIX-TEST-REPORT-20251115.md`

**Required Sections**:

```markdown
# Frontend V2 Fix - Test Report

**Date**: 2025-11-15
**Work Order**: WO-20251115-TESTER-FRONTEND-V2
**Tester**: [Your Name/ID]

## Executive Summary

**Overall Status**: PASS / FAIL

**Test Results**: X/10 tests passed

**Critical Issues Found**: [Number]

## Test Results Table

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1. Users Table Name Column | PASS/FAIL | |
| 2. Clients Table Name Column | PASS/FAIL | |
| 3. UserModal Opens | PASS/FAIL | |
| 4. UserModal V2 Fields | PASS/FAIL | |
| 5. Create User Workflow | PASS/FAIL | |
| 6. ClientModal Opens | PASS/FAIL | |
| 7. ClientModal V2 Fields | PASS/FAIL | |
| 8. Create Client Workflow | PASS/FAIL | |
| 9. Enterprise Client | PASS/FAIL | |
| 10. Console Errors | PASS/FAIL | |

## Screenshots

All screenshots in `test-results/`:
1. fixed-users-name-column.png
2. fixed-clients-name-column.png
3. usermodal-opened.png
4. usermodal-v2-fields.png
5. usermodal-create-success.png
6. clientmodal-opened.png
7. clientmodal-v2-fields.png
8. clientmodal-create-success.png
9. console-clean.png

## Issues Found

[If any test FAILED, list issues here with:]
- Test Case where found
- Expected behavior
- Actual behavior
- Severity (P0/P1/P2)
- Screenshot reference

## Recommendations

### If ALL tests PASS:
✅ P0 blockers resolved
✅ Ready to proceed with property management work order
✅ Recommend creating WO-20251116-PROPERTY-MANAGEMENT-FULL for next iteration

### If ANY tests FAIL:
❌ Return to developer for fixes
❌ List specific fixes required
❌ Re-test after developer fixes

## Success Criteria Assessment

**P0 Fixes (Must Pass)**:
- [ ] Users table Name column populated (Test 1)
- [ ] Clients table Name column populated (Test 2)
- [ ] UserModal exists and functional (Tests 3-5)
- [ ] ClientModal exists and functional (Tests 6-8)
- [ ] NO V1 field artifacts (Tests 4, 7)
- [ ] Console clean (Test 10)

**Overall**: PASS / FAIL

**Production Readiness (for basic CRUD)**: READY / NOT READY
```

---

## Success Criteria

**Must Pass (100% Required)**:
- [ ] Test Case 1: Users Name column - PASS
- [ ] Test Case 2: Clients Name column - PASS
- [ ] Test Case 3: UserModal opens - PASS
- [ ] Test Case 4: UserModal V2 fields - PASS
- [ ] Test Case 5: Create user - PASS
- [ ] Test Case 6: ClientModal opens - PASS
- [ ] Test Case 7: ClientModal V2 fields - PASS
- [ ] Test Case 8: Create client - PASS
- [ ] Test Case 9: Enterprise client - PASS
- [ ] Test Case 10: Console clean - PASS

**Pass Rate Target**: 10/10 (100%)

**If ANY test fails**: Return to developer with detailed failure report

---

## Notes for Tester

1. **This is a FOCUSED re-test** - Only testing P0 fixes, not full system
2. **Property management NOT expected** - Deferred to next iteration
3. **Be thorough with screenshots** - Evidence required for each test
4. **Check console carefully** - V1 field errors are common
5. **Test enterprise toggle** - Important for company_name field logic
6. **Database verification optional** - But recommended for confidence
7. **Report clearly** - If ANY test fails, provide exact steps to reproduce
8. **CRITICAL - Human-like Testing**: Always start at `http://localhost:3000/` and login through the UI. NO backend credential injection, NO direct navigation to `/dashboard`. Simulate real user behavior throughout all tests

---

## Timeline

**Estimated Duration**: 1 hour

- Setup & Prerequisites: 5 minutes
- Test Cases 1-2 (Name columns): 10 minutes
- Test Cases 3-5 (UserModal): 15 minutes
- Test Cases 6-9 (ClientModal): 20 minutes
- Test Case 10 (Console check): 5 minutes
- Report Writing: 15 minutes

---

**END OF WORK ORDER**

**Related Documents**:
- Developer Work Order: `handoff/WO-20251115-FRONTEND-V2-CRITICAL-FIX.md`
- Previous Test Report: `handoff/PROPERTY-MGMT-TEST-REPORT-20251114.md`
- Developer Smoke Test: `handoff/SMOKE-TEST-RESULTS-20251115.md` (check before starting)

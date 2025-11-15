# Work Order: Property Management System - WebUI Testing & Validation

**Date**: 2025-11-14
**Work Order ID**: WO-20251114-TESTER-PROPERTY-MGMT
**Assigned To**: Tester Agent (WebUI Validation)
**Priority**: P0 (Blocking - Must validate V2 schema frontend forms)
**Estimated Duration**: 2-3 hours (comprehensive WebUI testing)

---

## Executive Summary

Validate that the newly implemented property management system works correctly via WebUI after V2 schema migration. This work order focuses on **end-user validation** (not E2E automated tests) to ensure:

1. User/Worker/Admin creation forms use V2 schema fields
2. Client creation includes property management workflow
3. Property CRUD operations work correctly
4. Cleaning job creation uses property selection (not direct address input)
5. RBAC enforcement prevents unauthorized actions
6. No V1 schema artifacts remain in UI

---

## Prerequisites

**Before Starting Testing**:

1. **Docker Environment Running**:
   ```bash
   docker-compose ps
   # Both 'lavandaria-db' and 'lavandaria-app' should show "Up" status
   ```

2. **Database Seeded with Test Data**:
   ```bash
   npm run test:seed
   # Should create: master, admin, worker1, test client with property
   ```

3. **Application Accessible**:
   ```bash
   curl http://localhost:3000/api/readyz
   # Should return: {"status":"ok"}
   ```

4. **Browser Configured**:
   - Use Chrome or Firefox (latest version)
   - Open DevTools (F12) → Console tab
   - Monitor for JavaScript errors during testing

**Test Credentials** (from seed script):
```
Master:  username=master   password=master123
Admin:   username=admin    password=admin123
Worker:  username=worker1  password=worker123
Client:  phone=962000001   password=lavandaria2025
```

---

## Test Suite 1: User Management (V2 Schema Validation)

### Test Case 1.1: Worker Creation via WebUI

**Objective**: Verify UserModal accepts V2 schema (single name, role_id, NO addresses)

**Steps**:
1. Login as **Master** (`master` / `master123`)
2. Navigate to "Users" section
3. Click "Add User" button
4. **Verify Form Structure**:
   - [ ] Username field (text input)
   - [ ] Password field (password input)
   - [ ] **Role field is DROPDOWN** (not text input)
   - [ ] **Name field is SINGLE input** (not first_name/last_name)
   - [ ] Email field (text input)
   - [ ] Phone field (text input)
   - [ ] Date of Birth field (date picker)
   - [ ] NIF field (text input)
   - [ ] **NO address fields** (address_line1, city, postal_code, district should NOT exist)
5. Fill form with test data:
   ```
   Username: testworker
   Password: worker123
   Role: Worker (select from dropdown)
   Name: Carlos Santos
   Email: carlos@test.com
   Phone: 912345678
   DOB: 1990-01-15
   NIF: 123456789
   ```
6. Click "Submit" or "Create User"
7. **Verify Success**:
   - [ ] No JavaScript errors in console
   - [ ] User appears in users list
   - [ ] User row shows "Carlos Santos" (not "undefined" or blank)
   - [ ] User row shows "Worker" role

8. **Backend Verification** (optional):
   ```bash
   docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c \
   "SELECT id, username, role_id, name FROM users WHERE username='testworker';"
   ```
   Expected: Single row with `name='Carlos Santos'`, `role_id=3` (Worker)

**Pass Criteria**:
- Form shows V2 fields (single name, role dropdown, no addresses)
- Submission succeeds without errors
- User appears in list with correct name and role

**Fail Scenarios**:
- Form shows first_name/last_name fields (V1 artifact)
- Form shows address fields (V1 artifact)
- Role field is text input instead of dropdown
- Console shows errors: `column "first_name" does not exist`
- User creation fails with 500 error

---

### Test Case 1.2: Admin Creation via WebUI

**Objective**: Same as 1.1 but for Admin role

**Steps**:
1. Still logged in as **Master**
2. Navigate to "Users" section
3. Click "Add User"
4. Fill form:
   ```
   Username: testadmin
   Password: admin123
   Role: Admin (select from dropdown)
   Name: Maria Silva
   Email: maria@test.com
   Phone: 923456789
   DOB: 1985-05-20
   NIF: 987654321
   ```
5. Submit
6. **Verify Success**:
   - [ ] User "Maria Silva" appears in users list with "Admin" role

**Pass Criteria**: Same as Test Case 1.1

---

### Test Case 1.3: User Edit (Verify V2 Schema Persistence)

**Objective**: Ensure editing users doesn't reintroduce V1 fields

**Steps**:
1. From users list, click "Edit" on "testworker"
2. **Verify Edit Form**:
   - [ ] Form pre-fills with "Carlos Santos" in single Name field
   - [ ] Role dropdown shows "Worker" selected
   - [ ] No address fields present
3. Update name to "Carlos Santos Jr."
4. Submit
5. **Verify**:
   - [ ] User list shows updated name "Carlos Santos Jr."
   - [ ] No console errors

**Pass Criteria**: Edit form matches create form structure (V2 schema)

---

## Test Suite 2: Client Management (Property Workflow Validation)

### Test Case 2.1: Client Creation with Primary Property (Individual)

**Objective**: Verify side-by-side client+property creation workflow

**Steps**:
1. Login as **Admin** (`admin` / `admin123`)
2. Navigate to "Clients" section
3. Click "Add Client"
4. **Verify Form Structure**:
   - [ ] **LEFT SIDE**: Client Information section
     - Phone, Name (single field), Email, DOB, NIF, Notes
     - Enterprise toggle checkbox
     - **NO address fields**
   - [ ] **RIGHT SIDE**: Primary Property section
     - Property Name, Property Type dropdown
     - Address Line 1, Address Line 2, City, Postal Code, District
5. Fill **Client Info** (left side):
   ```
   Phone: 912000001
   Name: João Pereira
   Email: joao@test.com
   DOB: 1980-03-10
   NIF: 111222333
   Notes: Test individual client
   Enterprise: UNCHECKED
   ```
6. Fill **Property Info** (right side):
   ```
   Property Name: Main Residence
   Property Type: residential
   Address Line 1: Rua das Flores, 25
   Address Line 2: Apt 3B
   City: Lisboa
   Postal Code: 1200-001
   District: Lisboa
   ```
7. Click "Create Client & Property" (or similar submit button)
8. **Verify Success**:
   - [ ] No console errors
   - [ ] Client "João Pereira" appears in clients list
   - [ ] Phone shows "912000001"

9. **Verify Property Created**:
   - Click on client row → "Manage Properties" button (or similar)
   - PropertyListModal opens
   - [ ] Property "Main Residence" appears in list
   - [ ] Property has green "PRIMARY" badge
   - [ ] Address shows "Rua das Flores, 25, Apt 3B"
   - [ ] City shows "Lisboa"
   - [ ] Type shows "residential"

**Pass Criteria**:
- Client and property created in one workflow
- Property marked as primary automatically
- No V1 address fields on client form

**Fail Scenarios**:
- Client form shows address fields (V1 artifact)
- Property not created (client exists but no properties)
- PropertyListModal doesn't open or shows empty list
- Console error: `Cannot read property 'is_primary' of undefined`

---

### Test Case 2.2: Client Creation with Primary Property (Enterprise)

**Objective**: Verify enterprise client workflow

**Steps**:
1. Still as Admin, click "Add Client"
2. Fill **Client Info**:
   ```
   Phone: 913000001
   Name: Ana Costa (Manager)
   Email: ana@acmecorp.com
   DOB: 1975-07-22
   NIF: 444555666
   Enterprise: CHECKED
   Company Name: ACME Corporation
   ```
3. **Verify**: When Enterprise is checked, "Company Name" field appears
4. Fill **Property Info**:
   ```
   Property Name: ACME Head Office
   Property Type: commercial
   Address Line 1: Avenida da Liberdade, 100
   City: Lisboa
   Postal Code: 1250-001
   District: Lisboa
   ```
5. Submit
6. **Verify**:
   - [ ] Client appears with name "Ana Costa (Manager)" or similar
   - [ ] Property "ACME Head Office" created with type "commercial"

**Pass Criteria**: Enterprise clients can be created with commercial properties

---

### Test Case 2.3: Add Additional Properties (Multi-Property Workflow)

**Objective**: Verify unlimited property addition per client

**Steps**:
1. From clients list, click on "João Pereira" (created in 2.1)
2. Click "Manage Properties"
3. In PropertyListModal, click "Add Property"
4. **Verify PropertyFormModal opens** with empty form
5. Fill form:
   ```
   Property Name: Airbnb Cascais
   Property Type: airbnb
   Address Line 1: Avenida Marginal, 200
   City: Cascais
   Postal Code: 2750-001
   District: Lisboa
   Primary Property: UNCHECKED (already have primary)
   ```
6. Submit
7. **Verify**:
   - [ ] PropertyFormModal closes
   - [ ] PropertyListModal refreshes
   - [ ] Now shows TWO properties:
     - "Main Residence" (PRIMARY badge)
     - "Airbnb Cascais" (no badge)

8. **Add Third Property**:
   - Click "Add Property" again
   - Fill:
     ```
     Property Name: Airbnb Porto
     Property Type: airbnb
     Address Line 1: Rua de Santa Catarina, 50
     City: Porto
     Postal Code: 4000-001
     District: Porto
     Primary Property: UNCHECKED
     ```
   - Submit
9. **Verify**:
   - [ ] Now shows THREE properties
   - [ ] Only "Main Residence" has PRIMARY badge

**Pass Criteria**:
- Client can have unlimited properties (tested with 3)
- Only one property has PRIMARY badge
- PropertyListModal updates after each addition

**Fail Scenarios**:
- Cannot add more than 1 property (hardcoded limit)
- Multiple properties show PRIMARY badge
- PropertyListModal doesn't refresh (must manually reload page)

---

### Test Case 2.4: Edit Property

**Objective**: Verify property editing workflow

**Steps**:
1. From "João Pereira" PropertyListModal
2. Click "Edit" on "Airbnb Cascais"
3. **Verify PropertyFormModal** pre-fills with existing data:
   - [ ] Property Name: "Airbnb Cascais"
   - [ ] Address Line 1: "Avenida Marginal, 200"
   - [ ] City: "Cascais"
   - [ ] Primary checkbox: UNCHECKED
4. Update fields:
   ```
   Property Name: Airbnb Cascais Seafront
   Address Line 1: Avenida Marginal, 250
   ```
5. Submit
6. **Verify**:
   - [ ] PropertyListModal refreshes
   - [ ] Property now shows "Airbnb Cascais Seafront"
   - [ ] Address shows updated street number "250"

**Pass Criteria**: Property updates persist correctly

---

### Test Case 2.5: Delete Non-Primary Property

**Objective**: Verify property deletion (no auto-promotion scenario)

**Steps**:
1. From "João Pereira" PropertyListModal (3 properties)
2. Click "Delete" on "Airbnb Porto" (non-primary)
3. **Verify**: Confirmation dialog appears ("Are you sure...")
4. Confirm deletion
5. **Verify**:
   - [ ] PropertyListModal refreshes
   - [ ] Now shows TWO properties (Main Residence + Airbnb Cascais Seafront)
   - [ ] "Main Residence" still has PRIMARY badge

**Pass Criteria**: Non-primary property deleted without affecting primary status

---

### Test Case 2.6: Delete Primary Property (Auto-Promotion)

**Objective**: Verify primary property auto-promotion on deletion

**Steps**:
1. From "João Pereira" PropertyListModal (2 properties remaining)
2. Click "Delete" on "Main Residence" (PRIMARY)
3. Confirm deletion
4. **Verify**:
   - [ ] PropertyListModal refreshes
   - [ ] Now shows ONE property ("Airbnb Cascais Seafront")
   - [ ] **"Airbnb Cascais Seafront" now has PRIMARY badge** (auto-promoted)

**Pass Criteria**: Remaining property auto-promoted to primary

**Fail Scenarios**:
- Deletion fails with error "Cannot delete primary property"
- Remaining property doesn't get PRIMARY badge
- Console error about primary constraint violation

---

### Test Case 2.7: Try to Set Multiple Primary Properties (Constraint Violation)

**Objective**: Verify backend prevents multiple primary properties

**Steps**:
1. From "João Pereira" PropertyListModal (1 property - PRIMARY)
2. Click "Add Property"
3. Fill form:
   ```
   Property Name: Second Airbnb
   Property Type: airbnb
   Address Line 1: Test Street, 1
   City: Lisboa
   Postal Code: 1100-001
   District: Lisboa
   Primary Property: CHECKED
   ```
4. Submit
5. **Verify**:
   - [ ] Backend returns error: "Client already has a primary property"
   - [ ] Alert/error message displays to user
   - [ ] Property NOT created

**Pass Criteria**: Backend prevents multiple primary properties

**Fail Scenarios**:
- Property created successfully with 2 primary properties
- Database constraint violation crashes app

---

## Test Suite 3: Cleaning Job Management (Property Selection)

### Test Case 3.1: Create Cleaning Job with Property Selection

**Objective**: Verify cleaning job form uses property dropdown (not direct address input)

**Steps**:
1. Still logged in as **Admin**
2. Navigate to "Cleaning Jobs" section
3. Click "Add Cleaning Job"
4. **Verify Form Structure**:
   - [ ] Client dropdown
   - [ ] **Property dropdown** (disabled until client selected)
   - [ ] Job Type dropdown (airbnb/house)
   - [ ] Status dropdown
   - [ ] Scheduled Date/Time pickers
   - [ ] Worker dropdown
   - [ ] Notes textarea
   - [ ] **NO property address input fields** (property_name, address_line1, city, etc.)

5. Select **Client**: "João Pereira"
6. **Verify Property Dropdown**:
   - [ ] Dropdown becomes enabled
   - [ ] Shows "Airbnb Cascais Seafront - Cascais (Primary)"
   - [ ] Auto-selects primary property

7. Fill remaining fields:
   ```
   Property: Airbnb Cascais Seafront - Cascais (Primary)
   Job Type: airbnb
   Status: scheduled
   Scheduled Date: Tomorrow's date
   Scheduled Time: 10:00
   Worker: testworker (if available, or any worker)
   Notes: Test cleaning job
   ```
8. Submit
9. **Verify Success**:
   - [ ] No console errors
   - [ ] Cleaning job appears in jobs list
   - [ ] Job row shows client "João Pereira"
   - [ ] Job details show property "Airbnb Cascais Seafront"
   - [ ] Address displays correctly (joined from properties table)

**Pass Criteria**:
- Cleaning job form uses property dropdown
- No direct address input fields present
- Property address displays in job details (backend JOIN working)

**Fail Scenarios**:
- Form shows property_name, address_line1 input fields (V1 artifact)
- Property dropdown doesn't populate after client selection
- Job creation fails with error `property_id cannot be null`

---

### Test Case 3.2: Create Cleaning Job for Client with Multiple Properties

**Objective**: Verify property selection for clients with >1 property

**Steps**:
1. First, add a second property to "João Pereira":
   - Manage Properties → Add Property
   - Property Name: "Summer House Algarve"
   - Type: residential
   - Address: "Praia da Rocha, 10", Portimão, 8500-001, Faro
   - Submit

2. Navigate to "Cleaning Jobs" → "Add Cleaning Job"
3. Select Client: "João Pereira"
4. **Verify Property Dropdown**:
   - [ ] Shows TWO properties:
     - "Airbnb Cascais Seafront - Cascais (Primary)"
     - "Summer House Algarve - Portimão"
   - [ ] Primary property auto-selected

5. **Change Selection** to "Summer House Algarve"
6. Fill remaining fields and submit
7. **Verify**:
   - [ ] Job created for "Summer House Algarve" property
   - [ ] Job details show Portimão address (not Cascais)

**Pass Criteria**: Can select any property for client in cleaning job creation

---

### Test Case 3.3: Try to Create Job for Client with No Properties

**Objective**: Verify error handling when client has no properties

**Steps**:
1. Create a new client WITHOUT property:
   - **Workaround**: Since ClientModal requires property, use API or manually delete all properties for test client "ACME Corporation"
   - OR: Skip this test if ClientModal enforces property creation

2. Navigate to "Cleaning Jobs" → "Add Cleaning Job"
3. Select Client with no properties
4. **Verify**:
   - [ ] Property dropdown shows "No properties found for this client"
   - [ ] Submit button disabled OR shows error message
   - [ ] Cannot create job without property

**Pass Criteria**: Prevents cleaning job creation if client has no properties

**Note**: This scenario may not be possible if ClientModal always creates primary property. Document as "N/A - enforced by client creation workflow" if applicable.

---

## Test Suite 4: RBAC Enforcement

### Test Case 4.1: Worker Cannot Access Property Management

**Objective**: Verify workers cannot view/create/edit properties

**Steps**:
1. Logout Admin
2. Login as **Worker** (`worker1` / `worker123`)
3. Navigate to Clients section (if accessible)
4. **Verify**:
   - [ ] Clients list may be visible (as contacts)
   - [ ] "Manage Properties" button should NOT exist OR be disabled
   - [ ] If clicked (via direct URL manipulation), returns 403 Forbidden

5. **API Test** (optional):
   ```bash
   # Login as worker and try to list properties
   WORKER_COOKIE=$(curl -c - -X POST http://localhost:3000/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"username":"worker1","password":"worker123"}' | grep connect.sid | awk '{print $7}')

   curl -b "connect.sid=$WORKER_COOKIE" \
       "http://localhost:3000/api/properties?client_id=1"
   # Expected: 403 Forbidden
   ```

**Pass Criteria**: Workers cannot access property management UI or API

---

### Test Case 4.2: Client Cannot View Other Clients' Properties

**Objective**: Verify client RBAC isolation

**Steps**:
1. Logout Worker
2. Login as **Client** (`962000001` / `lavandaria2025`) - from seed script
3. Navigate to "My Properties" or similar client-facing section
4. **Verify**:
   - [ ] Client sees ONLY their own properties
   - [ ] Cannot access other clients' properties via UI

5. **API Test** (optional):
   ```bash
   CLIENT_COOKIE=$(curl -c - -X POST http://localhost:3000/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"phone":"962000001","password":"lavandaria2025"}' | grep connect.sid | awk '{print $7}')

   # Try to access another client's properties
   curl -b "connect.sid=$CLIENT_COOKIE" \
       "http://localhost:3000/api/properties?client_id=999"
   # Expected: 403 Forbidden (if 999 is not client's own ID)
   ```

**Pass Criteria**: Clients isolated to their own properties

---

## Test Suite 5: UI/UX Validation (V2 Schema Cleanup)

### Test Case 5.1: No V1 Artifacts in Forms

**Objective**: Ensure NO V1 schema fields visible anywhere in UI

**Steps**:
1. Login as **Master**
2. Systematically check ALL forms for V1 artifacts:

   **User Forms** (Add/Edit User):
   - [ ] NO fields: first_name, last_name, full_name
   - [ ] NO fields: address_line1, address_line2, city, postal_code, district, country
   - [ ] HAS field: name (single)
   - [ ] HAS field: role (dropdown, not text)

   **Client Forms** (Add/Edit Client):
   - [ ] NO fields: first_name, last_name, full_name
   - [ ] NO fields: address_line1, address_line2, city, postal_code, district, country
   - [ ] HAS field: name (single)
   - [ ] HAS property section (side-by-side or modal)

   **Cleaning Job Forms** (Add/Edit Job):
   - [ ] NO fields: property_name, address_line1, address_line2, city, postal_code, district
   - [ ] HAS field: property_id (dropdown)

**Pass Criteria**: NO V1 schema fields present in any form

**Fail Scenarios**:
- Any form shows first_name/last_name
- Any form shows direct address inputs (except PropertyFormModal)

---

### Test Case 5.2: Console Error Check (Global)

**Objective**: Ensure no JavaScript errors during normal workflows

**Steps**:
1. Open browser DevTools → Console tab
2. Clear console
3. Execute all test cases above
4. **Verify**:
   - [ ] NO red error messages in console
   - [ ] NO warnings about undefined properties (e.g., `Cannot read property 'full_name' of undefined`)

**Pass Criteria**: Clean console with no errors

**Acceptable Warnings**:
- React DevTools warnings (non-critical)
- Minor CSS warnings

**Fail Scenarios**:
- Errors like: `column "first_name" does not exist`
- Errors like: `Cannot read property 'is_primary' of undefined`
- Errors like: `property_id is required`

---

## Test Suite 6: Data Integrity Validation

### Test Case 6.1: Verify Database State After Tests

**Objective**: Confirm all test data persisted correctly

**Steps**:
1. Run SQL queries to verify data:

   **Users Table (V2 Schema)**:
   ```bash
   docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c \
   "SELECT id, username, role_id, name, email FROM users WHERE username IN ('testworker', 'testadmin');"
   ```
   Expected:
   - 2 rows
   - `name` column populated (NOT null)
   - `role_id` is integer (3 for worker, 2 for admin)

   **Clients Table (V2 Schema - NO addresses)**:
   ```bash
   docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c \
   "SELECT id, phone, name, is_enterprise, company_name FROM clients WHERE phone IN ('912000001', '913000001');"
   ```
   Expected:
   - 2 rows (João Pereira, ACME Corporation)
   - NO address_line1, city, postal_code columns

   **Properties Table**:
   ```bash
   docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c \
   "SELECT p.id, p.client_id, p.property_name, p.city, p.is_primary, c.name as client_name
    FROM properties p
    JOIN clients c ON p.client_id = c.id
    WHERE c.phone IN ('912000001', '913000001');"
   ```
   Expected:
   - Multiple rows (properties created during tests)
   - Each client has exactly ONE `is_primary=true` property

   **Cleaning Jobs Table (property_id references)**:
   ```bash
   docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c \
   "SELECT cj.id, cj.client_id, cj.property_id, p.property_name, p.city
    FROM cleaning_jobs cj
    JOIN properties p ON cj.property_id = p.id
    WHERE cj.client_id IN (SELECT id FROM clients WHERE phone='912000001');"
   ```
   Expected:
   - Jobs created in Test Suite 3
   - `property_id` NOT NULL
   - JOIN with properties table succeeds

**Pass Criteria**: All queries return expected data with V2 schema

---

## Deliverables

### Test Report Document

Create file: `handoff/PROPERTY-MGMT-TEST-REPORT-20251114.md`

**Required Sections**:

1. **Executive Summary**:
   - Total test cases executed
   - Pass/Fail count
   - Overall assessment (Ready for production / Needs fixes)

2. **Test Results Table**:
   ```markdown
   | Test Case | Status | Notes |
   |-----------|--------|-------|
   | 1.1 Worker Creation | PASS/FAIL | Description of issue if failed |
   | 1.2 Admin Creation | PASS/FAIL | ... |
   | ... | ... | ... |
   ```

3. **Screenshots** (in `handoff/screenshots/`):
   - UserModal (V2 schema - single name, role dropdown)
   - ClientModal (side-by-side layout)
   - PropertyListModal (with PRIMARY badge)
   - PropertyFormModal (add property)
   - CleaningJobModal (property dropdown)
   - Console with no errors

4. **Issues Found**:
   - List each bug with:
     - Test case where found
     - Expected behavior
     - Actual behavior
     - Error messages/screenshots
     - Severity (P0/P1/P2)

5. **Recommendations**:
   - Required fixes before production
   - Nice-to-have improvements
   - Future test coverage needs

---

## Success Criteria

**Must Pass (P0)**:
- [ ] All User Management tests (Suite 1) pass
- [ ] All Client Management tests (Suite 2) pass
- [ ] All Cleaning Job tests (Suite 3) pass
- [ ] RBAC enforcement tests (Suite 4) pass
- [ ] NO V1 schema artifacts in UI (Suite 5.1)
- [ ] NO console errors during workflows (Suite 5.2)

**Should Pass (P1)**:
- [ ] Data integrity validation (Suite 6) confirms V2 schema

**Total Pass Rate Target**: 100% of P0 tests, 90%+ overall

---

## Notes for Tester Agent

1. **Take Your Time**: Each test case should be executed methodically with screenshots/notes
2. **Document Everything**: Capture error messages, screenshots, and unexpected behavior
3. **Don't Fix Bugs**: Report all issues - developer agent will fix in next iteration
4. **Console Monitoring**: Keep DevTools open throughout testing to catch JavaScript errors
5. **Database Verification**: Optional but recommended for comprehensive validation
6. **Fresh Session**: Logout/login between role tests to avoid session conflicts

---

## Timeline

**Estimated Duration**: 2-3 hours

- Suite 1 (User Management): 30 minutes
- Suite 2 (Client/Property Management): 60 minutes
- Suite 3 (Cleaning Jobs): 30 minutes
- Suite 4 (RBAC): 15 minutes
- Suite 5 (UI/UX Validation): 15 minutes
- Suite 6 (Data Integrity): 15 minutes
- Report Writing: 30 minutes

---

**END OF WORK ORDER**

**Related Work Order**: WO-20251114-DEV-PROPERTY-MGMT.md (Developer Implementation)

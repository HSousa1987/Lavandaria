# 🧪 Tester Prompt: Full CRUD Validation

**Priority**: P0 - CRITICAL
**Test Type**: Manual UI Testing + Automated E2E Suite
**Scope**: Complete system validation - ALL CRUD operations
**Assigned to**: Tester Agent
**Created**: 2025-11-08

---

## 🎯 YOUR MISSION

Test **EVERYTHING** through the web UI like a real user would. This is comprehensive validation of all CRUD (Create, Read, Update, Delete) operations across the entire Lavandaria system.

**Testing Philosophy**:
> "Enter everything in UI to test everything. We can see everything that is broken right away and fix it so it doesn't scale."

**No shortcuts**:
- ❌ NO API testing (use the UI)
- ❌ NO database inserts (create through forms)
- ❌ NO test data seeding (build entities via UI)
- ✅ YES click buttons, fill forms, upload files
- ✅ YES verify every field appears correctly
- ✅ YES test edit/delete workflows
- ✅ YES validate error messages with correlation IDs

---

## 📋 PRE-TEST CHECKLIST

Before starting, verify:

- [ ] Developer has completed PR for WO-20251108-UI-CRUD
- [ ] Developer PR is merged to main branch
- [ ] Backend server is running: `docker-compose ps` shows healthy containers
- [ ] Frontend is built: `cd client && npm run build && cd ..`
- [ ] Browser: Use **Chrome** in normal mode (not incognito) to inspect DevTools
- [ ] DevTools open: Console tab (for logs) + Network tab (for requests)

---

## 🧪 PART 1: AUTOMATED E2E TESTS

Run the comprehensive E2E test suite created by Maestro:

```bash
# Run all CRUD validation tests
npx playwright test tests/e2e/maestro-full-crud-validation.spec.js --headed

# Or run in headless CI mode
CI=true npx playwright test tests/e2e/maestro-full-crud-validation.spec.js
```

**Expected Results**:
```
Running 25 tests...

✓ User Management (4 tests)
  ✓ Master creates Admin user via UI
  ✓ Master edits Admin user via UI
  ✓ Master deletes Worker user via UI
  ✓ [all user tests pass]

✓ Client Management (3 tests)
  ✓ Admin creates Client via UI
  ✓ Admin edits Client via UI - change every field
  ✓ Admin deletes Client via UI

✓ Cleaning Job Management (4 tests)
  ✓ Admin creates Cleaning Job via UI
  ✓ Admin edits Cleaning Job via UI - change all fields
  ✓ Admin updates Cleaning Job status via UI
  ✓ Admin deletes Cleaning Job via UI

✓ Laundry Order Management (4 tests)
  ✓ Admin creates Laundry Order via UI
  ✓ Admin edits Laundry Order via UI
  ✓ Admin updates Laundry Order status via UI
  ✓ Admin deletes Laundry Order via UI

✓ Photo Upload Workflows (3 tests)
  ✓ Worker uploads photos to assigned job via UI
  ✓ Worker uploads multiple batches (20+ photos) via UI
  ✓ Client views photos for their job via UI

✓ Payment Recording (1 test)
  ✓ Admin records payment for completed job via UI

✓ Service Management (3 tests)
  ✓ Master creates Laundry Service via UI
  ✓ Master edits Laundry Service pricing via UI
  ✓ Master deactivates Laundry Service via UI

✓ Complete Workflows (1 test)
  ✓ Complete workflow: Create client → Create job → Assign worker → Upload photos → Mark complete → Record payment

25 passed (3 minutes)
```

**If ANY test fails**:
1. Open Playwright HTML report: `npx playwright show-report`
2. View trace file for failed test
3. Screenshot and video artifacts in `test-results/`
4. Report failure to Developer with:
   - Test name
   - Error message
   - Screenshot
   - Correlation ID (if visible)

---

## 🖱️ PART 2: MANUAL UI TESTING CHECKLIST

### Test 1: User Management (Master Role)

**Login as Master**:
1. Open http://localhost:3000
2. Click "Staff" tab
3. Enter: `master` / `master123`
4. Click "Login"
5. Verify URL: `http://localhost:3000/dashboard`
6. Verify welcome message: "Master User" visible

**Create Admin User**:
1. Click "Users" tab
2. Verify "Add User" button is visible (green, top-right)
3. Click "Add User"
4. Verify modal opens with title: "Create New User"
5. Fill form:
   - Username: `testadmin`
   - Password: `testpass123`
   - Role: Select "Admin" from dropdown
   - Phone: `912345678`
6. Click "Create User" button
7. **Expected**: Success message appears with correlation ID (format: `req_1762...`)
8. **Expected**: Modal closes automatically
9. **Expected**: User list refreshes and shows "testadmin" in table
10. Open DevTools Network tab → Find POST /api/users → Status should be 201 Created
11. **Expected**: Response includes correlation ID in _meta field

**Edit Admin User**:
1. Find "testadmin" row in user table
2. Click "Edit" button (pencil icon or text)
3. Verify modal opens with title: "Edit User" or "Update User"
4. Verify fields are pre-filled with existing data
5. Change phone to: `919999999`
6. Click "Update User" or "Save"
7. **Expected**: Success message with correlation ID
8. **Expected**: Table refreshes and shows new phone "919999999"

**Delete Worker User**:
1. Click "Add User" again
2. Create worker: Username `deleteme`, Password `testpass123`, Role "Worker", Phone `911111111`
3. Find "deleteme" row
4. Click "Delete" button (trash icon)
5. **Expected**: Confirmation dialog: "Are you sure you want to delete deleteme?"
6. Click "Confirm" or "OK"
7. **Expected**: Success message with correlation ID
8. **Expected**: "deleteme" row disappears from table

**Checkpoints**:
- [ ] Add User button visible ✅
- [ ] Modal opens correctly ✅
- [ ] Form validates (can't submit empty) ✅
- [ ] Success message shows correlation ID ✅
- [ ] Edit pre-fills fields ✅
- [ ] Delete shows confirmation ✅
- [ ] Console has no errors ✅

---

### Test 2: Client Management (Admin Role)

**Login as Admin**:
1. Logout from Master
2. Login with: `admin` / `admin123`
3. Verify dashboard loads

**Create Client**:
1. Click "Clients" tab
2. Click "Add Client" button
3. Fill form:
   - Name: `Test Client Full Name`
   - Phone: `922222222`
   - Email: `testclient@example.com`
   - Address: `Rua de Teste, 123, Porto`
   - Notes: `Created by Tester for validation`
4. Click "Create Client"
5. **Expected**: Success with correlation ID
6. **Expected**: Client appears in table

**Edit Client - Change EVERY Field**:
1. Find "Test Client Full Name" row
2. Click "Edit"
3. Change ALL fields:
   - Name: `EDITED Client Name`
   - Phone: `933333333`
   - Email: `edited@example.com`
   - Address: `EDITED Address 456`
   - Notes: `All fields edited`
4. Click "Update" or "Save"
5. **Expected**: Success with correlation ID
6. **Expected**: ALL changes appear in table

**Delete Client**:
1. Click "Add Client"
2. Create: Name `Delete Me`, Phone `944444444`
3. Find "Delete Me" row
4. Click "Delete"
5. Confirm deletion
6. **Expected**: Success message
7. **Expected**: "Delete Me" row removed

**Checkpoints**:
- [ ] Add Client button visible ✅
- [ ] All form fields work ✅
- [ ] Email validation (format check) ✅
- [ ] Phone validation (9 digits) ✅
- [ ] Edit pre-fills all fields ✅
- [ ] All field changes persist ✅
- [ ] Delete works ✅

---

### Test 3: Cleaning Job Management (Admin Role)

**Create Cleaning Job**:
1. Stay logged in as Admin
2. Click "Cleaning Jobs" tab
3. Click "Create Job" or "Add Job" button
4. Fill form:
   - Client: Click dropdown → Type "Test Client" → Select first match
   - Job Type: Select "Airbnb"
   - Address: `Rua da Limpeza, 42, Lisboa`
   - Date: Tomorrow's date (use date picker)
   - Time: `14:00`
   - Assigned Worker: Select first worker from dropdown
5. Click "Create Job" or "Save"
6. **Expected**: Success with correlation ID
7. **Expected**: Job appears in jobs list with "Scheduled" status

**Edit Cleaning Job - Change All Fields**:
1. Find the job you just created
2. Click "Edit"
3. Change ALL fields:
   - Job Type: Change to "House"
   - Address: `EDITED ADDRESS 999`
   - Date: Next week
   - Time: `16:30`
4. Click "Update" or "Save"
5. **Expected**: Success with correlation ID
6. **Expected**: All changes visible in job row

**Update Job Status**:
1. Find the edited job
2. Locate status dropdown or status buttons
3. Change status to "In Progress"
4. **Expected**: Auto-save or click "Save"
5. **Expected**: Status updates to "In Progress"
6. Change status to "Completed"
7. **Expected**: Status updates to "Completed"

**Delete Cleaning Job**:
1. Create a new job: Client "Test", Address "DELETE ME JOB"
2. Find "DELETE ME JOB" row
3. Click "Delete"
4. Confirm
5. **Expected**: Success message
6. **Expected**: Job removed

**Checkpoints**:
- [ ] Create Job button visible ✅
- [ ] Client searchable dropdown works ✅
- [ ] Worker dropdown populated ✅
- [ ] Date/time pickers work ✅
- [ ] Job appears in list ✅
- [ ] Edit pre-fills all fields ✅
- [ ] Status dropdown works ✅
- [ ] Status changes save ✅
- [ ] Delete works ✅

---

### Test 4: Laundry Order Management (Admin Role)

**PREREQUISITE**: Verify laundry services endpoint is fixed:
```bash
curl http://localhost:3000/api/laundry-services
# Should return 200 OK with service list (NOT 500 error)
```

**Create Laundry Order**:
1. Stay logged in as Admin
2. Click "Laundry Orders" tab
3. Click "Create Order" or "Add Order" button
4. Fill form:
   - Client: Select "Test Client"
   - Services: Check 2-3 service checkboxes (e.g., "Wash & Fold", "Dry Cleaning")
   - Weight (if bulk_kg): `5.5` kg
   - Pickup Date: Tomorrow
5. **Expected**: Total price calculates automatically based on services + weight
6. Verify total price is displayed (e.g., "€35.50")
7. Click "Create Order"
8. **Expected**: Success with correlation ID
9. **Expected**: Order appears in order list with "Received" status

**Edit Laundry Order**:
1. Find the order you created
2. Click "Edit"
3. Change:
   - Weight: `8.0` kg
   - Pickup Date: 3 days from now
4. Click "Update"
5. **Expected**: Total price recalculates
6. **Expected**: Changes appear in order row

**Update Order Status**:
1. Find the order
2. Change status to "In Progress"
3. **Expected**: Status updates
4. Change status to "Ready"
5. **Expected**: Status updates (should trigger client notification in logs)
6. Change status to "Collected"
7. **Expected**: Status updates

**Delete Laundry Order**:
1. Create order: Client "Test", Weight `2.0` kg
2. Find the order
3. Click "Delete"
4. Confirm
5. **Expected**: Success message
6. **Expected**: Order removed

**Checkpoints**:
- [ ] GET /api/laundry-services returns 200 OK ✅
- [ ] Create Order button visible ✅
- [ ] Services dropdown/checkboxes populated ✅
- [ ] Total price calculates correctly ✅
- [ ] Order appears in list ✅
- [ ] Edit pre-fills fields ✅
- [ ] Status changes work ✅
- [ ] "Ready" status triggers notification (check logs) ✅
- [ ] Delete works ✅

---

### Test 5: Photo Upload Workflows (Worker Role)

**Login as Worker**:
1. Logout from Admin
2. Login with: `worker` / `worker123`
3. Verify dashboard loads

**Upload Photos to Assigned Job**:
1. Click "My Jobs" tab
2. Find first assigned job (status "Scheduled" or "In Progress")
3. Click "View Details" or "Upload Photos" button
4. **Expected**: Modal/page opens showing job details
5. Verify file upload section visible
6. Create 2 test image files (or use existing fixtures):
   - `tests/fixtures/test-photo-1.jpg`
   - `tests/fixtures/test-photo-2.jpg`
7. Click "Choose Files" or drag-and-drop
8. Select both photos
9. **Expected**: File names appear (e.g., "2 files selected")
10. Click "Upload" button
11. **Expected**: Success message with correlation ID
12. **Expected**: Photos appear in photo list/gallery
13. Open DevTools Network → Find POST /api/cleaning-jobs/{id}/photos → Status 201
14. **Expected**: Response includes correlation ID

**Upload Multiple Batches (10 + 10 photos)**:
1. Stay on job details page
2. Upload Batch 1: 10 photos
3. Click "Upload"
4. **Expected**: Success message
5. **Expected**: "10 photos uploaded" or similar
6. Repeat: Upload Batch 2: 10 MORE photos
7. Click "Upload"
8. **Expected**: Success message (form should reset after Batch 1)
9. **Expected**: Total count shows "20 photos"

**Checkpoints**:
- [ ] Worker can see "My Jobs" tab ✅
- [ ] Only assigned jobs appear ✅
- [ ] Upload Photos button visible ✅
- [ ] File input allows multiple files ✅
- [ ] Upload works with 1-10 files ✅
- [ ] Multi-batch upload works (form resets) ✅
- [ ] Console shows correlation IDs ✅

---

### Test 6: Client Photo Viewing (Client Role)

**Login as Client**:
1. Logout from Worker
2. Go to http://localhost:3000
3. Stay on "Client" tab (don't click Staff)
4. Enter Phone: `911111111`
5. Enter Password: `lavandaria2025`
6. Click "Login"
7. **Expected**: Redirect to `/dashboard`

**View Photos for Own Job**:
1. Click "My Jobs" or "My Orders" tab
2. Find job with photos (look for "X photos" text)
3. Click "View Photos" or "View Details"
4. **Expected**: Photo gallery opens
5. **Expected**: All photos for this job are visible (thumbnails or full-size)
6. **Expected**: No photos from other clients' jobs appear
7. Open DevTools Network → Find GET /api/cleaning-jobs/{id}/photos
8. **Expected**: Status 200, correlation ID in response

**Pagination (if job has >10 photos)**:
1. If job has >10 photos, pagination buttons should appear
2. Click "Next" or "Page 2"
3. **Expected**: Next set of photos loads
4. **Expected**: Correlation ID in new request

**Checkpoints**:
- [ ] Client login works (phone + password) ✅
- [ ] Client can see "My Jobs" tab ✅
- [ ] Only client's own jobs appear ✅
- [ ] Photo gallery loads ✅
- [ ] Pagination works (if applicable) ✅
- [ ] Viewing tracked in database (passive - no UI change needed) ✅

---

### Test 7: Payment Recording (Admin Role)

**Login as Admin**:
1. Logout from Client
2. Login as Admin

**Record Payment for Completed Job**:
1. Click "Cleaning Jobs" tab
2. Find a job with status "Completed"
3. Click "Record Payment" or "Add Payment" button
4. **Expected**: Modal opens with payment form
5. Fill form:
   - Amount: `85.50`
   - Payment Method: Select "Cash"
   - Payment Date: Today's date
   - Notes: `Paid in full - Tester validation`
6. Click "Save Payment" or "Record"
7. **Expected**: Success message with correlation ID
8. **Expected**: Payment appears in job details (e.g., "€85.50 - Paid" badge)

**Checkpoints**:
- [ ] Record Payment button visible for completed jobs ✅
- [ ] Payment form has all fields ✅
- [ ] Amount validates (numeric) ✅
- [ ] Payment Method dropdown works ✅
- [ ] Payment saves successfully ✅
- [ ] Payment appears in job details ✅

---

### Test 8: Service Management (Master Role)

**Login as Master**:
1. Logout from Admin
2. Login as Master

**Create Laundry Service**:
1. Click "Services" tab (or "Settings" → "Services")
2. Click "Add Service" button
3. Fill form:
   - Name: `Test Service E2E`
   - Service Type: Select "Wash & Fold"
   - Base Price: `12.50`
   - Unit: Select "kg"
   - Estimated Duration: `60` minutes
   - Description: `Created by Tester for validation`
4. Click "Create Service"
5. **Expected**: Success with correlation ID
6. **Expected**: Service appears in service list

**Edit Service Pricing**:
1. Find "Test Service E2E"
2. Click "Edit"
3. Change Base Price: `15.00`
4. Click "Update"
5. **Expected**: Success message
6. **Expected**: New price `€15.00` appears

**Deactivate Service**:
1. Find an active service
2. Click "Deactivate" button or toggle "Active" switch to OFF
3. **Expected**: Success message
4. **Expected**: Service marked as "Inactive" or grayed out

**Checkpoints**:
- [ ] Add Service button visible (Master only) ✅
- [ ] Service form validates (required fields) ✅
- [ ] Service creation works ✅
- [ ] Edit pre-fills fields ✅
- [ ] Price update works ✅
- [ ] Deactivate/activate toggle works ✅

---

### Test 9: Complete End-to-End Workflow

**Goal**: Test the full lifecycle from client creation to payment

**Steps**:
1. Login as Admin
2. **Create Client**: Name "E2E Workflow Client", Phone `955555555`
3. **Create Cleaning Job**:
   - Client: "E2E Workflow Client"
   - Job Type: Airbnb
   - Address: "Complete Workflow Test Address"
   - Date: Tomorrow, Time: 10:00
   - Worker: Assign first worker
4. Logout, Login as Worker
5. **Upload Photos**:
   - Go to "My Jobs"
   - Find "Complete Workflow Test Address"
   - Upload 2 photos
6. Logout, Login as Admin
7. **Mark Job Complete**:
   - Find "Complete Workflow Test Address"
   - Change status to "Completed"
8. **Record Payment**:
   - Click "Record Payment"
   - Amount: `150.00`, Method: Card
   - Save payment
9. **Verify**:
   - Job shows "Completed"
   - Payment badge shows "€150.00 - Paid"

**Checkpoints**:
- [ ] Full workflow completes without errors ✅
- [ ] All steps show correlation IDs ✅
- [ ] Console has no errors ✅
- [ ] Network tab shows all 200/201 responses ✅

---

## 🚫 NEGATIVE TESTING

### Invalid Input Validation

**Test 1: Empty Required Fields**:
1. Try to create user with empty username → **Expected**: Form validation error "Username is required"
2. Try to create client with empty name → **Expected**: Validation error
3. Try to create job with no client selected → **Expected**: Validation error

**Test 2: Invalid Phone Format**:
1. Try phone: `12345` (too short) → **Expected**: Validation error "Phone must be 9 digits"
2. Try phone: `abcdefghi` (letters) → **Expected**: Validation error

**Test 3: Invalid Email Format**:
1. Try email: `notanemail` → **Expected**: Validation error "Invalid email format"

**Test 4: Invalid Password (too short)**:
1. Try password: `123` → **Expected**: Validation error "Password must be at least 8 characters"

---

## 📊 BROWSER VALIDATION

### DevTools Console Check

**Throughout ALL testing**, keep Console tab open:

**Expected**:
- ✅ AuthContext logs: Login, checkAuth, user state changes
- ✅ Success messages with correlation IDs
- ❌ NO red errors (except expected validation errors)
- ❌ NO 500 errors
- ❌ NO CORS errors

**If you see errors**:
- Screenshot the console
- Copy full error message
- Note which action triggered it
- Report to Developer

### DevTools Network Check

**For EVERY form submission**, check Network tab:

**User Create**:
- Request: POST /api/users
- Status: 201 Created
- Response: `{ success: true, data: {...}, _meta: { correlationId: "req_...", timestamp: "..." } }`

**Client Create**:
- Request: POST /api/clients
- Status: 201 Created
- Response includes correlation ID

**Job Create**:
- Request: POST /api/cleaning-jobs
- Status: 201 Created
- Response includes correlation ID

**Photo Upload**:
- Request: POST /api/cleaning-jobs/{id}/photos
- Status: 201 Created
- Response includes correlation ID

**Red Flags**:
- ❌ Status 500 → Report as P0 bug
- ❌ Status 403/401 → RBAC issue, report
- ❌ Missing correlation ID → Report as P2 bug
- ❌ CORS error → Report as P0 bug

---

## 📝 TEST REPORT TEMPLATE

**Copy and fill this template**:

```markdown
# Tester Report: Full CRUD Validation

**Tested by**: [Your Name]
**Date**: 2025-11-08
**PR**: #[PR_NUMBER]
**Commit**: [COMMIT_HASH]
**Browser**: Chrome 120
**Test Duration**: X hours

## Automated E2E Tests

```bash
npx playwright test tests/e2e/maestro-full-crud-validation.spec.js
```

**Results**:
- Tests Run: 25
- Passed: X
- Failed: Y
- Screenshots: test-results/*/screenshot.png
- Videos: test-results/*/video.webm

**Pass Rate**: X%

## Manual UI Testing

| Test | Status | Notes | Correlation ID Example |
|------|--------|-------|------------------------|
| User Create | ✅ PASS | Works perfectly | req_1762570123456_abc |
| User Edit | ✅ PASS | All fields update | req_1762570123457_def |
| User Delete | ✅ PASS | Confirmation works | req_1762570123458_ghi |
| Client Create | ✅ PASS | Validation works | req_1762570123459_jkl |
| Client Edit | ❌ FAIL | Phone validation broken | N/A - error shown |
| ... | ... | ... | ... |

## Issues Found

### Issue #1: [Title]
- **Severity**: P0/P1/P2
- **Steps to Reproduce**:
  1. ...
  2. ...
- **Expected**: ...
- **Actual**: ...
- **Screenshot**: [attach]
- **Console Error**: [paste]
- **Correlation ID**: req_...

## Browser Validation

- Console Errors: [None / List]
- Network Errors: [None / List]
- CORS Issues: [None / List]

## Recommendation

✅ **APPROVE** - All tests passing, ready for production
❌ **REJECT** - [X] blocking issues found

---

**Evidence Attachments**:
1. Playwright HTML report
2. Screenshots of each CRUD operation
3. Network tab HAR export (for correlation ID verification)
```

---

## ⏱️ TIME ESTIMATE

- Automated E2E tests: 3-5 minutes
- Manual UI testing: 2-3 hours
- Report writing: 30 minutes
- **Total**: 3-4 hours

---

## 🎯 SUCCESS CRITERIA

**To APPROVE this Work Order**:
- [ ] All 25 automated E2E tests pass ✅
- [ ] All manual UI tests pass ✅
- [ ] No console errors during testing ✅
- [ ] All requests return 200/201 with correlation IDs ✅
- [ ] All CRUD operations work (Create, Read, Update, Delete) ✅
- [ ] Multi-batch photo upload works ✅
- [ ] Complete workflow test passes ✅
- [ ] Form validation works correctly ✅
- [ ] Error messages display correlation IDs ✅

**If ANY criterion fails**: Report to Developer and REJECT PR.

---

**Priority**: P0 - CRITICAL
**Blockers**: Must pass before production release
**Next Steps**: Once approved, Developer will merge PR and close WO-20251108-UI-CRUD


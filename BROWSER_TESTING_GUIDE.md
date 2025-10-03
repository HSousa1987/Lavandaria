# Browser Testing Guide - Lavandaria System

## 🌐 Access the Application

**URL:** http://localhost:3000

---

## ⚠️ IMPORTANT: Clear Browser Cache First!

Before testing, you MUST clear your browser cache to avoid seeing old forms:

### Method 1: DevTools (Recommended)
1. Press **F12** to open DevTools
2. Go to **Application** tab
3. Click **Storage** in left sidebar
4. Click **Clear site data** button
5. Close DevTools
6. Hard refresh: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac)

### Method 2: Browser Settings
**Chrome:**
- Press Ctrl+Shift+Delete
- Select "Cookies and other site data" and "Cached images and files"
- Time range: "Last hour"
- Click "Clear data"

**Firefox:**
- Press Ctrl+Shift+Delete
- Select "Cookies" and "Cache"
- Time range: "Last hour"
- Click "Clear Now"

---

## 🔐 Login Credentials

### Master (Platform Administrator - YOU)
- **Username:** `master`
- **Password:** `master123`
- **Permissions:** Full access to everything

### Admin (Business Management)
- **Username:** `admin`
- **Password:** `admin123`
- **Permissions:** Manage workers & clients, see billing

### Worker
- **Username:** `worker1`
- **Password:** `worker123`
- **Permissions:** View jobs and client contacts only

### Client
- **Phone:** `911111111`
- **Password:** `lavandaria2025`
- **Note:** Will prompt to change password on first login

---

## 📝 Test 1: Create a Worker (via Browser)

### Steps:

1. **Login as Master or Admin**
   - URL: http://localhost:3000
   - Enter username and password
   - Click "Login"

2. **Navigate to Users Tab**
   - Click "All Users" button (Master) or "Workers" button (Admin)

3. **Open Create User Form**
   - Click "Add User" button
   - Modal should appear with form

4. **Verify Form Has All Fields:**
   - ✅ Username *
   - ✅ Password *
   - ✅ Role * (dropdown: Admin/Worker)
   - ✅ First Name *
   - ✅ Last Name *
   - ✅ Email
   - ✅ Phone *
   - ✅ Date of Birth * (date picker)
   - ✅ NIF (Tax ID) *
   - ✅ Address * (textarea)

5. **Fill Out the Form:**
   ```
   Username: testworker2
   Password: test123
   Role: Worker
   First Name: Pedro
   Last Name: Costa
   Email: pedro@test.com
   Phone: 919876543
   Date of Birth: 1988-12-15
   NIF: 987654321
   Address: Rua Nova 789, Lisboa
   ```

6. **Submit Form**
   - Click "Create" button
   - Wait for success message
   - Form should close
   - New user should appear in the users list

7. **Verify User Was Created Correctly:**
   - Check the users table/list
   - User should show: **"Pedro Costa"** as full name
   - NOT "undefined undefined"
   - First name: Pedro
   - Last name: Costa
   - NIF: 987654321
   - Phone: 919876543

### ✅ Expected Result:
- User created successfully
- Full name shows "Pedro Costa"
- All fields saved correctly
- No "undefined undefined" errors

### ❌ If It Fails:
- Check browser console (F12) for errors
- Verify you cleared cache
- Check network tab to see the request payload

---

## 📝 Test 2: Create Individual Client (via Browser)

### Steps:

1. **Navigate to Clients Tab**
   - Click "Clients" button

2. **Open Create Client Form**
   - Click "Add Client" button
   - Modal should appear

3. **Verify Form Shows Client Type Toggle:**
   - ✅ Radio buttons: "Individual Person" and "Enterprise/Company"
   - ✅ Default selected: "Individual Person"

4. **Verify Individual Mode Fields:**
   - ✅ First Name * (required)
   - ✅ Last Name * (required)
   - ✅ Date of Birth * (required, date picker)
   - ✅ Phone *
   - ✅ Email
   - ✅ NIF (Tax ID) *
   - ✅ Address * (textarea)
   - ✅ Notes (textarea)

5. **Fill Out the Form:**
   ```
   Client Type: Individual Person (default)
   First Name: Rita
   Last Name: Fernandes
   Date of Birth: 1990-06-20
   Phone: 920123456
   Email: rita@email.com
   NIF: 111222333
   Address: Avenida Central 100, Porto
   Notes: Prefers afternoon appointments
   ```

6. **Submit Form**
   - Click "Create" button
   - Wait for success message
   - New client should appear in clients list

7. **Verify Client Created Correctly:**
   - Full name should show: **"Rita Fernandes"**
   - NOT "undefined undefined"
   - Is Enterprise: No/False
   - Date of Birth: 1990-06-20
   - NIF: 111222333

### ✅ Expected Result:
- Client created successfully
- Full name shows "Rita Fernandes"
- is_enterprise = false
- All fields saved correctly

---

## 📝 Test 3: Create Enterprise Client (via Browser)

### Steps:

1. **Open Create Client Form Again**
   - Click "Add Client" button

2. **Switch to Enterprise Mode**
   - Click the "Enterprise/Company" radio button
   - **Watch the form change!**

3. **Verify Enterprise Mode Fields:**
   - ✅ Company Name * (required, visible)
   - ✅ Phone *
   - ✅ Email
   - ✅ NIF (Tax ID) *
   - ✅ Address *
   - ✅ Notes
   - ❌ First Name (HIDDEN)
   - ❌ Last Name (HIDDEN)
   - ❌ Date of Birth (HIDDEN)

4. **Fill Out the Form:**
   ```
   Client Type: Enterprise/Company
   Company Name: TechSolutions Lda
   Phone: 921234567
   Email: info@techsolutions.pt
   NIF: 444555666
   Address: Parque Empresarial, Sala 12, Lisboa
   Notes: Monthly contract - invoicing required
   ```

5. **Submit Form**
   - Click "Create" button
   - New client should appear

6. **Verify Enterprise Client Created:**
   - Full name should show: **"TechSolutions Lda"**
   - Is Enterprise: Yes/True
   - Company name: TechSolutions Lda
   - Date of Birth: NULL (not required)
   - NIF: 444555666

### ✅ Expected Result:
- Enterprise client created
- Full name uses company name
- is_enterprise = true
- No date of birth or first/last name

---

## 📝 Test 4: Verify CRUD Operations

### View Users/Clients:
1. Click "All Users" or "Clients" tabs
2. Verify list displays correctly
3. Check that new entries show proper names

### Edit User (if implemented):
1. Click edit button on a user
2. Modify fields
3. Save changes
4. Verify updates appear

### Delete User/Client:
1. Click delete button
2. Confirm deletion
3. Verify item removed from list

---

## 🔍 Verification Checklist

After creating users and clients through the browser, verify:

### ✅ User Creation Checklist:
- [ ] Form shows all 10 fields
- [ ] Username field works
- [ ] Password field works (hidden text)
- [ ] Role dropdown shows options
- [ ] First name and last name are separate fields
- [ ] Date picker appears for date of birth
- [ ] NIF field accepts numbers
- [ ] Address textarea expands
- [ ] Form validates required fields (try submitting empty)
- [ ] Success message appears after creation
- [ ] User appears in users list immediately
- [ ] Full name shows "First Last" format
- [ ] NO "undefined undefined" appears

### ✅ Client Creation Checklist:
- [ ] Client type toggle appears (Individual/Enterprise)
- [ ] Default selection is "Individual Person"
- [ ] Switching to Enterprise HIDES first/last name and DOB
- [ ] Switching to Enterprise SHOWS company name field
- [ ] Individual mode shows first name, last name, DOB
- [ ] All required fields are marked with *
- [ ] Form validates based on client type
- [ ] Individual client creates with full name "First Last"
- [ ] Enterprise client creates with full name = company name
- [ ] is_enterprise flag set correctly
- [ ] NO "undefined undefined" appears

---

## 🐛 Troubleshooting

### Problem: Form shows old fields (just "Full Name")
**Solution:** You didn't clear your browser cache!
1. Open DevTools (F12)
2. Application → Clear site data
3. Hard refresh (Ctrl+Shift+R)

### Problem: "undefined undefined" still appears
**Possible Causes:**
1. Old data in database (created before fix)
   - Solution: Delete those old records
2. Form submitting wrong data
   - Solution: Check browser console for errors
   - Check Network tab to see request payload

### Problem: Form doesn't submit
**Check:**
1. Browser console for JavaScript errors
2. Network tab for failed requests (401, 403, 500 errors)
3. Make sure you're logged in as Master or Admin

### Problem: Modal doesn't appear
**Check:**
1. Click "Add User" or "Add Client" button
2. Check browser console for errors
3. Verify you're on the correct tab

### Problem: Fields don't show/hide when switching client type
**Check:**
1. Browser console for errors
2. Clear cache and reload
3. Verify React build was successful

---

## 🎯 What Success Looks Like

### User Creation Success:
```
Created user appears as:
Name: Pedro Costa
Username: testworker2
Role: Worker
Phone: 919876543
NIF: 987654321
```

### Individual Client Success:
```
Created client appears as:
Name: Rita Fernandes
Phone: 920123456
Type: Individual
NIF: 111222333
DOB: 1990-06-20
```

### Enterprise Client Success:
```
Created client appears as:
Name: TechSolutions Lda
Phone: 921234567
Type: Enterprise
NIF: 444555666
DOB: (empty/null)
```

---

## 📊 Database Verification (Optional)

After creating via browser, verify in database:

```bash
# Check users
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT id, username, first_name, last_name, full_name, nif FROM users WHERE username = 'testworker2';"

# Check individual client
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT id, phone, first_name, last_name, full_name, is_enterprise, nif FROM clients WHERE phone = '920123456';"

# Check enterprise client
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT id, phone, company_name, full_name, is_enterprise, nif FROM clients WHERE phone = '921234567';"
```

### Expected Database Output:

**User:**
```
 id | username    | first_name | last_name | full_name    | nif
----+-------------+------------+-----------+--------------+-----------
  X | testworker2 | Pedro      | Costa     | Pedro Costa  | 987654321
```

**Individual Client:**
```
 id | phone      | first_name | last_name  | full_name       | is_enterprise | nif
----+------------+------------+------------+-----------------+---------------+-----------
  X | 920123456  | Rita       | Fernandes  | Rita Fernandes  | f             | 111222333
```

**Enterprise Client:**
```
 id | phone      | company_name       | full_name          | is_enterprise | nif
----+------------+--------------------+--------------------+---------------+-----------
  X | 921234567  | TechSolutions Lda  | TechSolutions Lda  | t             | 444555666
```

---

## ✅ Final Checklist

Before saying "It works!":

- [ ] Cleared browser cache completely
- [ ] Hard refreshed the page (Ctrl+Shift+R)
- [ ] Logged in as Master or Admin
- [ ] Created at least one worker via browser form
- [ ] Verified worker shows proper full name (not "undefined undefined")
- [ ] Created at least one individual client
- [ ] Verified individual client has all fields
- [ ] Created at least one enterprise client
- [ ] Verified enterprise client uses company name
- [ ] Checked that client type toggle works (fields show/hide)
- [ ] All created records appear in the lists
- [ ] No console errors in browser

---

## 🎉 Success Criteria

The system is working correctly if:

1. ✅ User form shows all 10 fields (username, password, role, first/last name, email, phone, DOB, NIF, address)
2. ✅ Client form shows enterprise/individual toggle
3. ✅ Fields show/hide based on client type selection
4. ✅ Submitting forms creates records with correct data
5. ✅ Full names appear as "First Last" or "Company Name"
6. ✅ NO "undefined undefined" anywhere
7. ✅ All fields save to database correctly
8. ✅ New records appear in lists immediately

**If all checkboxes are checked, the CRUD system is fully functional!** 🎉

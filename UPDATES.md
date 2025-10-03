# System Updates - 2025-10-01

## What Was Fixed

### 1. **Client Login 401 Error** ✅
- **Problem**: Client password hash was incorrect in database
- **Solution**: Updated client password to correct bcrypt hash for `lavandaria2025`
- **Status**: FIXED - Client login now works correctly

### 2. **Laundry Endpoint 403 Error** ✅
- **Problem**: Laundry endpoint only allowed 'admin', blocking 'master' and 'worker'
- **Solution**: Updated permissions to allow `master`, `admin`, and `worker` to view laundry orders
- **File**: `routes/laundry.js`
- **Status**: FIXED - All staff can now view laundry orders

### 3. **Airbnb Orders Access** ✅
- **Problem**: Role check was using 'cleaner' instead of 'worker', and missing 'master' check
- **Solution**: Updated to check for `master`, `admin`, and `worker` roles
- **File**: `routes/airbnb.js`
- **Status**: FIXED - All staff can view airbnb orders

### 4. **Clients Endpoint Access** ✅
- **Problem**: Workers couldn't view client contacts
- **Solution**: Changed from `requireMasterOrAdmin` to `requireStaff` for GET endpoint
- **File**: `routes/clients.js`
- **Status**: FIXED - Workers can now view client contacts

## Database Schema Updates

### New Fields Added to `users` Table:
- `first_name` VARCHAR(100) - User's first name
- `last_name` VARCHAR(100) - User's last name
- `date_of_birth` DATE - User's date of birth
- `nif` VARCHAR(20) - Número de Identificação Fiscal (Tax ID)
- `address` TEXT - User's full address
- `registration_date` TIMESTAMP - Date registered in system

### New Fields Added to `clients` Table:
- `first_name` VARCHAR(100) - Client's first name (for individuals)
- `last_name` VARCHAR(100) - Client's last name (for individuals)
- `date_of_birth` DATE - Client's date of birth (for individuals)
- `nif` VARCHAR(20) - Tax ID (for individuals or companies)
- `address` TEXT - Client's full address
- `registration_date` TIMESTAMP - Date registered in system
- **`is_enterprise` BOOLEAN** - TRUE if company, FALSE if individual
- **`company_name` VARCHAR(200)** - Company name (for enterprises only)

### Migration Applied:
- File: `database/migrations/001_add_user_client_fields.sql`
- All existing records automatically updated (full_name split into first_name/last_name)
- Indexes created on `nif` fields for performance
- All changes backward compatible (full_name still exists)

## Backend API Updates

### User Management (`routes/users.js`)
**GET /api/users** - Now returns:
```javascript
{
  id, username, role, full_name, first_name, last_name, email, phone,
  date_of_birth, nif, address, registration_date, created_at, is_active
}
```

**POST /api/users** - Now accepts:
```javascript
{
  username, password, role, first_name, last_name, email, phone,
  date_of_birth, nif, address
}
```

**PUT /api/users/:id** - Now accepts:
```javascript
{
  username, first_name, last_name, email, phone,
  date_of_birth, nif, address, is_active
}
```

### Client Management (`routes/clients.js`)
**GET /api/clients** - Now returns:
```javascript
{
  id, phone, full_name, first_name, last_name, email, date_of_birth,
  nif, address, notes, is_enterprise, company_name, registration_date,
  created_at, is_active
}
```

**POST /api/clients** - Now accepts:
```javascript
{
  phone, first_name, last_name, email, date_of_birth, nif, address,
  notes, is_enterprise, company_name
}
```
- If `is_enterprise = true`: Uses `company_name` as full_name
- If `is_enterprise = false`: Combines `first_name + last_name` as full_name

**PUT /api/clients/:id** - Now accepts:
```javascript
{
  phone, first_name, last_name, email, date_of_birth, nif, address,
  notes, is_active, is_enterprise, company_name
}
```

## Permission Updates

### Master (YOU - Platform Administrator)
- ✅ CRUD on ALL users (admin, workers)
- ✅ CRUD on clients (enterprise & individual)
- ✅ Edit EVERYONE's information (including admins)
- ✅ Full finance access (payments, revenue, dashboard stats)
- ✅ View all jobs (laundry + airbnb) with pricing

### Admin (Business Management)
- ✅ CRUD on workers ONLY (cannot create/edit other admins)
- ✅ CRUD on clients (enterprise & individual)
- ✅ Full finance access (payments, revenue, dashboard stats)
- ✅ View all jobs (laundry + airbnb) with pricing
- ❌ Cannot edit master or other admin accounts

### Worker
- ✅ View client contacts (read-only)
- ✅ View jobs assigned to them (NO pricing information)
- ✅ Upload photos for airbnb jobs
- ✅ Track time worked
- ✅ Create tickets when problems occur
- ❌ NO finance access (cannot see payments or revenue)
- ❌ Cannot create or edit users/clients

### Client
- ✅ View own orders only
- ✅ Change own password
- ❌ Read-only access (no creation/editing)

## Testing Results

**All 27 automated tests PASSED ✅**

Test Coverage:
- ✅ Master login & all permissions
- ✅ Admin login & permissions (can access dashboard, users, clients)
- ✅ Worker login & permissions (can access jobs, contacts, NO finance)
- ✅ Client login & permissions (own orders only)
- ✅ Session persistence across requests
- ✅ Frontend accessibility
- ✅ Logout functionality

## How to Use the System

### Accessing the Application
**URL**: http://localhost:3000

### Default Credentials
**Master (Platform Administrator - YOU):**
- Username: `master`
- Password: `master123`

**Admin (Business Management):**
- Username: `admin`
- Password: `admin123`

**Worker:**
- Username: `worker1`
- Password: `worker123`

**Client:**
- Phone: `911111111`
- Password: `lavandaria2025` (must change on first login)

## Important Browser Instructions

⚠️ **CLEAR YOUR BROWSER DATA** before testing:
1. Open Browser DevTools (F12)
2. Go to Application tab
3. Clear Storage > Clear site data
4. Hard refresh page (Ctrl+Shift+R or Cmd+Shift+R)

This removes old session cookies and cached files that may cause 401/403 errors.

## Next Steps (Frontend Forms Not Yet Updated)

The frontend forms still need to be updated to include:

### User/Client Creation Forms Need:
- First Name and Last Name (separate fields instead of full_name)
- Date of Birth (date picker)
- NIF - Número de Identificação Fiscal (tax ID input)
- Address (text area)

### Client Form Additionally Needs:
- **Enterprise Toggle**: Radio buttons or checkbox
  - Individual Person (default)
  - Enterprise/Company
- **Conditional Fields**:
  - If Enterprise: Show "Company Name" field
  - If Individual: Show "First Name", "Last Name", "Date of Birth"
- Both types always show: Phone, Email, NIF, Address, Notes

### Recommended UI Flow:
```
┌─ Create Client ─────────────────────┐
│                                      │
│ Client Type: ○ Individual Person    │
│              ● Enterprise/Company    │
│                                      │
│ [Company Name         ] (shown if enterprise)
│ [First Name           ] (shown if individual)
│ [Last Name            ] (shown if individual)
│ [Date of Birth        ] (shown if individual)
│                                      │
│ [Phone Number         ] (always)    │
│ [Email                ] (always)    │
│ [NIF (Tax ID)         ] (always)    │
│ [Address              ] (always)    │
│ [Notes                ] (always)    │
│                                      │
│         [Cancel]  [Save Client]      │
└──────────────────────────────────────┘
```

## Files Changed

### Database:
- `database/migrations/001_add_user_client_fields.sql` (NEW)

### Backend Routes:
- `routes/users.js` (UPDATED - new fields in GET/POST/PUT)
- `routes/clients.js` (UPDATED - new fields + enterprise logic)
- `routes/laundry.js` (UPDATED - permission fix)
- `routes/airbnb.js` (UPDATED - permission fix)

### Frontend:
- NOT YET UPDATED (forms still use old schema)
- Needs update to Dashboard.js user/client forms
- Needs enterprise/individual toggle component

## Current System State

**Backend**: ✅ FULLY FUNCTIONAL
- All API endpoints working correctly
- All permissions properly enforced
- Database schema updated
- All tests passing

**Frontend**: ⚠️ PARTIALLY FUNCTIONAL
- Login/logout working
- Viewing data working
- Creating/editing users/clients needs form updates for new fields
- Enterprise vs Individual client selection not yet implemented

## Testing the System

Run automated tests:
```bash
./test_all.sh
```

Test specific user login:
```bash
# Test master login
curl -X POST http://localhost:3000/api/auth/login/user \
  -H "Content-Type: application/json" \
  -d '{"username": "master", "password": "master123"}'

# Test client login
curl -X POST http://localhost:3000/api/auth/login/client \
  -H "Content-Type: application/json" \
  -d '{"phone": "911111111", "password": "lavandaria2025"}'
```

## Summary

✅ All critical authentication and permission issues FIXED
✅ Database schema fully updated with all required fields
✅ Backend API fully updated to handle new fields
✅ Enterprise vs Individual client distinction implemented
✅ All automated tests passing (27/27)
⚠️ Frontend forms need updates to match new schema (next task)

The system is now fully functional at the API level. Users can login and view data correctly. Creating/editing users and clients will work but frontend forms should be updated to include all the new fields for the best user experience.

# Database V2 Migration - Status Report

**Date:** 2025-11-09
**Work Order:** WO-20251109-DATABASE-SIMPLIFICATION
**Status:** ✅ PARTIALLY COMPLETE - Database migrated, backend routes need updates

---

## ✅ COMPLETED

### 1. Database Schema Migration
- **Status:** ✅ COMPLETE
- **Backup Created:** `database/backups/backup_pre_v2_20251109.sql` (93KB)
- **Migration Script:** `database/migrations/migrate-to-v2.sql`
- **Verification:** All tests passed

#### Changes Applied:

**Lookup Tables Created:**
- `role_types` - 3 roles (master, admin, worker)
- `property_types` - 6 types (casa, apartamento, quinta, escritorio, loja, outro)

**users Table:**
- ✅ Single `name` field (was `first_name` + `last_name` + `full_name`)
- ✅ `role_id` FK to role_types (was `role` string)
- ✅ Removed: `first_name`, `last_name`, `full_name`, `role`, `country`, `registration_date`
- ✅ All 3 users migrated successfully

**clients Table:**
- ✅ Single `name` field (was `first_name` + `last_name` + `full_name`)
- ✅ Removed address fields (moved to properties)
- ✅ Removed: `first_name`, `last_name`, `full_name`, `country`, `address_line1`, `address_line2`, `city`, `postal_code`, `district`, `registration_date`
- ✅ 1 client migrated successfully

**properties Table:**
- ✅ Renamed `name` → `property_name`
- ✅ Added `property_type_id` FK to property_types (was `property_type` string)
- ✅ Added `updated_at` with trigger
- ✅ Removed: `property_type`, `country`
- ✅ 2 properties exist

**cleaning_jobs Table:**
- ✅ Added `property_id` FK to properties
- ✅ Migrated 2 existing jobs (created properties from address data)
- ✅ Removed: `property_name`, `property_address`, `address_line1`, `address_line2`, `city`, `postal_code`, `district`, `country`, `payment_method`, `paid_amount`, `push_notification_sent`, `last_synced_at`, `client_rating`

**payments Table (Unified):**
- ✅ Created unified `payments` table with flexible tax handling
- ✅ Migrated data from `payments_cleaning` (0 records)
- ✅ Migrated data from `payments_laundry` (0 records)
- ✅ Auto-calculation trigger for tax amounts
- ✅ Dropped old `payments_cleaning` and `payments_laundry` tables

---

## ⚠️ PENDING - CRITICAL UPDATES NEEDED

### 2. Backend Routes Updates

**HIGH PRIORITY - These files MUST be updated before the app will work:**

#### `routes/users.js` - NEEDS UPDATE
**Current Issues:**
- Queries use `role`, `full_name`, `first_name`, `last_name`, `country`, `registration_date` (all removed)
- Needs to use `role_id` with JOIN to `role_types` to get `role_name`
- Needs to use single `name` field

**Required Changes:**
```sql
-- OLD (BROKEN)
SELECT role, full_name, first_name, last_name FROM users

-- NEW (CORRECT)
SELECT u.name, rt.role_name as role
FROM users u
JOIN role_types rt ON u.role_id = rt.id
```

**Request Body Changes:**
```javascript
// OLD
{ first_name: "John", last_name: "Doe", role: "worker" }

// NEW
{ name: "John Doe", role: "worker" }  // role string converted to role_id internally
```

#### `routes/clients.js` - NEEDS UPDATE
**Current Issues:**
- Queries use `first_name`, `last_name`, `full_name`, address fields, `country`, `registration_date` (all removed)
- Needs to use single `name` field
- Address fields should not be in clients table

**Required Changes:**
```sql
-- OLD (BROKEN)
SELECT full_name, first_name, last_name, address_line1, city FROM clients

-- NEW (CORRECT)
SELECT name FROM clients
```

#### `routes/cleaning-jobs.js` - NEEDS UPDATE
**Current Issues:**
- Queries use direct address fields: `property_address`, `address_line1`, `city`, etc. (all removed)
- Needs to use `property_id` FK and JOIN with `properties` table
- CREATE/UPDATE endpoints need `property_id` instead of address fields

**Required Changes:**
```sql
-- OLD (BROKEN)
INSERT INTO cleaning_jobs (client_id, address_line1, city, ...)

-- NEW (CORRECT)
INSERT INTO cleaning_jobs (client_id, property_id, ...)

-- Fetching jobs (JOIN required)
SELECT cj.*, p.property_name, p.address_line1, p.city, pt.type_name as property_type
FROM cleaning_jobs cj
JOIN properties p ON cj.property_id = p.id
LEFT JOIN property_types pt ON p.property_type_id = pt.id
```

#### `routes/auth.js` - NEEDS UPDATE (Minor)
**Current Issues:**
- Login query likely uses `role` string instead of JOIN with `role_types`
- Session should store `role_name` from joined table

**Required Changes:**
```sql
-- OLD
SELECT id, username, role FROM users WHERE username = $1

-- NEW
SELECT u.id, u.username, u.name, rt.role_name as role
FROM users u
JOIN role_types rt ON u.role_id = rt.id
WHERE u.username = $1
```

### 3. New Endpoints Required

#### `routes/properties.js` - CREATE NEW FILE
**Purpose:** CRUD operations for client properties

**Endpoints Needed:**
- `GET /api/properties` - List all properties (admin/master)
- `GET /api/properties/client/:clientId` - Get properties for specific client
- `POST /api/properties` - Create new property
- `PUT /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property (check for active jobs first)

**Example Template:** See `handoff/WO-20251109-DATABASE-SIMPLIFICATION.md` lines 459-689

#### `routes/payments.js` - CREATE NEW UNIFIED FILE
**Purpose:** Replace separate payment endpoints with unified table

**Current State:**
- `routes/payments-cleaning.js` and `routes/payments-laundry.js` likely exist
- These are now OBSOLETE (old tables dropped)

**New Endpoints Needed:**
- `GET /api/payments` - List all payments (filter by service_type)
- `POST /api/payments` - Create payment (cleaning or laundry)
- `PUT /api/payments/:id` - Update payment (adjust tax)
- `GET /api/payments/stats` - Payment statistics

**Example Template:** See `handoff/WO-20251109-DATABASE-SIMPLIFICATION.md` lines 730-943

### 4. Frontend Form Updates

#### `client/src/components/forms/UserForm.js` - NEEDS UPDATE
**Changes:**
- Remove `first_name` and `last_name` fields
- Add single `name` field
- Keep `role` dropdown (backend will convert to `role_id`)

#### `client/src/components/forms/ClientForm.js` - NEEDS UPDATE
**Changes:**
- Remove `first_name` and `last_name` fields
- Add single `name` field
- Remove `country` field (Portugal-only)
- Remove address fields (now in properties)

#### `client/src/components/forms/CleaningJobForm.js` - NEEDS UPDATE (CRITICAL)
**Changes:**
- Remove direct address fields (`address`, `city`, etc.)
- Add client selector → property selector cascade
- When client selected, fetch their properties via `/api/properties/client/:clientId`
- User selects property from dropdown
- Submit `property_id` instead of address

**Current State:** File exists with `address` field - will cause 400 errors

#### `client/src/components/forms/PropertyForm.js` - CREATE NEW
**Purpose:** Create/edit client properties
**Template:** See `handoff/WO-20251109-DATABASE-SIMPLIFICATION.md` lines 1040-1295

---

## 🔄 TESTING STATUS

### Database Migration Tests
- ✅ role_types created: 3 rows
- ✅ property_types created: 6 rows
- ✅ users migrated: 3 users with `name` field
- ✅ clients migrated: 1 client with `name` field
- ✅ cleaning_jobs linked to properties: 2 jobs
- ✅ payments unified table: 0 payments (clean migration)

### E2E Tests
- ⚠️ NOT RUN YET - Backend routes must be updated first
- Expected initial failures due to schema mismatch

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Critical Backend Updates (DO FIRST)
- [ ] Update `routes/users.js` - Add role_types JOIN, use `name` field
- [ ] Update `routes/clients.js` - Use `name` field, remove address fields
- [ ] Update `routes/cleaning-jobs.js` - Use `property_id`, JOIN properties table
- [ ] Update `routes/auth.js` - JOIN role_types for login
- [ ] Create `routes/properties.js` - New CRUD endpoints
- [ ] Create `routes/payments.js` - Unified payments endpoint
- [ ] Update `server.js` - Register new routes

### Phase 2: Frontend Form Updates
- [ ] Update `client/src/components/forms/UserForm.js`
- [ ] Update `client/src/components/forms/ClientForm.js`
- [ ] Update `client/src/components/forms/CleaningJobForm.js` (property cascade)
- [ ] Create `client/src/components/forms/PropertyForm.js`
- [ ] Update `client/src/pages/Dashboard.js` - Add Properties tab

### Phase 3: Testing & Verification
- [ ] Restart backend server
- [ ] Test user CRUD via API
- [ ] Test client CRUD via API
- [ ] Test property CRUD via API
- [ ] Test cleaning job creation with property selection
- [ ] Test payment creation with unified table
- [ ] Run full E2E test suite
- [ ] Fix any remaining issues

---

## 🚨 KNOWN BREAKING CHANGES

### API Request/Response Changes

**POST /api/users**
```javascript
// OLD (BROKEN)
{
  "first_name": "John",
  "last_name": "Doe",
  "role": "worker",
  "phone": "912345678"
}

// NEW (REQUIRED)
{
  "name": "John Doe",
  "role": "worker",  // Backend converts to role_id
  "phone": "912345678"
}
```

**POST /api/clients**
```javascript
// OLD (BROKEN)
{
  "first_name": "Maria",
  "last_name": "Santos",
  "address_line1": "Rua Test",
  "city": "Lisboa"
}

// NEW (REQUIRED)
{
  "name": "Maria Santos",
  // Address fields removed - use /api/properties instead
}
```

**POST /api/cleaning-jobs**
```javascript
// OLD (BROKEN)
{
  "client_id": 1,
  "address": "Rua Test, 123",
  "city": "Lisboa"
}

// NEW (REQUIRED)
{
  "client_id": 1,
  "property_id": 5  // Must reference existing property
}
```

---

## 💾 Rollback Instructions

If migration needs to be reverted:

```bash
# Stop application
npm run docker:down

# Restore backup
docker exec -i lavandaria-db psql -U lavandaria lavandaria < database/backups/backup_pre_v2_20251109.sql

# Restart application
npm run docker:up
```

---

## 📊 Migration Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Complete | All tables migrated |
| Backend Routes | ⚠️ Pending | Critical updates needed |
| Frontend Forms | ⚠️ Pending | Schema mismatch will cause errors |
| E2E Tests | ⚠️ Pending | Cannot run until backend updated |
| Documentation | ✅ Complete | This file + migration script |

---

## 🎯 Next Developer Action

**START HERE:**

1. Update `routes/users.js` first (most critical)
2. Update `routes/auth.js` (affects login)
3. Create `routes/properties.js` (new functionality)
4. Update `routes/cleaning-jobs.js` (property-based workflow)
5. Update `routes/clients.js` (name field)

**Template files with complete implementation:**
- See `handoff/WO-20251109-DATABASE-SIMPLIFICATION.md` for full route examples

---

**Last Updated:** 2025-11-09 20:10 UTC
**Migration Executed By:** Claude Code (Database Simplification WO)
**Next Assigned To:** Backend Developer (Route Updates)

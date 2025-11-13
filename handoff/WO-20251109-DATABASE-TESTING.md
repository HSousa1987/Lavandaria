# Work Order: Database Simplification - Testing & Validation

**Work Order ID:** WO-20251109-DB-TESTING
**Date:** 2025-11-09
**Priority:** P0 - CRITICAL (Breaking Changes)
**Type:** E2E Testing + Database Validation
**Estimated Effort:** 8-10 hours

---

## Overview

Complete testing and validation of database restructuring for Portugal-only operations with property-based workflow and unified payments system.

**Related WO:** WO-20251109-DB-SIMPLIFY (Developer implementation)

---

## Part 1: Pre-Migration Validation

### 1.1 Database Backup Verification

**Checklist:**
- [ ] Full database backup created with timestamp
- [ ] Backup file size matches expected database size
- [ ] Backup can be restored to test environment
- [ ] Test restore completes without errors
- [ ] All tables present in restored backup
- [ ] Row counts match production

**Commands:**
```bash
# Verify backup exists
ls -lh database/backups/lavandaria_backup_*.sql

# Test restore in separate database
docker exec -i lavandaria-db createdb -U lavandaria lavandaria_test
docker exec -i lavandaria-db psql -U lavandaria lavandaria_test < database/backups/lavandaria_backup_*.sql

# Verify row counts
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT 'users' as table_name, COUNT(*) as rows FROM users
  UNION ALL SELECT 'clients', COUNT(*) FROM clients
  UNION ALL SELECT 'cleaning_jobs', COUNT(*) FROM cleaning_jobs
  UNION ALL SELECT 'laundry_orders_new', COUNT(*) FROM laundry_orders_new
  UNION ALL SELECT 'payments_cleaning', COUNT(*) FROM payments_cleaning
  UNION ALL SELECT 'payments_laundry', COUNT(*) FROM payments_laundry;
"

# Cleanup test database
docker exec -i lavandaria-db dropdb -U lavandaria lavandaria_test
```

**Expected Results:**
- Backup file exists with .sql extension
- Restore completes without SQL errors
- All row counts match production exactly

---

## Part 2: Migration Testing

### 2.1 Run Migration Script

**Checklist:**
- [ ] Migration script runs without errors
- [ ] All new tables created successfully
- [ ] All lookup data inserted correctly
- [ ] All foreign keys established
- [ ] All triggers created successfully
- [ ] Data migration completed without loss

**Commands:**
```bash
# Run migration on test database
docker exec -i lavandaria-db psql -U lavandaria lavandaria_test < database/migrations/migrate-to-v2.sql

# Check for errors
echo $?  # Should be 0 for success
```

**Expected Results:**
- Migration completes with `COMMIT` message
- No ERROR or FATAL messages in output
- Exit code is 0

### 2.2 Verify New Lookup Tables

**Checklist:**
- [ ] `role_types` table exists with 3 rows
- [ ] `property_types` table exists with 6+ rows
- [ ] All lookup values are correct

**Commands:**
```bash
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT * FROM role_types ORDER BY id;
"
# Expected: 1=master, 2=admin, 3=worker

docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT * FROM property_types ORDER BY id;
"
# Expected: casa, apartamento, quinta, escritorio, loja, outro
```

**Expected Results:**
| id | role_name | description |
|----|-----------|-------------|
| 1  | master    | System owner with full access |
| 2  | admin     | Manager with admin privileges |
| 3  | worker    | Field worker for jobs and orders |

| type_name   | description |
|-------------|-------------|
| casa        | House/Home  |
| apartamento | Apartment   |
| quinta      | Farm/Estate |
| escritorio  | Office      |
| loja        | Shop/Store  |
| outro       | Other       |

### 2.3 Verify Users Table Migration

**Checklist:**
- [ ] `name` column exists
- [ ] `role_id` column exists with FK to `role_types`
- [ ] `first_name` column removed
- [ ] `last_name` column removed
- [ ] `role` string column removed
- [ ] All existing users have `name` populated
- [ ] All users have correct `role_id`
- [ ] No NULL values in `name` or `role_id`

**Commands:**
```bash
# Check columns
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'users'
    AND column_name IN ('name', 'first_name', 'last_name', 'role', 'role_id')
  ORDER BY column_name;
"

# Verify data
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT u.id, u.username, u.name, u.role_id, rt.role_name
  FROM users u
  JOIN role_types rt ON u.role_id = rt.id
  LIMIT 10;
"

# Check for NULLs
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT COUNT(*) as null_names FROM users WHERE name IS NULL;
"
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT COUNT(*) as null_role_ids FROM users WHERE role_id IS NULL;
"
```

**Expected Results:**
- `name` column exists, type VARCHAR(100), NOT NULL
- `role_id` column exists, type INTEGER, NOT NULL
- `first_name`, `last_name`, `role` columns DO NOT exist
- All users have populated `name` field
- All `role_id` values match correct roles (1=master, 2=admin, 3=worker)
- Zero NULL values in `name` or `role_id`

### 2.4 Verify Clients Table Migration

**Checklist:**
- [ ] `name` column exists
- [ ] `first_name` column removed
- [ ] `last_name` column removed
- [ ] `country` column removed
- [ ] All existing clients have `name` populated
- [ ] No NULL values in `name`

**Commands:**
```bash
# Check columns
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'clients'
    AND column_name IN ('name', 'first_name', 'last_name', 'country')
  ORDER BY column_name;
"

# Verify data
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT id, phone, name, email FROM clients LIMIT 10;
"

# Check for NULLs
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT COUNT(*) as null_names FROM clients WHERE name IS NULL;
"
```

**Expected Results:**
- `name` column exists, type VARCHAR(100), NOT NULL
- `first_name`, `last_name`, `country` columns DO NOT exist
- All clients have populated `name` field
- Zero NULL values in `name`

### 2.5 Verify Properties Table Updates

**Checklist:**
- [ ] `property_type_id` column exists with FK
- [ ] `property_name` column exists
- [ ] `updated_at` column exists
- [ ] Trigger for `updated_at` created
- [ ] All existing properties have `property_type_id` populated
- [ ] Index on `property_type_id` exists

**Commands:**
```bash
# Check columns
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'properties'
    AND column_name IN ('property_name', 'property_type_id', 'updated_at')
  ORDER BY column_name;
"

# Verify FK
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT constraint_name, table_name, column_name
  FROM information_schema.key_column_usage
  WHERE table_name = 'properties'
    AND column_name = 'property_type_id';
"

# Verify data
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT p.id, p.client_id, p.property_name, p.city, pt.type_name
  FROM properties p
  LEFT JOIN property_types pt ON p.property_type_id = pt.id
  LIMIT 10;
"

# Check for NULLs in property_type_id
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT COUNT(*) as null_property_types FROM properties WHERE property_type_id IS NULL;
"

# Verify index
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT indexname FROM pg_indexes WHERE tablename = 'properties' AND indexname = 'idx_properties_type';
"
```

**Expected Results:**
- `property_type_id`, `property_name`, `updated_at` columns exist
- FK constraint on `property_type_id` points to `property_types(id)`
- All properties have `property_type_id` populated (defaulted to "outro" if NULL)
- Index `idx_properties_type` exists

### 2.6 Verify Cleaning Jobs Table Migration

**Checklist:**
- [ ] `property_id` column exists with FK
- [ ] `property_id` is NOT NULL
- [ ] Old address columns removed (`property_address`, `address_line1`, etc.)
- [ ] All existing jobs have `property_id` populated
- [ ] Properties created from old job addresses
- [ ] Index on `property_id` exists

**Commands:**
```bash
# Check columns
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'cleaning_jobs'
    AND column_name IN ('property_id', 'property_address', 'address_line1', 'city')
  ORDER BY column_name;
"

# Verify FK
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT constraint_name, table_name, column_name
  FROM information_schema.key_column_usage
  WHERE table_name = 'cleaning_jobs'
    AND column_name = 'property_id';
"

# Verify data
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT cj.id, cj.client_id, cj.property_id, p.property_name, p.address_line1, p.city
  FROM cleaning_jobs cj
  JOIN properties p ON cj.property_id = p.id
  LIMIT 10;
"

# Check for NULLs
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT COUNT(*) as null_property_ids FROM cleaning_jobs WHERE property_id IS NULL;
"

# Verify migrated properties exist
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT COUNT(*) as migrated_properties
  FROM properties
  WHERE property_name LIKE 'Migrated:%';
"
```

**Expected Results:**
- `property_id` column exists, type INTEGER, NOT NULL
- `property_address`, `address_line1`, `city` columns DO NOT exist
- FK constraint on `property_id` points to `properties(id)`
- All jobs have `property_id` populated
- Zero NULL values in `property_id`
- Properties with "Migrated:" prefix exist (if jobs existed before migration)

### 2.7 Verify Unified Payments Table

**Checklist:**
- [ ] `payments` table exists
- [ ] `service_type` column exists with CHECK constraint
- [ ] `tax_percentage` column exists with default 23.00
- [ ] `tax_amount` column exists
- [ ] `amount_before_tax` column exists
- [ ] `cleaning_job_id` and `laundry_order_id` columns exist
- [ ] CHECK constraint ensures only one service FK is set
- [ ] All old payment data migrated successfully
- [ ] Tax calculations are correct
- [ ] Trigger for tax calculation exists

**Commands:**
```bash
# Verify table exists
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT table_name FROM information_schema.tables WHERE table_name = 'payments';
"

# Check columns
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT column_name, data_type, column_default, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'payments'
    AND column_name IN ('service_type', 'tax_percentage', 'tax_amount', 'amount_before_tax', 'cleaning_job_id', 'laundry_order_id')
  ORDER BY column_name;
"

# Verify CHECK constraint
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
  WHERE conrelid = 'payments'::regclass
    AND contype = 'c';
"

# Count migrated payments
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT service_type, COUNT(*) as count, SUM(amount) as total_amount
  FROM payments
  GROUP BY service_type;
"

# Verify tax calculations (sample 10 rows)
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT
    id,
    amount,
    tax_percentage,
    amount_before_tax,
    tax_amount,
    ROUND((amount_before_tax + tax_amount)::numeric, 2) as recalculated_amount,
    ROUND((amount_before_tax + tax_amount)::numeric, 2) - amount as diff
  FROM payments
  LIMIT 10;
"

# Verify trigger exists
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT trigger_name, event_manipulation, action_statement
  FROM information_schema.triggers
  WHERE event_object_table = 'payments'
    AND trigger_name = 'trigger_calculate_payment_tax';
"
```

**Expected Results:**
- `payments` table exists
- `service_type` has CHECK constraint for 'cleaning' or 'laundry'
- `tax_percentage` defaults to 23.00
- `tax_amount` and `amount_before_tax` are auto-calculated
- CHECK constraint `check_single_service` exists
- Payment counts match old tables (cleaning + laundry = total)
- Tax calculation difference is 0.00 or ±0.01 (rounding)
- Trigger `trigger_calculate_payment_tax` exists

### 2.8 Verify Old Payment Tables Dropped

**Checklist:**
- [ ] `payments_cleaning` table does NOT exist
- [ ] `payments_laundry` table does NOT exist

**Commands:**
```bash
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_name IN ('payments_cleaning', 'payments_laundry');
"
```

**Expected Results:**
- Query returns 0 rows (tables do not exist)

---

## Part 3: Backend API Testing

### 3.1 User Endpoints Testing

**Base URL:** http://localhost:3000/api

#### Test 1: List Users
```bash
# Login as master
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"master","password":"master123"}'

# List users
curl -b cookies.txt http://localhost:3000/api/users
```

**Validation:**
- [ ] Response status: 200
- [ ] Each user has `name` field (not `first_name`/`last_name`)
- [ ] Each user has `role` field (from joined role_types)
- [ ] Correlation ID present in response

**Expected Response Structure:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "username": "master",
        "name": "Master Admin",
        "role": "master",
        "email": "master@lavandaria.com"
      }
    ]
  },
  "_meta": {
    "timestamp": "...",
    "correlationId": "req_..."
  }
}
```

#### Test 2: Create User
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testworker",
    "password": "test123",
    "role": "worker",
    "name": "Test Worker",
    "email": "test@lavandaria.com"
  }'
```

**Validation:**
- [ ] Response status: 201
- [ ] User created with `name` field
- [ ] `role_id` set correctly (3 for worker)
- [ ] No `first_name`/`last_name` in request

#### Test 3: Update User
```bash
curl -b cookies.txt -X PUT http://localhost:3000/api/users/4 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Test Worker",
    "email": "updated@lavandaria.com"
  }'
```

**Validation:**
- [ ] Response status: 200
- [ ] User name updated correctly
- [ ] No errors about `first_name`/`last_name`

### 3.2 Client Endpoints Testing

#### Test 1: List Clients
```bash
curl -b cookies.txt http://localhost:3000/api/clients
```

**Validation:**
- [ ] Response status: 200
- [ ] Each client has `name` field (not `first_name`/`last_name`)
- [ ] No `country` field in response
- [ ] Correlation ID present

#### Test 2: Create Client
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "912345678",
    "password": "client123",
    "name": "Test Client",
    "email": "testclient@example.com"
  }'
```

**Validation:**
- [ ] Response status: 201
- [ ] Client created with `name` field
- [ ] No `country` field in request/response
- [ ] Phone is unique

### 3.3 Properties Endpoints Testing

#### Test 1: List All Properties
```bash
curl -b cookies.txt http://localhost:3000/api/properties
```

**Validation:**
- [ ] Response status: 200
- [ ] Properties include `property_type` from joined table
- [ ] Properties include `client_name` from joined table
- [ ] All required fields present

#### Test 2: Get Client Properties
```bash
# Get properties for client ID 1
curl -b cookies.txt http://localhost:3000/api/properties/client/1
```

**Validation:**
- [ ] Response status: 200
- [ ] Only properties for specified client returned
- [ ] Properties sorted by `is_primary DESC, created_at DESC`
- [ ] `property_type` field present

#### Test 3: Create Property
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/properties \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 1,
    "property_name": "Test Apartment",
    "address_line1": "Rua de Teste, 123",
    "city": "Lisboa",
    "postal_code": "1100-123",
    "property_type_id": 2,
    "is_primary": false
  }'
```

**Validation:**
- [ ] Response status: 201
- [ ] Property created successfully
- [ ] `property_id` returned in response
- [ ] Correlation ID present

#### Test 4: Update Property
```bash
curl -b cookies.txt -X PUT http://localhost:3000/api/properties/1 \
  -H "Content-Type: application/json" \
  -d '{
    "property_name": "Updated Apartment",
    "city": "Porto"
  }'
```

**Validation:**
- [ ] Response status: 200
- [ ] Property updated successfully
- [ ] `updated_at` timestamp changed

#### Test 5: Delete Property (Should Fail if Jobs Exist)
```bash
# Try to delete property with existing cleaning jobs
curl -b cookies.txt -X DELETE http://localhost:3000/api/properties/1
```

**Validation:**
- [ ] Response status: 400 (if jobs exist) or 200 (if no jobs)
- [ ] Error message: "Cannot delete property with existing cleaning jobs"

### 3.4 Cleaning Jobs Endpoints Testing

#### Test 1: List Cleaning Jobs
```bash
curl -b cookies.txt http://localhost:3000/api/cleaning-jobs
```

**Validation:**
- [ ] Response status: 200
- [ ] Each job includes property details (joined)
- [ ] `property_name`, `address_line1`, `city` present
- [ ] No direct address fields in `cleaning_jobs` data

#### Test 2: Get Job Full Details
```bash
curl -b cookies.txt http://localhost:3000/api/cleaning-jobs/1/full
```

**Validation:**
- [ ] Response status: 200
- [ ] Property details included
- [ ] `property_type` field present
- [ ] No 500 error about missing columns

#### Test 3: Create Cleaning Job with Property
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/cleaning-jobs \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 1,
    "property_id": 1,
    "job_type": "house",
    "scheduled_date": "2025-12-01",
    "scheduled_time": "10:00",
    "estimated_hours": 3
  }'
```

**Validation:**
- [ ] Response status: 201
- [ ] Job created with `property_id`
- [ ] No `address` field in request
- [ ] Property FK validated

#### Test 4: Update Cleaning Job
```bash
curl -b cookies.txt -X PUT http://localhost:3000/api/cleaning-jobs/1 \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": 2,
    "scheduled_date": "2025-12-02"
  }'
```

**Validation:**
- [ ] Response status: 200
- [ ] `property_id` can be changed
- [ ] No errors about address fields

### 3.5 Payments Endpoints Testing

#### Test 1: List All Payments
```bash
curl -b cookies.txt http://localhost:3000/api/payments
```

**Validation:**
- [ ] Response status: 200
- [ ] Payments from both services included
- [ ] `service_type` field present ('cleaning' or 'laundry')
- [ ] `service_reference` field shows job ID or order number
- [ ] Tax fields present (`tax_percentage`, `tax_amount`, `amount_before_tax`)

#### Test 2: Filter Payments by Service Type
```bash
# Get only cleaning payments
curl -b cookies.txt "http://localhost:3000/api/payments?service_type=cleaning"

# Get only laundry payments
curl -b cookies.txt "http://localhost:3000/api/payments?service_type=laundry"
```

**Validation:**
- [ ] Response status: 200
- [ ] Only specified service type returned
- [ ] Counts match expected totals

#### Test 3: Create Cleaning Payment
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 1,
    "service_type": "cleaning",
    "cleaning_job_id": 1,
    "amount": 123.00,
    "payment_method": "cash"
  }'
```

**Validation:**
- [ ] Response status: 201
- [ ] Payment created successfully
- [ ] `tax_percentage` defaulted to 23.00
- [ ] `tax_amount` auto-calculated (~22.98)
- [ ] `amount_before_tax` auto-calculated (~100.02)
- [ ] Calculation: amount_before_tax + tax_amount ≈ amount

#### Test 4: Create Laundry Payment
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 1,
    "service_type": "laundry",
    "laundry_order_id": 1,
    "amount": 50.00,
    "payment_method": "card"
  }'
```

**Validation:**
- [ ] Response status: 201
- [ ] Payment created successfully
- [ ] Tax calculated correctly

#### Test 5: Update Payment Tax Percentage
```bash
# Master/Admin can change tax from 23% to 13%
curl -b cookies.txt -X PUT http://localhost:3000/api/payments/1 \
  -H "Content-Type: application/json" \
  -d '{
    "tax_percentage": 13.00
  }'
```

**Validation:**
- [ ] Response status: 200
- [ ] `tax_percentage` updated to 13.00
- [ ] `tax_amount` recalculated (trigger fired)
- [ ] `amount_before_tax` recalculated
- [ ] Client amount remains same

#### Test 6: Payment Statistics
```bash
curl -b cookies.txt http://localhost:3000/api/payments/stats
```

**Validation:**
- [ ] Response status: 200
- [ ] Stats grouped by `service_type`
- [ ] Totals calculated correctly
- [ ] Average tax percentage shown

#### Test 7: Validation - Missing Service FK
```bash
# Try to create cleaning payment without cleaning_job_id
curl -b cookies.txt -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 1,
    "service_type": "cleaning",
    "amount": 100.00,
    "payment_method": "cash"
  }'
```

**Validation:**
- [ ] Response status: 400
- [ ] Error: "cleaning_job_id required for cleaning payments"

#### Test 8: Validation - Invalid Service Type
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": 1,
    "service_type": "invalid",
    "amount": 100.00,
    "payment_method": "cash"
  }'
```

**Validation:**
- [ ] Response status: 400 or 500
- [ ] Database CHECK constraint violation

---

## Part 4: Frontend UI Testing

### 4.1 User Management UI

#### Test 1: View Users List
1. Login as master (`master` / `master123`)
2. Navigate to "Staff" tab
3. Verify users table displays

**Validation:**
- [ ] Users table shows `name` column (not first/last name)
- [ ] Role displayed correctly (master/admin/worker)
- [ ] No console errors

#### Test 2: Create New User
1. Click "Add User" button
2. Fill form:
   - Username: `newworker`
   - Name: `New Worker`  (single field, not first/last)
   - Role: Worker
   - Email: `newworker@test.com`
3. Submit form

**Validation:**
- [ ] Form has single "Name" field (not "First Name"/"Last Name")
- [ ] User created successfully
- [ ] Success message shown with correlation ID
- [ ] User appears in list with correct name

#### Test 3: Edit User
1. Click "Edit" on existing user
2. Change name to "Updated Name"
3. Save

**Validation:**
- [ ] Edit form shows single "Name" field
- [ ] Update successful
- [ ] Name updated in list

### 4.2 Client Management UI

#### Test 1: View Clients List
1. Navigate to "Clients" tab
2. Verify clients table displays

**Validation:**
- [ ] Clients table shows `name` column (not first/last name)
- [ ] No "Country" column visible
- [ ] All client names display correctly

#### Test 2: Create New Client
1. Click "Add Client" button
2. Fill form:
   - Phone: `913456789`
   - Name: `Test Client Name`  (single field)
   - Email: `test@client.com`
3. Submit form

**Validation:**
- [ ] Form has single "Name" field
- [ ] No "Country" field in form
- [ ] Client created successfully
- [ ] Appears in list

#### Test 3: Edit Client
1. Click "Edit" on existing client
2. Modify name and email
3. Save

**Validation:**
- [ ] Edit form shows single "Name" field
- [ ] No "Country" field in edit form
- [ ] Update successful

### 4.3 Properties Management UI

#### Test 1: View Properties Tab
1. Navigate to "Properties" tab (new tab)
2. Verify properties list displays

**Validation:**
- [ ] Properties tab exists in navigation
- [ ] Properties table shows columns: Name, Client, Address, City, Type
- [ ] Property types displayed from lookup table
- [ ] Client names displayed from joined table

#### Test 2: Create Property
1. Click "Add Property" button
2. Fill form:
   - Client: Select "João Santos"
   - Property Name: `Test House`
   - Address Line 1: `Rua Test, 123`
   - City: `Lisboa`
   - Postal Code: `1100-123`
   - Property Type: Select "casa"
   - Access Instructions: `Key under mat`
3. Submit form

**Validation:**
- [ ] Client dropdown populated with all clients
- [ ] Property Type dropdown shows: casa, apartamento, quinta, etc.
- [ ] Property created successfully
- [ ] Appears in properties list
- [ ] Correlation ID in success message

#### Test 3: Edit Property
1. Click "Edit" on existing property
2. Change property name and city
3. Save

**Validation:**
- [ ] Edit form pre-populated with current values
- [ ] Property type dropdown works
- [ ] Update successful
- [ ] Changes reflected in list

#### Test 4: Delete Property with Jobs (Should Fail)
1. Try to delete a property that has cleaning jobs
2. Verify error message

**Validation:**
- [ ] Error message: "Cannot delete property with existing cleaning jobs"
- [ ] Property NOT deleted
- [ ] User informed why deletion failed

#### Test 5: Delete Property without Jobs (Should Success)
1. Create new property
2. Delete it immediately (before creating jobs)
3. Verify deletion successful

**Validation:**
- [ ] Property deleted successfully
- [ ] Removed from list
- [ ] Success message shown

### 4.4 Cleaning Jobs Management UI

#### Test 1: View Cleaning Jobs
1. Navigate to "Cleaning Jobs" tab
2. Verify jobs list displays

**Validation:**
- [ ] Jobs table shows property address (not inline address)
- [ ] Property name/address comes from joined property
- [ ] No direct "Address" field in job row

#### Test 2: Create Cleaning Job with Property Selection
1. Click "Add Cleaning Job" button
2. Select Client: "João Santos"
3. **Wait for property dropdown to populate**
4. Select Property from dropdown
5. Fill rest of form:
   - Job Type: House
   - Scheduled Date: 2025-12-01
   - Scheduled Time: 10:00
6. Submit

**Validation:**
- [ ] Client dropdown shows all clients with names
- [ ] After selecting client, property dropdown enables
- [ ] Property dropdown shows ONLY properties for selected client
- [ ] Property options show: "Property Name - City" format
- [ ] Job created successfully
- [ ] Property ID saved with job

#### Test 3: Change Client (Properties Update)
1. In create job form, select Client A
2. Observe properties dropdown (shows Client A properties)
3. Change to Client B
4. Observe properties dropdown updates to Client B properties

**Validation:**
- [ ] Property dropdown clears when client changed
- [ ] Property dropdown repopulates with new client's properties
- [ ] Old property selection cleared

#### Test 4: Client with No Properties
1. Create new client with no properties
2. Try to create cleaning job for that client
3. Observe property dropdown

**Validation:**
- [ ] Property dropdown shows "No properties found"
- [ ] "Add Property" link/button shown
- [ ] User can click to add property inline or cancel job creation

#### Test 5: Edit Cleaning Job
1. Click "Edit" on existing job
2. Change property to different property (same client)
3. Save

**Validation:**
- [ ] Property dropdown pre-selected correctly
- [ ] Can change to different property
- [ ] Update successful

### 4.5 Payments Management UI

#### Test 1: View Payments Tab
1. Login as admin or master
2. Navigate to "Payments" tab
3. Verify payments list displays

**Validation:**
- [ ] Payments from both cleaning and laundry shown
- [ ] "Service Type" column shows "Cleaning" or "Laundry"
- [ ] "Service Reference" shows job ID or order number
- [ ] Tax columns visible: Tax %, Tax Amount, Amount Before Tax

#### Test 2: Create Cleaning Payment
1. Click "Add Payment" button
2. Select Service Type: "Cleaning"
3. Select Client
4. **Observe: Cleaning Job dropdown appears**
5. Select cleaning job from dropdown
6. Fill:
   - Amount: 123.00
   - Payment Method: Cash
   - Tax %: (should default to 23.00)
7. Submit

**Validation:**
- [ ] Service type selection shows "Cleaning" and "Laundry" options
- [ ] After selecting "Cleaning", cleaning job dropdown appears
- [ ] Laundry order dropdown is hidden
- [ ] Tax percentage defaults to 23.00
- [ ] Payment created successfully
- [ ] Tax calculations shown in success message or table

#### Test 3: Create Laundry Payment
1. Click "Add Payment" button
2. Select Service Type: "Laundry"
3. Select Client
4. **Observe: Laundry Order dropdown appears**
5. Select laundry order
6. Fill amount and method
7. Submit

**Validation:**
- [ ] After selecting "Laundry", laundry order dropdown appears
- [ ] Cleaning job dropdown is hidden
- [ ] Payment created successfully

#### Test 4: Adjust Tax Percentage (Master/Admin Only)
1. Find existing payment in list
2. Click "Edit" or "Adjust Tax"
3. Change tax from 23% to 13%
4. Save

**Validation:**
- [ ] Tax percentage editable
- [ ] After save, tax amount and amount before tax recalculated
- [ ] Client total amount remains same
- [ ] Updated values shown in table

#### Test 5: View Payment Statistics
1. Navigate to payment stats view
2. Verify aggregations displayed

**Validation:**
- [ ] Stats grouped by service type (Cleaning vs Laundry)
- [ ] Total amounts calculated correctly
- [ ] Average tax percentage shown
- [ ] Counts match actual payments

---

## Part 5: E2E Test Suite Updates

### 5.1 Run Existing E2E Tests

**Command:**
```bash
npm run test:e2e
```

**Validation:**
- [ ] ALL tests should FAIL (due to schema changes)
- [ ] Document which tests are broken
- [ ] Identify breaking changes:
  - User/client forms expecting `first_name`/`last_name`
  - Cleaning job forms expecting direct `address` field
  - Payment routes expecting split tables

**Expected Failures:**
- User CRUD tests (name field mismatch)
- Client CRUD tests (name field mismatch)
- Cleaning job CRUD tests (property_id vs address)
- Payment tests (unified table vs split tables)

### 5.2 Fix User CRUD Tests

**File:** `tests/e2e/user-crud.spec.js`

**Changes Needed:**
```javascript
// ❌ OLD
await page.fill('input[name="first_name"]', 'John');
await page.fill('input[name="last_name"]', 'Doe');

// ✅ NEW
await page.fill('input[name="name"]', 'John Doe');
```

**Validation:**
- [ ] User create test passes
- [ ] User edit test passes
- [ ] User list shows correct names

### 5.3 Fix Client CRUD Tests

**File:** `tests/e2e/client-crud.spec.js`

**Changes Needed:**
```javascript
// ❌ OLD
await page.fill('input[name="first_name"]', 'Jane');
await page.fill('input[name="last_name"]', 'Smith');
await page.selectOption('select[name="country"]', 'Portugal');

// ✅ NEW
await page.fill('input[name="name"]', 'Jane Smith');
// Country field removed entirely
```

**Validation:**
- [ ] Client create test passes
- [ ] Client edit test passes
- [ ] No errors about missing country field

### 5.4 Fix Cleaning Job CRUD Tests

**File:** `tests/e2e/cleaning-jobs-crud.spec.js`

**Changes Needed:**
```javascript
// ❌ OLD
await page.fill('input[name="address"]', 'Rua Test, 123');
await page.fill('input[name="city"]', 'Lisboa');

// ✅ NEW
await page.selectOption('select[name="client_id"]', { label: /João Santos/ });
await page.waitForSelector('select[name="property_id"]:not([disabled])');
await page.selectOption('select[name="property_id"]', { index: 1 });
```

**Validation:**
- [ ] Cleaning job create test passes
- [ ] Property cascade works
- [ ] Job links to property correctly

### 5.5 Create New Property E2E Tests

**File:** `tests/e2e/properties-crud.spec.js` (NEW)

**Tests to Add:**
- [ ] Create property for client
- [ ] Edit property
- [ ] Delete property (success and fail cases)
- [ ] List properties for specific client
- [ ] Property type dropdown works

### 5.6 Fix Payment E2E Tests

**File:** `tests/e2e/payments.spec.js`

**Changes Needed:**
```javascript
// ❌ OLD - Split endpoints
await axios.post('/api/payments-cleaning', { ... });
await axios.post('/api/payments-laundry', { ... });

// ✅ NEW - Unified endpoint
await axios.post('/api/payments', {
  service_type: 'cleaning',
  cleaning_job_id: 1,
  ...
});

await axios.post('/api/payments', {
  service_type: 'laundry',
  laundry_order_id: 1,
  ...
});
```

**Validation:**
- [ ] Cleaning payment test passes
- [ ] Laundry payment test passes
- [ ] Tax calculation test passes
- [ ] Payment stats test passes

### 5.7 Run Full E2E Suite

**Command:**
```bash
npm run test:e2e
```

**Target:** 100% Pass Rate

**Validation:**
- [ ] All user tests passing
- [ ] All client tests passing
- [ ] All property tests passing
- [ ] All cleaning job tests passing
- [ ] All payment tests passing
- [ ] No console errors
- [ ] All correlation IDs present

---

## Part 6: Data Integrity Validation

### 6.1 Foreign Key Integrity

**Commands:**
```bash
# Verify all users have valid role_id
docker exec -it lavandaria-db psql -U lavandaria lavandaria -c "
  SELECT COUNT(*) as invalid_users
  FROM users u
  LEFT JOIN role_types rt ON u.role_id = rt.id
  WHERE rt.id IS NULL;
"

# Verify all properties have valid client_id
docker exec -it lavandaria-db psql -U lavandaria lavandaria -c "
  SELECT COUNT(*) as invalid_properties
  FROM properties p
  LEFT JOIN clients c ON p.client_id = c.id
  WHERE c.id IS NULL;
"

# Verify all cleaning jobs have valid property_id
docker exec -it lavandaria-db psql -U lavandaria lavandaria -c "
  SELECT COUNT(*) as invalid_jobs
  FROM cleaning_jobs cj
  LEFT JOIN properties p ON cj.property_id = p.id
  WHERE p.id IS NULL;
"

# Verify all payments have valid service FK
docker exec -it lavandaria-db psql -U lavandaria lavandaria -c "
  SELECT COUNT(*) as invalid_cleaning_payments
  FROM payments p
  LEFT JOIN cleaning_jobs cj ON p.cleaning_job_id = cj.id
  WHERE p.service_type = 'cleaning' AND cj.id IS NULL;
"

docker exec -it lavandaria-db psql -U lavandaria lavandaria -c "
  SELECT COUNT(*) as invalid_laundry_payments
  FROM payments p
  LEFT JOIN laundry_orders_new lo ON p.laundry_order_id = lo.id
  WHERE p.service_type = 'laundry' AND lo.id IS NULL;
"
```

**Expected Results:**
- All counts should be 0 (no orphaned records)

### 6.2 Data Completeness

**Commands:**
```bash
# Check for NULL names
docker exec -it lavandaria-db psql -U lavandaria lavandaria -c "
  SELECT 'users' as table_name, COUNT(*) as null_names FROM users WHERE name IS NULL
  UNION ALL
  SELECT 'clients', COUNT(*) FROM clients WHERE name IS NULL;
"

# Check for NULL property_ids in jobs
docker exec -it lavandaria-db psql -U lavandaria lavandaria -c "
  SELECT COUNT(*) as null_property_ids FROM cleaning_jobs WHERE property_id IS NULL;
"

# Check for invalid service types
docker exec -it lavandaria-db psql -U lavandaria lavandaria -c "
  SELECT COUNT(*) as invalid_service_types
  FROM payments
  WHERE service_type NOT IN ('cleaning', 'laundry');
"
```

**Expected Results:**
- All NULL counts should be 0
- All invalid counts should be 0

### 6.3 Tax Calculation Accuracy

**Commands:**
```bash
# Verify tax calculations for all payments
docker exec -it lavandaria-db psql -U lavandaria lavandaria -c "
  SELECT
    COUNT(*) as total_payments,
    COUNT(CASE WHEN ABS((amount_before_tax + tax_amount) - amount) > 0.02 THEN 1 END) as calculation_errors
  FROM payments;
"
```

**Expected Results:**
- `calculation_errors` should be 0
- Acceptable rounding difference: ±0.02

---

## Part 7: Performance Testing

### 7.1 Query Performance

**Test Large Property List:**
```bash
docker exec -it lavandaria-db psql -U lavandaria lavandaria -c "
  EXPLAIN ANALYZE
  SELECT p.*, pt.type_name, c.name as client_name
  FROM properties p
  LEFT JOIN property_types pt ON p.property_type_id = pt.id
  JOIN clients c ON p.client_id = c.id
  ORDER BY p.created_at DESC
  LIMIT 100;
"
```

**Validation:**
- [ ] Query execution time < 50ms
- [ ] Indexes used correctly
- [ ] No sequential scans on large tables

**Test Unified Payments Query:**
```bash
docker exec -it lavandaria-db psql -U lavandaria lavandaria -c "
  EXPLAIN ANALYZE
  SELECT p.*, c.name as client_name,
         CASE
           WHEN p.service_type = 'cleaning' THEN cj.id::text
           WHEN p.service_type = 'laundry' THEN lo.order_number
         END as service_reference
  FROM payments p
  JOIN clients c ON p.client_id = c.id
  LEFT JOIN cleaning_jobs cj ON p.cleaning_job_id = cj.id
  LEFT JOIN laundry_orders_new lo ON p.laundry_order_id = lo.id
  ORDER BY p.payment_date DESC
  LIMIT 100;
"
```

**Validation:**
- [ ] Query execution time < 100ms
- [ ] Indexes on FKs used
- [ ] Efficient join strategy

---

## Part 8: Rollback Testing

### 8.1 Test Rollback Script

**Only run in test environment!**

```bash
# Apply migration
docker exec -i lavandaria-db psql -U lavandaria lavandaria_test < database/migrations/migrate-to-v2.sql

# Run rollback
docker exec -i lavandaria-db psql -U lavandaria lavandaria_test < database/migrations/rollback-v2.sql

# Verify old schema restored
docker exec -it lavandaria-db psql -U lavandaria lavandaria_test -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'users' AND column_name IN ('first_name', 'last_name', 'role');
"
```

**Validation:**
- [ ] Rollback completes without errors
- [ ] `first_name`, `last_name`, `role` columns restored
- [ ] Old payment tables restored
- [ ] Data preserved (names split back to first/last)

---

## Acceptance Criteria Summary

### Database:
- [ ] All new tables exist with correct structure
- [ ] All old tables/columns removed
- [ ] All data migrated without loss
- [ ] All FKs established correctly
- [ ] All triggers working
- [ ] No orphaned records

### Backend:
- [ ] All API endpoints return correct data
- [ ] Property cascade works (client → properties)
- [ ] Unified payments endpoint works
- [ ] Tax calculations accurate
- [ ] Correlation IDs present
- [ ] No 500 errors

### Frontend:
- [ ] All forms updated (name fields, no country)
- [ ] Property management UI working
- [ ] Client → Property cascade works
- [ ] Payment forms support both services
- [ ] Tax adjustment works

### Tests:
- [ ] All E2E tests passing
- [ ] No regressions
- [ ] New tests for properties added
- [ ] Performance acceptable

---

## Timeline

**Estimated:** 8-10 hours
- Database validation: 2 hours
- Backend API testing: 2 hours
- Frontend UI testing: 2 hours
- E2E test fixes: 3 hours
- Performance testing: 1 hour

**Dependencies:**
- WO-20251109-DB-SIMPLIFY must be completed first
- Migration script must pass review

---

**Status:** READY FOR TESTING (After Developer Completes WO-20251109-DB-SIMPLIFY)
**Last Updated:** 2025-11-09
**Tester:** TBD
**Reviewer:** Maestro

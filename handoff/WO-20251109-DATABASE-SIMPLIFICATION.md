# Work Order: Database Schema Simplification & Property-Based Workflow

**Work Order ID:** WO-20251109-DB-SIMPLIFY
**Date:** 2025-11-09
**Priority:** P0 - CRITICAL (Breaking Changes)
**Type:** Database Migration + Backend Refactoring
**Estimated Effort:** 12-16 hours

---

## Overview

Complete database restructuring to simplify operations for Portugal-only market with property-based cleaning job workflow and unified payments system.

### Key Changes:
1. **Name Simplification** - Remove `first_name`/`last_name`, use single `name` field
2. **Property-Based Workflow** - Client → Properties (1:N) → Cleaning Jobs
3. **Unified Payments** - Single table with service type discrimination
4. **Portugal-Only** - Remove country fields, simplify addressing
5. **Flexible Tax** - Master/Admin can adjust tax % per receipt while maintaining client price
6. **Role/Property Type Lookups** - Normalized lookup tables

---

## Part 1: Database Migration

### 1.1 New Schema File

**Location:** `database/SCHEMA-SIMPLIFIED-V2.sql`

**New Lookup Tables:**
- `role_types` - master, admin, worker (normalized)
- `property_types` - casa, apartamento, quinta, escritorio, loja, outro

**Modified Tables:**
- `users` - Remove `first_name`/`last_name`, add `name`, FK to `role_types`
- `clients` - Remove `first_name`/`last_name`/`country`, add `name`, simplified address
- `properties` - Enhanced with `property_type_id`, `property_name`, better indexing
- `cleaning_jobs` - Add `property_id` FK, remove direct address fields
- `payments` - **NEW unified table** replaces `payments_cleaning` + `payments_laundry`

**Removed Tables:**
- `payments_cleaning` - **DELETED** (replaced by unified `payments`)
- `payments_laundry` - **DELETED** (replaced by unified `payments`)

### 1.2 Migration Script

**Create:** `database/migrations/migrate-to-v2.sql`

```sql
-- MIGRATION: v1 → v2 (Simplified Schema)
-- WARNING: This is a BREAKING CHANGE - test in development first!

BEGIN;

-- Step 1: Create new lookup tables
CREATE TABLE role_types (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(20) UNIQUE NOT NULL CHECK (role_name IN ('master', 'admin', 'worker')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO role_types (id, role_name, description) VALUES
(1, 'master', 'System owner with full access'),
(2, 'admin', 'Manager with admin privileges'),
(3, 'worker', 'Field worker for jobs and orders');

CREATE TABLE property_types (
    id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO property_types (type_name, description) VALUES
('casa', 'House/Home'),
('apartamento', 'Apartment'),
('quinta', 'Farm/Estate'),
('escritorio', 'Office'),
('loja', 'Shop/Store'),
('outro', 'Other');

-- Step 2: Update users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER;

-- Migrate existing data: combine first_name + last_name → name
UPDATE users SET name = CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))
WHERE name IS NULL;

-- Clean up extra spaces
UPDATE users SET name = TRIM(name);

-- Map role string to role_id
UPDATE users SET role_id = 1 WHERE role = 'master';
UPDATE users SET role_id = 2 WHERE role = 'admin';
UPDATE users SET role_id = 3 WHERE role = 'worker';

-- Add FK constraint
ALTER TABLE users ADD CONSTRAINT fk_users_role_type FOREIGN KEY (role_id) REFERENCES role_types(id) ON DELETE RESTRICT;
ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE users ALTER COLUMN name SET NOT NULL;

-- Drop old columns
ALTER TABLE users DROP COLUMN IF EXISTS first_name;
ALTER TABLE users DROP COLUMN IF EXISTS last_name;
ALTER TABLE users DROP COLUMN IF EXISTS role;

-- Step 3: Update clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- Migrate existing data: combine first_name + last_name → name
UPDATE clients SET name = CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))
WHERE name IS NULL;

-- Clean up extra spaces
UPDATE clients SET name = TRIM(name);

-- Drop old columns
ALTER TABLE clients ALTER COLUMN name SET NOT NULL;
ALTER TABLE clients DROP COLUMN IF EXISTS first_name;
ALTER TABLE clients DROP COLUMN IF EXISTS last_name;
ALTER TABLE clients DROP COLUMN IF EXISTS country;

-- Step 4: Update properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_name VARCHAR(200);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_type_id INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Set default property type to 'outro' for existing properties
UPDATE properties SET property_type_id = (SELECT id FROM property_types WHERE type_name = 'outro')
WHERE property_type_id IS NULL;

-- Add FK constraint
ALTER TABLE properties ADD CONSTRAINT fk_properties_type FOREIGN KEY (property_type_id) REFERENCES property_types(id) ON DELETE SET NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_properties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_properties_updated_at();

-- Step 5: Update cleaning_jobs table
-- If property_id doesn't exist, create properties from existing address data
DO $$
DECLARE
    job_record RECORD;
    new_property_id INTEGER;
BEGIN
    -- Check if property_id column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'cleaning_jobs' AND column_name = 'property_id') THEN
        ALTER TABLE cleaning_jobs ADD COLUMN property_id INTEGER;

        -- Migrate existing jobs: create properties from address data
        FOR job_record IN SELECT id, client_id, property_address, address_line1, city FROM cleaning_jobs LOOP
            -- Create property from job address
            INSERT INTO properties (client_id, property_name, address_line1, city, property_type_id, is_primary)
            VALUES (
                job_record.client_id,
                'Migrated: ' || COALESCE(job_record.property_address, job_record.address_line1),
                job_record.address_line1,
                job_record.city,
                (SELECT id FROM property_types WHERE type_name = 'outro'),
                FALSE
            )
            RETURNING id INTO new_property_id;

            -- Link job to new property
            UPDATE cleaning_jobs SET property_id = new_property_id WHERE id = job_record.id;
        END LOOP;

        -- Add NOT NULL constraint after migration
        ALTER TABLE cleaning_jobs ALTER COLUMN property_id SET NOT NULL;

        -- Add FK constraint
        ALTER TABLE cleaning_jobs ADD CONSTRAINT fk_cleaning_jobs_property
            FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT;

        -- Drop old address columns
        ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS property_address;
        ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS address_line1;
        ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS address_line2;
        ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS city;
        ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS postal_code;

        -- Add index
        CREATE INDEX IF NOT EXISTS idx_cleaning_jobs_property ON cleaning_jobs(property_id);
    END IF;
END $$;

-- Step 6: Create unified payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

    service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('cleaning', 'laundry')),
    cleaning_job_id INTEGER REFERENCES cleaning_jobs(id) ON DELETE CASCADE,
    laundry_order_id INTEGER REFERENCES laundry_orders_new(id) ON DELETE CASCADE,

    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'mbway', 'other')),
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    tax_percentage DECIMAL(5,2) NOT NULL DEFAULT 23.00,
    tax_amount DECIMAL(10,2) NOT NULL,
    amount_before_tax DECIMAL(10,2) NOT NULL,

    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_single_service CHECK (
        (service_type = 'cleaning' AND cleaning_job_id IS NOT NULL AND laundry_order_id IS NULL) OR
        (service_type = 'laundry' AND laundry_order_id IS NOT NULL AND cleaning_job_id IS NULL)
    )
);

-- Migrate data from old payment tables
INSERT INTO payments (client_id, service_type, cleaning_job_id, amount, payment_method, payment_date, notes, created_at, tax_percentage, tax_amount, amount_before_tax)
SELECT
    client_id,
    'cleaning',
    cleaning_job_id,
    amount,
    payment_method,
    payment_date,
    notes,
    created_at,
    23.00, -- Default IVA
    amount - (amount / 1.23), -- Calculate tax
    amount / 1.23 -- Calculate amount before tax
FROM payments_cleaning
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments_cleaning');

INSERT INTO payments (client_id, service_type, laundry_order_id, amount, payment_method, payment_date, notes, created_at, tax_percentage, tax_amount, amount_before_tax)
SELECT
    client_id,
    'laundry',
    laundry_order_id,
    amount,
    payment_method,
    payment_date,
    notes,
    created_at,
    23.00, -- Default IVA
    amount - (amount / 1.23), -- Calculate tax
    amount / 1.23 -- Calculate amount before tax
FROM payments_laundry
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments_laundry');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_service_type ON payments(service_type);
CREATE INDEX IF NOT EXISTS idx_payments_cleaning_job ON payments(cleaning_job_id);
CREATE INDEX IF NOT EXISTS idx_payments_laundry_order ON payments(laundry_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);

-- Create trigger for tax calculation
CREATE OR REPLACE FUNCTION calculate_payment_tax()
RETURNS TRIGGER AS $$
BEGIN
    NEW.amount_before_tax = NEW.amount / (1 + (NEW.tax_percentage / 100));
    NEW.tax_amount = NEW.amount - NEW.amount_before_tax;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_payment_tax
    BEFORE INSERT OR UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION calculate_payment_tax();

-- Drop old payment tables (ONLY after verifying migration succeeded)
-- DROP TABLE IF EXISTS payments_cleaning CASCADE;
-- DROP TABLE IF EXISTS payments_laundry CASCADE;

-- Step 7: Update tickets table
-- Rename order_type/order_id to service_type and specific FKs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'order_type') THEN
        ALTER TABLE tickets RENAME COLUMN order_type TO service_type;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'order_id') THEN
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS cleaning_job_id INTEGER;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS laundry_order_id INTEGER;

        -- Try to migrate order_id based on service_type
        -- This is best-effort - manual review recommended

        ALTER TABLE tickets DROP COLUMN order_id;
    END IF;

    -- Add FKs if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'tickets_cleaning_job_id_fkey') THEN
        ALTER TABLE tickets ADD CONSTRAINT tickets_cleaning_job_id_fkey
            FOREIGN KEY (cleaning_job_id) REFERENCES cleaning_jobs(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'tickets_laundry_order_id_fkey') THEN
        ALTER TABLE tickets ADD CONSTRAINT tickets_laundry_order_id_fkey
            FOREIGN KEY (laundry_order_id) REFERENCES laundry_orders_new(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMIT;

-- ==============================================
-- POST-MIGRATION VERIFICATION
-- ==============================================

-- Verify role_types
SELECT * FROM role_types ORDER BY id;

-- Verify property_types
SELECT * FROM property_types ORDER BY id;

-- Verify users have name (not first_name/last_name)
SELECT id, username, name, role_id FROM users LIMIT 5;

-- Verify clients have name (not first_name/last_name)
SELECT id, phone, name FROM clients LIMIT 5;

-- Verify cleaning_jobs have property_id
SELECT id, client_id, property_id FROM cleaning_jobs LIMIT 5;

-- Verify unified payments table
SELECT service_type, COUNT(*) as count, SUM(amount) as total
FROM payments
GROUP BY service_type;

-- Verify tax calculations
SELECT id, amount, tax_percentage, amount_before_tax, tax_amount,
       ROUND((amount_before_tax + tax_amount)::numeric, 2) as recalculated_amount
FROM payments
LIMIT 10;
```

### 1.3 Rollback Script

**Create:** `database/migrations/rollback-v2.sql`

```sql
-- ROLLBACK: v2 → v1
-- WARNING: This will LOSE data if you've used v2-specific features!

BEGIN;

-- Restore users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20);

-- Split name back to first_name/last_name (best effort)
UPDATE users SET
    first_name = SPLIT_PART(name, ' ', 1),
    last_name = SUBSTRING(name FROM POSITION(' ' IN name) + 1);

-- Map role_id back to role string
UPDATE users SET role = 'master' WHERE role_id = 1;
UPDATE users SET role = 'admin' WHERE role_id = 2;
UPDATE users SET role = 'worker' WHERE role_id = 3;

ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_role_type;
ALTER TABLE users DROP COLUMN IF EXISTS role_id;
ALTER TABLE users DROP COLUMN IF EXISTS name;

-- Restore clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Portugal';

-- Split name back
UPDATE clients SET
    first_name = SPLIT_PART(name, ' ', 1),
    last_name = SUBSTRING(name FROM POSITION(' ' IN name) + 1);

ALTER TABLE clients DROP COLUMN IF EXISTS name;

-- Restore old payment tables
CREATE TABLE IF NOT EXISTS payments_cleaning AS SELECT * FROM payments WHERE service_type = 'cleaning';
CREATE TABLE IF NOT EXISTS payments_laundry AS SELECT * FROM payments WHERE service_type = 'laundry';

-- Drop new tables
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS role_types CASCADE;
DROP TABLE IF EXISTS property_types CASCADE;

COMMIT;
```

---

## Part 2: Backend Code Changes

### 2.1 Route Files to Update

#### **routes/users.js**
```javascript
// ❌ OLD
const { rows } = await pool.query(
  `SELECT id, username, role, first_name, last_name, email, phone FROM users WHERE id = $1`,
  [userId]
);

// ✅ NEW
const { rows } = await pool.query(
  `SELECT u.id, u.username, u.name, u.email, u.phone, rt.role_name as role
   FROM users u
   JOIN role_types rt ON u.role_id = rt.id
   WHERE u.id = $1`,
  [userId]
);
```

**Changes:**
- Replace `first_name, last_name` with `name`
- Join `role_types` to get `role_name`
- Update INSERT statements to use `role_id` (lookup from role_types)
- Update all user creation endpoints

#### **routes/clients.js**
```javascript
// ❌ OLD
const { rows } = await pool.query(
  `INSERT INTO clients (phone, password, first_name, last_name, email) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
  [phone, hashedPassword, firstName, lastName, email]
);

// ✅ NEW
const { rows } = await pool.query(
  `INSERT INTO clients (phone, password, name, email) VALUES ($1, $2, $3, $4) RETURNING *`,
  [phone, hashedPassword, name, email]
);
```

**Changes:**
- Replace `first_name, last_name` parameters with single `name`
- Remove `country` from all queries
- Update client profile endpoints

#### **routes/properties.js** (NEW FILE)
```javascript
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/properties - List all properties (admin/master only)
router.get('/', requireAuth, async (req, res) => {
  const correlationId = req.correlationId;

  try {
    const result = await pool.query(
      `SELECT p.*, pt.type_name as property_type, c.name as client_name
       FROM properties p
       LEFT JOIN property_types pt ON p.property_type_id = pt.id
       JOIN clients c ON p.client_id = c.id
       ORDER BY p.created_at DESC`
    );

    res.json({
      success: true,
      data: { properties: result.rows },
      _meta: {
        timestamp: new Date().toISOString(),
        correlationId
      }
    });
  } catch (error) {
    console.error(`[${correlationId}] Error fetching properties:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch properties',
      _meta: { correlationId, timestamp: new Date().toISOString() }
    });
  }
});

// GET /api/properties/client/:clientId - Get properties for specific client
router.get('/client/:clientId', requireAuth, async (req, res) => {
  const correlationId = req.correlationId;
  const { clientId } = req.params;

  try {
    const result = await pool.query(
      `SELECT p.*, pt.type_name as property_type
       FROM properties p
       LEFT JOIN property_types pt ON p.property_type_id = pt.id
       WHERE p.client_id = $1
       ORDER BY p.is_primary DESC, p.created_at DESC`,
      [clientId]
    );

    res.json({
      success: true,
      data: { properties: result.rows },
      _meta: {
        timestamp: new Date().toISOString(),
        correlationId
      }
    });
  } catch (error) {
    console.error(`[${correlationId}] Error fetching client properties:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch properties',
      _meta: { correlationId, timestamp: new Date().toISOString() }
    });
  }
});

// POST /api/properties - Create new property
router.post('/', requireAuth, async (req, res) => {
  const correlationId = req.correlationId;
  const {
    client_id,
    property_name,
    address_line1,
    address_line2,
    city,
    postal_code,
    district,
    property_type_id,
    access_instructions,
    is_primary
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO properties (
        client_id, property_name, address_line1, address_line2,
        city, postal_code, district, property_type_id,
        access_instructions, is_primary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [client_id, property_name, address_line1, address_line2,
       city, postal_code, district, property_type_id,
       access_instructions, is_primary || false]
    );

    res.status(201).json({
      success: true,
      data: { property: result.rows[0] },
      _meta: {
        timestamp: new Date().toISOString(),
        correlationId
      }
    });
  } catch (error) {
    console.error(`[${correlationId}] Error creating property:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to create property',
      _meta: { correlationId, timestamp: new Date().toISOString() }
    });
  }
});

// PUT /api/properties/:id - Update property
router.put('/:id', requireAuth, async (req, res) => {
  const correlationId = req.correlationId;
  const { id } = req.params;
  const {
    property_name,
    address_line1,
    address_line2,
    city,
    postal_code,
    district,
    property_type_id,
    access_instructions,
    is_primary
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE properties SET
        property_name = $1,
        address_line1 = $2,
        address_line2 = $3,
        city = $4,
        postal_code = $5,
        district = $6,
        property_type_id = $7,
        access_instructions = $8,
        is_primary = $9
      WHERE id = $10
      RETURNING *`,
      [property_name, address_line1, address_line2, city, postal_code,
       district, property_type_id, access_instructions, is_primary, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Property not found',
        _meta: { correlationId, timestamp: new Date().toISOString() }
      });
    }

    res.json({
      success: true,
      data: { property: result.rows[0] },
      _meta: {
        timestamp: new Date().toISOString(),
        correlationId
      }
    });
  } catch (error) {
    console.error(`[${correlationId}] Error updating property:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update property',
      _meta: { correlationId, timestamp: new Date().toISOString() }
    });
  }
});

// DELETE /api/properties/:id - Delete property
router.delete('/:id', requireAuth, async (req, res) => {
  const correlationId = req.correlationId;
  const { id } = req.params;

  try {
    // Check if property is used in cleaning jobs
    const checkResult = await pool.query(
      'SELECT COUNT(*) as job_count FROM cleaning_jobs WHERE property_id = $1',
      [id]
    );

    if (parseInt(checkResult.rows[0].job_count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete property with existing cleaning jobs',
        _meta: { correlationId, timestamp: new Date().toISOString() }
      });
    }

    const result = await pool.query(
      'DELETE FROM properties WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Property not found',
        _meta: { correlationId, timestamp: new Date().toISOString() }
      });
    }

    res.json({
      success: true,
      data: { message: 'Property deleted successfully' },
      _meta: {
        timestamp: new Date().toISOString(),
        correlationId
      }
    });
  } catch (error) {
    console.error(`[${correlationId}] Error deleting property:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete property',
      _meta: { correlationId, timestamp: new Date().toISOString() }
    });
  }
});

module.exports = router;
```

#### **routes/cleaning-jobs.js**
```javascript
// ❌ OLD - Direct address in cleaning_jobs
const result = await pool.query(
  `INSERT INTO cleaning_jobs (client_id, job_type, address_line1, city, scheduled_date, ...)
   VALUES ($1, $2, $3, $4, $5, ...)`,
  [client_id, job_type, address, city, scheduled_date, ...]
);

// ✅ NEW - Reference property_id
const result = await pool.query(
  `INSERT INTO cleaning_jobs (client_id, property_id, job_type, scheduled_date, ...)
   VALUES ($1, $2, $3, $4, ...)`,
  [client_id, property_id, job_type, scheduled_date, ...]
);

// ❌ OLD - Fetch job with inline address
const job = await pool.query(
  `SELECT * FROM cleaning_jobs WHERE id = $1`,
  [jobId]
);

// ✅ NEW - Join property to get address
const job = await pool.query(
  `SELECT cj.*, p.property_name, p.address_line1, p.city, pt.type_name as property_type
   FROM cleaning_jobs cj
   JOIN properties p ON cj.property_id = p.id
   LEFT JOIN property_types pt ON p.property_type_id = pt.id
   WHERE cj.id = $1`,
  [jobId]
);
```

**Changes:**
- Remove all direct address fields from INSERT/UPDATE
- Add `property_id` to INSERT/UPDATE
- Join `properties` table in SELECT queries
- Update `/full` endpoint to include property details

#### **routes/payments.js** (NEW UNIFIED FILE)
```javascript
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireFinanceAccess } = require('../middleware/auth');

// GET /api/payments - List all payments
router.get('/', requireAuth, requireFinanceAccess, async (req, res) => {
  const correlationId = req.correlationId;
  const { service_type, start_date, end_date, client_id } = req.query;

  try {
    let query = `
      SELECT p.*, c.name as client_name,
             CASE
               WHEN p.service_type = 'cleaning' THEN cj.id::text
               WHEN p.service_type = 'laundry' THEN lo.order_number
             END as service_reference
      FROM payments p
      JOIN clients c ON p.client_id = c.id
      LEFT JOIN cleaning_jobs cj ON p.cleaning_job_id = cj.id
      LEFT JOIN laundry_orders_new lo ON p.laundry_order_id = lo.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (service_type) {
      query += ` AND p.service_type = $${paramCount}`;
      params.push(service_type);
      paramCount++;
    }

    if (start_date) {
      query += ` AND p.payment_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND p.payment_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    if (client_id) {
      query += ` AND p.client_id = $${paramCount}`;
      params.push(client_id);
      paramCount++;
    }

    query += ' ORDER BY p.payment_date DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: { payments: result.rows },
      _meta: {
        timestamp: new Date().toISOString(),
        correlationId
      }
    });
  } catch (error) {
    console.error(`[${correlationId}] Error fetching payments:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments',
      _meta: { correlationId, timestamp: new Date().toISOString() }
    });
  }
});

// POST /api/payments - Create payment
router.post('/', requireAuth, requireFinanceAccess, async (req, res) => {
  const correlationId = req.correlationId;
  const {
    client_id,
    service_type,
    cleaning_job_id,
    laundry_order_id,
    amount,
    payment_method,
    tax_percentage,
    notes
  } = req.body;

  try {
    // Validate service type and FK
    if (service_type === 'cleaning' && !cleaning_job_id) {
      return res.status(400).json({
        success: false,
        error: 'cleaning_job_id required for cleaning payments',
        _meta: { correlationId, timestamp: new Date().toISOString() }
      });
    }

    if (service_type === 'laundry' && !laundry_order_id) {
      return res.status(400).json({
        success: false,
        error: 'laundry_order_id required for laundry payments',
        _meta: { correlationId, timestamp: new Date().toISOString() }
      });
    }

    const result = await pool.query(
      `INSERT INTO payments (
        client_id, service_type, cleaning_job_id, laundry_order_id,
        amount, payment_method, tax_percentage, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [client_id, service_type, cleaning_job_id, laundry_order_id,
       amount, payment_method, tax_percentage || 23.00, notes, req.user.id]
    );

    res.status(201).json({
      success: true,
      data: { payment: result.rows[0] },
      _meta: {
        timestamp: new Date().toISOString(),
        correlationId
      }
    });
  } catch (error) {
    console.error(`[${correlationId}] Error creating payment:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment',
      _meta: { correlationId, timestamp: new Date().toISOString() }
    });
  }
});

// PUT /api/payments/:id - Update payment (e.g., adjust tax)
router.put('/:id', requireAuth, requireFinanceAccess, async (req, res) => {
  const correlationId = req.correlationId;
  const { id } = req.params;
  const { tax_percentage, notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE payments SET
        tax_percentage = COALESCE($1, tax_percentage),
        notes = COALESCE($2, notes)
      WHERE id = $3
      RETURNING *`,
      [tax_percentage, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
        _meta: { correlationId, timestamp: new Date().toISOString() }
      });
    }

    res.json({
      success: true,
      data: { payment: result.rows[0] },
      _meta: {
        timestamp: new Date().toISOString(),
        correlationId
      }
    });
  } catch (error) {
    console.error(`[${correlationId}] Error updating payment:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment',
      _meta: { correlationId, timestamp: new Date().toISOString() }
    });
  }
});

// GET /api/payments/stats - Payment statistics
router.get('/stats', requireAuth, requireFinanceAccess, async (req, res) => {
  const correlationId = req.correlationId;

  try {
    const result = await pool.query(`
      SELECT
        service_type,
        COUNT(*) as payment_count,
        SUM(amount) as total_amount,
        SUM(tax_amount) as total_tax,
        SUM(amount_before_tax) as total_before_tax,
        AVG(tax_percentage) as avg_tax_percentage
      FROM payments
      GROUP BY service_type
    `);

    res.json({
      success: true,
      data: { stats: result.rows },
      _meta: {
        timestamp: new Date().toISOString(),
        correlationId
      }
    });
  } catch (error) {
    console.error(`[${correlationId}] Error fetching payment stats:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment statistics',
      _meta: { correlationId, timestamp: new Date().toISOString() }
    });
  }
});

module.exports = router;
```

### 2.2 Server.js Updates

```javascript
// Add new routes
const propertiesRoutes = require('./routes/properties');
const paymentsRoutes = require('./routes/payments');

// Register routes
app.use('/api/properties', propertiesRoutes);
app.use('/api/payments', paymentsRoutes); // Replaces old /api/payments-cleaning and /api/payments-laundry
```

### 2.3 Middleware Updates

**middleware/auth.js** - Update role checking:

```javascript
// ❌ OLD
const requireMaster = (req, res, next) => {
  if (req.user.role !== 'master') {
    return res.status(403).json({ error: 'Master access required' });
  }
  next();
};

// ✅ NEW - Need to join role_types or cache role in session
const requireMaster = (req, res, next) => {
  // Assuming req.user has role_name from session
  if (req.user.role_name !== 'master') {
    return res.status(403).json({ error: 'Master access required' });
  }
  next();
};
```

**Recommendation:** Store `role_name` in session during login to avoid extra DB queries.

---

## Part 3: Frontend Changes

### 3.1 React Components to Update

#### **client/src/components/forms/UserForm.js**
```jsx
// ❌ OLD
const [formData, setFormData] = useState({
  username: editUser?.username || '',
  first_name: editUser?.first_name || '',
  last_name: editUser?.last_name || '',
  role: editUser?.role || 'worker',
  ...
});

// ✅ NEW
const [formData, setFormData] = useState({
  username: editUser?.username || '',
  name: editUser?.name || '',
  role: editUser?.role || 'worker', // Still use role_name string
  ...
});

// Form JSX
<input
  type="text"
  name="name"
  value={formData.name}
  onChange={handleChange}
  placeholder="Full Name"
  className="..."
  required
/>
```

#### **client/src/components/forms/ClientForm.js**
```jsx
// ❌ OLD
const [formData, setFormData] = useState({
  phone: editClient?.phone || '',
  first_name: editClient?.first_name || '',
  last_name: editClient?.last_name || '',
  country: editClient?.country || 'Portugal',
  ...
});

// ✅ NEW
const [formData, setFormData] = useState({
  phone: editClient?.phone || '',
  name: editClient?.name || '',
  // Remove country entirely
  ...
});
```

#### **client/src/components/forms/PropertyForm.js** (NEW)
```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PropertyForm = ({ onSuccess, onCancel, editProperty = null, clientId = null, clients = [] }) => {
  const [formData, setFormData] = useState({
    client_id: editProperty?.client_id || clientId || '',
    property_name: editProperty?.property_name || '',
    address_line1: editProperty?.address_line1 || '',
    address_line2: editProperty?.address_line2 || '',
    city: editProperty?.city || '',
    postal_code: editProperty?.postal_code || '',
    district: editProperty?.district || '',
    property_type_id: editProperty?.property_type_id || '',
    access_instructions: editProperty?.access_instructions || '',
    is_primary: editProperty?.is_primary || false
  });

  const [propertyTypes, setPropertyTypes] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPropertyTypes();
  }, []);

  const fetchPropertyTypes = async () => {
    try {
      const response = await axios.get('/api/property-types');
      setPropertyTypes(response.data.data.types);
    } catch (err) {
      console.error('Error fetching property types:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = editProperty
        ? `/api/properties/${editProperty.id}`
        : '/api/properties';
      const method = editProperty ? 'put' : 'post';

      const response = await axios[method](endpoint, formData);

      if (response.data.success) {
        onSuccess(response.data.data.property);
      }
    } catch (err) {
      const correlationId = err.response?.data?._meta?.correlationId || 'unknown';
      setError(`Error: ${err.response?.data?.error || err.message} (${correlationId})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {!clientId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client
          </label>
          <select
            name="client_id"
            value={formData.client_id}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={!!editProperty}
          >
            <option value="">Select Client</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.name} ({client.phone})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Property Name
        </label>
        <input
          type="text"
          name="property_name"
          value={formData.property_name}
          onChange={handleChange}
          placeholder="e.g., Main House, Airbnb Apartment"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address Line 1
        </label>
        <input
          type="text"
          name="address_line1"
          value={formData.address_line1}
          onChange={handleChange}
          placeholder="Street address"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address Line 2 (Optional)
        </label>
        <input
          type="text"
          name="address_line2"
          value={formData.address_line2}
          onChange={handleChange}
          placeholder="Apartment, suite, etc."
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            placeholder="Lisboa"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Postal Code
          </label>
          <input
            type="text"
            name="postal_code"
            value={formData.postal_code}
            onChange={handleChange}
            placeholder="1100-123"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            District
          </label>
          <input
            type="text"
            name="district"
            value={formData.district}
            onChange={handleChange}
            placeholder="Lisboa"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Property Type
          </label>
          <select
            name="property_type_id"
            value={formData.property_type_id}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Type</option>
            {propertyTypes.map(type => (
              <option key={type.id} value={type.id}>
                {type.type_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Access Instructions
        </label>
        <textarea
          name="access_instructions"
          value={formData.access_instructions}
          onChange={handleChange}
          placeholder="Parking info, entry code, key location, etc."
          rows="3"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          name="is_primary"
          checked={formData.is_primary}
          onChange={handleChange}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label className="ml-2 block text-sm text-gray-700">
          Primary Property
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Saving...' : (editProperty ? 'Update Property' : 'Create Property')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default PropertyForm;
```

#### **client/src/components/forms/CleaningJobForm.js**
```jsx
// ❌ OLD - Direct address fields
const [formData, setFormData] = useState({
  client_id: editJob?.client_id || '',
  job_type: editJob?.job_type || 'house',
  address: editJob?.address || '',
  scheduled_date: formatDateForInput(editJob?.scheduled_date) || '',
  ...
});

// ✅ NEW - Property-based workflow
const [formData, setFormData] = useState({
  client_id: editJob?.client_id || '',
  property_id: editJob?.property_id || '',
  job_type: editJob?.job_type || 'house',
  scheduled_date: formatDateForInput(editJob?.scheduled_date) || '',
  ...
});

const [clientProperties, setClientProperties] = useState([]);

// Fetch properties when client selected
useEffect(() => {
  if (formData.client_id) {
    fetchClientProperties(formData.client_id);
  } else {
    setClientProperties([]);
    setFormData(prev => ({ ...prev, property_id: '' }));
  }
}, [formData.client_id]);

const fetchClientProperties = async (clientId) => {
  try {
    const response = await axios.get(`/api/properties/client/${clientId}`);
    setClientProperties(response.data.data.properties);
  } catch (err) {
    console.error('Error fetching properties:', err);
    setClientProperties([]);
  }
};

// Form JSX
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Client
  </label>
  <select
    name="client_id"
    value={formData.client_id}
    onChange={handleChange}
    className="..."
    required
  >
    <option value="">Select Client</option>
    {clients.map(client => (
      <option key={client.id} value={client.id}>
        {client.name} ({client.phone})
      </option>
    ))}
  </select>
</div>

<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Property
  </label>
  <select
    name="property_id"
    value={formData.property_id}
    onChange={handleChange}
    className="..."
    required
    disabled={!formData.client_id}
  >
    <option value="">
      {!formData.client_id ? 'Select client first' : 'Select Property'}
    </option>
    {clientProperties.map(property => (
      <option key={property.id} value={property.id}>
        {property.property_name || property.address_line1} - {property.city}
      </option>
    ))}
  </select>
  {formData.client_id && clientProperties.length === 0 && (
    <p className="text-sm text-gray-500 mt-1">
      No properties found for this client.{' '}
      <button
        type="button"
        onClick={() => {/* Open PropertyForm modal */}}
        className="text-blue-600 hover:underline"
      >
        Add Property
      </button>
    </p>
  )}
</div>
```

### 3.2 Dashboard Updates

**client/src/pages/Dashboard.js** - Add Properties tab:

```jsx
const tabs = [
  { id: 'my-jobs', label: 'My Jobs', roles: ['worker'] },
  { id: 'cleaning-jobs', label: 'Cleaning Jobs', roles: ['admin', 'master'] },
  { id: 'laundry-orders', label: 'Laundry Orders', roles: ['admin', 'master'] },
  { id: 'clients', label: 'Clients', roles: ['admin', 'master'] },
  { id: 'properties', label: 'Properties', roles: ['admin', 'master'] }, // NEW
  { id: 'users', label: 'Staff', roles: ['admin', 'master'] },
  { id: 'payments', label: 'Payments', roles: ['admin', 'master'] }
];
```

---

## Part 4: Testing Requirements

### 4.1 Database Migration Testing

**Test:** `tests/unit/migration-v2.test.js`

```javascript
const pool = require('../../db');

describe('Database Migration v2', () => {
  test('role_types table exists with 3 roles', async () => {
    const result = await pool.query('SELECT * FROM role_types ORDER BY id');
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].role_name).toBe('master');
    expect(result.rows[1].role_name).toBe('admin');
    expect(result.rows[2].role_name).toBe('worker');
  });

  test('property_types table exists with types', async () => {
    const result = await pool.query('SELECT * FROM property_types');
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.map(r => r.type_name)).toContain('casa');
    expect(result.rows.map(r => r.type_name)).toContain('apartamento');
  });

  test('users table has name column (not first_name/last_name)', async () => {
    const result = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name IN ('name', 'first_name', 'last_name')
    `);
    const columns = result.rows.map(r => r.column_name);
    expect(columns).toContain('name');
    expect(columns).not.toContain('first_name');
    expect(columns).not.toContain('last_name');
  });

  test('clients table has name column (not first_name/last_name)', async () => {
    const result = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'clients' AND column_name IN ('name', 'first_name', 'last_name', 'country')
    `);
    const columns = result.rows.map(r => r.column_name);
    expect(columns).toContain('name');
    expect(columns).not.toContain('first_name');
    expect(columns).not.toContain('last_name');
    expect(columns).not.toContain('country');
  });

  test('cleaning_jobs has property_id (not direct address)', async () => {
    const result = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cleaning_jobs' AND column_name IN ('property_id', 'property_address', 'address_line1')
    `);
    const columns = result.rows.map(r => r.column_name);
    expect(columns).toContain('property_id');
    expect(columns).not.toContain('property_address');
    expect(columns).not.toContain('address_line1');
  });

  test('unified payments table exists (not split tables)', async () => {
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('payments', 'payments_cleaning', 'payments_laundry')
    `);
    const tables = result.rows.map(r => r.table_name);
    expect(tables).toContain('payments');
    expect(tables).not.toContain('payments_cleaning');
    expect(tables).not.toContain('payments_laundry');
  });

  test('payments table has tax calculation columns', async () => {
    const result = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name IN ('tax_percentage', 'tax_amount', 'amount_before_tax')
    `);
    const columns = result.rows.map(r => r.column_name);
    expect(columns).toContain('tax_percentage');
    expect(columns).toContain('tax_amount');
    expect(columns).toContain('amount_before_tax');
  });

  test('tax calculation trigger works correctly', async () => {
    // Insert test payment
    const result = await pool.query(`
      INSERT INTO payments (client_id, service_type, laundry_order_id, amount, payment_method, tax_percentage)
      VALUES (1, 'laundry', 1, 123.00, 'cash', 23.00)
      RETURNING *
    `);

    const payment = result.rows[0];
    const expectedBeforeTax = 123.00 / 1.23;
    const expectedTax = 123.00 - expectedBeforeTax;

    expect(payment.amount_before_tax).toBeCloseTo(expectedBeforeTax, 2);
    expect(payment.tax_amount).toBeCloseTo(expectedTax, 2);

    // Cleanup
    await pool.query('DELETE FROM payments WHERE id = $1', [payment.id]);
  });
});
```

### 4.2 E2E Test Updates

**Update:** `tests/e2e/cleaning-jobs-crud.spec.js`

```javascript
test('should create cleaning job with property selection', async ({ page }) => {
  // Login as admin
  await loginViaUI(page, 'admin', 'admin123');

  // Navigate to cleaning jobs
  await page.click('text=Cleaning Jobs');
  await page.click('button:has-text("Add Cleaning Job")');

  // Select client first
  await page.selectOption('select[name="client_id"]', { label: /João Santos/ });

  // Wait for properties to load
  await page.waitForSelector('select[name="property_id"]:not([disabled])');

  // Select property
  const propertyOptions = await page.$$eval('select[name="property_id"] option', options =>
    options.map(opt => opt.textContent)
  );
  expect(propertyOptions.length).toBeGreaterThan(1); // Has "Select Property" + actual properties

  await page.selectOption('select[name="property_id"]', { index: 1 }); // First property

  // Fill rest of form
  await page.selectOption('select[name="job_type"]', 'house');
  await page.fill('input[name="scheduled_date"]', '2025-12-01');
  await page.fill('input[name="scheduled_time"]', '10:00');

  // Submit
  await page.click('button:has-text("Create Job")');

  // Verify success
  await expect(page.locator('text=Job created successfully')).toBeVisible();
});

test('should show only selected client properties in dropdown', async ({ page }) => {
  // Login as admin
  await loginViaUI(page, 'admin', 'admin123');

  // Create two clients with different properties
  // Client 1: João with 2 properties
  // Client 2: Maria with 1 property

  await page.click('text=Cleaning Jobs');
  await page.click('button:has-text("Add Cleaning Job")');

  // Select Client 1
  await page.selectOption('select[name="client_id"]', { label: /João/ });
  await page.waitForSelector('select[name="property_id"]:not([disabled])');

  const joaoProperties = await page.$$eval('select[name="property_id"] option:not([value=""])', options =>
    options.map(opt => opt.textContent)
  );

  // Switch to Client 2
  await page.selectOption('select[name="client_id"]', { label: /Maria/ });
  await page.waitForTimeout(500); // Wait for properties to reload

  const mariaProperties = await page.$$eval('select[name="property_id"] option:not([value=""])', options =>
    options.map(opt => opt.textContent)
  );

  // Verify different properties shown
  expect(joaoProperties).not.toEqual(mariaProperties);
});
```

**New:** `tests/e2e/properties-crud.spec.js`

```javascript
test('should create property for client', async ({ page }) => {
  await loginViaUI(page, 'admin', 'admin123');

  await page.click('text=Properties');
  await page.click('button:has-text("Add Property")');

  await page.selectOption('select[name="client_id"]', { label: /João Santos/ });
  await page.fill('input[name="property_name"]', 'Test Apartment');
  await page.fill('input[name="address_line1"]', 'Rua de Teste, 456');
  await page.fill('input[name="city"]', 'Porto');
  await page.fill('input[name="postal_code"]', '4000-123');
  await page.selectOption('select[name="property_type_id"]', { label: /apartamento/ });

  await page.click('button:has-text("Create Property")');

  await expect(page.locator('text=Property created successfully')).toBeVisible();
  await expect(page.locator('text=Test Apartment')).toBeVisible();
});

test('should prevent deleting property with active jobs', async ({ page }) => {
  // Create property with cleaning job
  // Try to delete property
  // Expect error message
});
```

**New:** `tests/e2e/payments-unified.spec.js`

```javascript
test('should create cleaning payment with tax calculation', async ({ page }) => {
  await loginViaUI(page, 'admin', 'admin123');

  await page.click('text=Payments');
  await page.click('button:has-text("Add Payment")');

  await page.selectOption('select[name="service_type"]', 'cleaning');
  await page.selectOption('select[name="client_id"]', { label: /João Santos/ });

  // Service dropdown should show only cleaning jobs
  const serviceOptions = await page.$$eval('select[name="cleaning_job_id"] option', opts =>
    opts.map(o => o.textContent)
  );
  expect(serviceOptions.length).toBeGreaterThan(1);

  await page.selectOption('select[name="cleaning_job_id"]', { index: 1 });
  await page.fill('input[name="amount"]', '123.00');
  await page.selectOption('select[name="payment_method"]', 'cash');

  // Tax should default to 23%
  await expect(page.locator('input[name="tax_percentage"]')).toHaveValue('23.00');

  await page.click('button:has-text("Create Payment")');

  // Verify tax calculation in table
  const taxAmount = await page.locator('td:has-text("Tax:") + td').textContent();
  const expectedTax = (123.00 - (123.00 / 1.23)).toFixed(2);
  expect(taxAmount).toContain(expectedTax);
});

test('master can adjust tax percentage per receipt', async ({ page }) => {
  await loginViaUI(page, 'master', 'master123');

  // Create payment
  // Edit payment
  // Change tax from 23% to 13%
  // Verify recalculation
});
```

---

## Part 5: Rollout Plan

### Phase 1: Preparation (Day 1)
1. ✅ Backup production database
2. ✅ Review migration script
3. ✅ Test migration in development
4. ✅ Verify all queries work
5. ✅ Run unit tests

### Phase 2: Migration (Day 2)
1. ✅ Run migration script on development
2. ✅ Verify data integrity
3. ✅ Test backend routes
4. ✅ Test frontend forms
5. ✅ Run E2E tests

### Phase 3: Code Deployment (Day 3)
1. ✅ Deploy backend changes
2. ✅ Deploy frontend changes
3. ✅ Verify /api/properties endpoint
4. ✅ Verify /api/payments endpoint
5. ✅ Verify cleaning job creation workflow

### Phase 4: Cleanup (Day 4)
1. ✅ Drop old payment tables (if migration verified)
2. ✅ Update documentation
3. ✅ Train users on new property workflow
4. ✅ Monitor production logs

---

## Acceptance Criteria

### Database:
- [ ] `role_types` and `property_types` tables exist with seed data
- [ ] `users` table has `name` column (no `first_name`/`last_name`)
- [ ] `clients` table has `name` column (no `first_name`/`last_name`/`country`)
- [ ] `properties` table has `property_type_id` FK
- [ ] `cleaning_jobs` has `property_id` FK (no direct address columns)
- [ ] Unified `payments` table exists with tax calculation
- [ ] Old `payments_cleaning`/`payments_laundry` tables dropped
- [ ] All triggers working (tax calculation, auto-update timestamps)

### Backend:
- [ ] `/api/properties` CRUD endpoints working
- [ ] `/api/properties/client/:clientId` returns client properties
- [ ] `/api/payments` unified endpoint working
- [ ] `/api/payments/stats` returns correct aggregations
- [ ] `/api/cleaning-jobs` uses `property_id` (not direct address)
- [ ] All user/client endpoints use `name` (not `first_name`/`last_name`)
- [ ] Role checking uses `role_name` from session

### Frontend:
- [ ] UserForm has single `name` field
- [ ] ClientForm has single `name` field (no country)
- [ ] PropertyForm component created and functional
- [ ] CleaningJobForm shows client → property cascade
- [ ] Properties tab in Dashboard working
- [ ] Payment form supports tax percentage adjustment

### Tests:
- [ ] All migration unit tests passing
- [ ] E2E tests for property CRUD passing
- [ ] E2E tests for cleaning job property selection passing
- [ ] E2E tests for unified payments passing
- [ ] No regressions in existing tests

---

## Dependencies

**Blocked By:**
- Database backup completion
- Migration script review

**Blocks:**
- Future features requiring property-based logic
- Tax reporting features

---

## Risks & Mitigation

### Risk 1: Data Loss During Migration
**Mitigation:**
- Full database backup before migration
- Test migration in development first
- Rollback script ready

### Risk 2: Frontend Breaks During Transition
**Mitigation:**
- Deploy backend first (supports both old and new schemas temporarily)
- Deploy frontend after verification
- Feature flags for new property workflow

### Risk 3: Tax Calculation Errors
**Mitigation:**
- Unit tests for tax trigger
- Manual verification of sample payments
- Audit log for tax adjustments

---

## Questions for Product Owner

1. **Property Migration:** How should we handle existing cleaning jobs with direct addresses? Create properties automatically?
2. **Tax Adjustment Audit:** Should we log who changes tax percentages and when?
3. **Property Deletion:** Should we allow deletion if no active jobs, or never allow deletion (soft delete only)?
4. **Primary Property:** What happens if client tries to set multiple properties as primary?

---

## Timeline

**Estimated:** 12-16 hours
- Migration script: 3 hours
- Backend routes: 4 hours
- Frontend components: 4 hours
- Testing: 3 hours
- Documentation: 2 hours

**Deadline:** TBD
**Owner:** Developer
**Reviewer:** Maestro

---

**Status:** READY FOR DEVELOPMENT
**Last Updated:** 2025-11-09

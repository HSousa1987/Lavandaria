-- ==============================================
-- MIGRATION: v1 → v2 (Simplified Schema)
-- ==============================================
-- WARNING: This is a BREAKING CHANGE - test in development first!
-- Purpose: Property-based workflow, unified payments, role/property normalization
-- Date: 2025-11-09
-- ==============================================

BEGIN;

-- ==============================================
-- STEP 1: CREATE LOOKUP TABLES
-- ==============================================

-- Create role_types lookup table
CREATE TABLE IF NOT EXISTS role_types (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(20) UNIQUE NOT NULL CHECK (role_name IN ('master', 'admin', 'worker')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert role types
INSERT INTO role_types (id, role_name, description) VALUES
(1, 'master', 'System owner with full access'),
(2, 'admin', 'Manager with admin privileges'),
(3, 'worker', 'Field worker for jobs and orders')
ON CONFLICT (role_name) DO NOTHING;

-- Reset sequence to ensure next value is correct
SELECT setval('role_types_id_seq', (SELECT MAX(id) FROM role_types));

-- Create property_types lookup table
CREATE TABLE IF NOT EXISTS property_types (
    id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert property types
INSERT INTO property_types (type_name, description) VALUES
('casa', 'House/Home'),
('apartamento', 'Apartment'),
('quinta', 'Farm/Estate'),
('escritorio', 'Office'),
('loja', 'Shop/Store'),
('outro', 'Other')
ON CONFLICT (type_name) DO NOTHING;

-- ==============================================
-- STEP 2: UPDATE USERS TABLE
-- ==============================================

-- Add new columns if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER;

-- Migrate existing data: Use full_name if exists, otherwise combine first_name + last_name
UPDATE users SET name = COALESCE(full_name, CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
WHERE name IS NULL OR name = '';

-- Clean up extra spaces and empty strings
UPDATE users SET name = TRIM(name) WHERE name IS NOT NULL;
UPDATE users SET name = 'Unnamed User' WHERE name = '' OR name IS NULL;

-- Map role string to role_id
UPDATE users SET role_id = 1 WHERE role = 'master' AND role_id IS NULL;
UPDATE users SET role_id = 2 WHERE role = 'admin' AND role_id IS NULL;
UPDATE users SET role_id = 3 WHERE role = 'worker' AND role_id IS NULL;

-- Set default role_id for any missing (shouldn't happen but safety)
UPDATE users SET role_id = 3 WHERE role_id IS NULL;

-- Add constraints
ALTER TABLE users ALTER COLUMN name SET NOT NULL;
ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;

-- Add FK constraint (drop first if exists)
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_role_type;
ALTER TABLE users ADD CONSTRAINT fk_users_role_type
    FOREIGN KEY (role_id) REFERENCES role_types(id) ON DELETE RESTRICT;

-- Drop old columns
ALTER TABLE users DROP COLUMN IF EXISTS first_name;
ALTER TABLE users DROP COLUMN IF EXISTS last_name;
ALTER TABLE users DROP COLUMN IF EXISTS full_name;
ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users DROP COLUMN IF EXISTS country;
ALTER TABLE users DROP COLUMN IF EXISTS registration_date;

-- Create index on role_id if not exists
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- ==============================================
-- STEP 3: UPDATE CLIENTS TABLE
-- ==============================================

-- Add new column if doesn't exist
ALTER TABLE clients ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- Migrate existing data: Use full_name if exists, otherwise combine first_name + last_name
UPDATE clients SET name = COALESCE(full_name, CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
WHERE name IS NULL OR name = '';

-- Clean up extra spaces and empty strings
UPDATE clients SET name = TRIM(name) WHERE name IS NOT NULL;
UPDATE clients SET name = 'Unnamed Client' WHERE name = '' OR name IS NULL;

-- Add constraint
ALTER TABLE clients ALTER COLUMN name SET NOT NULL;

-- Add updated_at column if doesn't exist
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add created_by column if doesn't exist
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Drop old columns
ALTER TABLE clients DROP COLUMN IF EXISTS first_name;
ALTER TABLE clients DROP COLUMN IF EXISTS last_name;
ALTER TABLE clients DROP COLUMN IF EXISTS full_name;
ALTER TABLE clients DROP COLUMN IF EXISTS country;
ALTER TABLE clients DROP COLUMN IF EXISTS address_line1;
ALTER TABLE clients DROP COLUMN IF EXISTS address_line2;
ALTER TABLE clients DROP COLUMN IF EXISTS city;
ALTER TABLE clients DROP COLUMN IF EXISTS postal_code;
ALTER TABLE clients DROP COLUMN IF EXISTS district;
ALTER TABLE clients DROP COLUMN IF EXISTS registration_date;

-- Add is_enterprise index if doesn't exist
CREATE INDEX IF NOT EXISTS idx_clients_is_enterprise ON clients(is_enterprise);

-- ==============================================
-- STEP 4: UPDATE PROPERTIES TABLE
-- ==============================================

-- Rename 'name' to 'property_name' if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'properties' AND column_name = 'name') THEN
        ALTER TABLE properties RENAME COLUMN name TO property_name;
    END IF;
END $$;

-- Add new columns if they don't exist
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_type_id INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Map property_type string to property_type_id
UPDATE properties SET property_type_id = (
    CASE
        WHEN lower(property_type) LIKE '%casa%' THEN (SELECT id FROM property_types WHERE type_name = 'casa')
        WHEN lower(property_type) LIKE '%apart%' THEN (SELECT id FROM property_types WHERE type_name = 'apartamento')
        WHEN lower(property_type) LIKE '%quint%' THEN (SELECT id FROM property_types WHERE type_name = 'quinta')
        WHEN lower(property_type) LIKE '%escrit%' OR lower(property_type) LIKE '%office%' THEN (SELECT id FROM property_types WHERE type_name = 'escritorio')
        WHEN lower(property_type) LIKE '%loja%' OR lower(property_type) LIKE '%shop%' THEN (SELECT id FROM property_types WHERE type_name = 'loja')
        ELSE (SELECT id FROM property_types WHERE type_name = 'outro')
    END
)
WHERE property_type_id IS NULL AND property_type IS NOT NULL;

-- Set default to 'outro' for NULL values
UPDATE properties SET property_type_id = (SELECT id FROM property_types WHERE type_name = 'outro')
WHERE property_type_id IS NULL;

-- Add FK constraint
ALTER TABLE properties DROP CONSTRAINT IF EXISTS fk_properties_type;
ALTER TABLE properties ADD CONSTRAINT fk_properties_type
    FOREIGN KEY (property_type_id) REFERENCES property_types(id) ON DELETE SET NULL;

-- Drop old columns
ALTER TABLE properties DROP COLUMN IF EXISTS property_type;
ALTER TABLE properties DROP COLUMN IF EXISTS country;

-- Add index
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_properties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_properties_updated_at ON properties;
CREATE TRIGGER trigger_update_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_properties_updated_at();

-- ==============================================
-- STEP 5: UPDATE CLEANING_JOBS TABLE
-- ==============================================

-- Add property_id column if doesn't exist
ALTER TABLE cleaning_jobs ADD COLUMN IF NOT EXISTS property_id INTEGER;

-- Migrate existing jobs: create properties from address data
DO $$
DECLARE
    job_record RECORD;
    new_property_id INTEGER;
    default_property_type_id INTEGER;
BEGIN
    -- Get default property type ID
    SELECT id INTO default_property_type_id FROM property_types WHERE type_name = 'outro';

    -- Loop through jobs without property_id
    FOR job_record IN
        SELECT id, client_id, property_name, property_address, address_line1, city, postal_code, district
        FROM cleaning_jobs
        WHERE property_id IS NULL
    LOOP
        -- Create property from job address
        INSERT INTO properties (
            client_id,
            property_name,
            address_line1,
            city,
            postal_code,
            district,
            property_type_id,
            is_primary
        )
        VALUES (
            job_record.client_id,
            COALESCE(job_record.property_name, 'Migrated: ' || COALESCE(job_record.property_address, job_record.address_line1, 'Unknown')),
            COALESCE(job_record.address_line1, job_record.property_address, 'Unknown Address'),
            COALESCE(job_record.city, 'Unknown City'),
            job_record.postal_code,
            job_record.district,
            default_property_type_id,
            FALSE
        )
        RETURNING id INTO new_property_id;

        -- Link job to new property
        UPDATE cleaning_jobs SET property_id = new_property_id WHERE id = job_record.id;
    END LOOP;
END $$;

-- Add NOT NULL constraint after migration
ALTER TABLE cleaning_jobs ALTER COLUMN property_id SET NOT NULL;

-- Add FK constraint
ALTER TABLE cleaning_jobs DROP CONSTRAINT IF EXISTS fk_cleaning_jobs_property;
ALTER TABLE cleaning_jobs ADD CONSTRAINT fk_cleaning_jobs_property
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT;

-- Drop old address columns
ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS property_name;
ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS property_address;
ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS address_line1;
ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS address_line2;
ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS city;
ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS postal_code;
ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS district;
ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS country;
ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS payment_method;
ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS paid_amount;
ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS push_notification_sent;
ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS last_synced_at;
ALTER TABLE cleaning_jobs DROP COLUMN IF EXISTS client_rating;

-- Add index
CREATE INDEX IF NOT EXISTS idx_cleaning_jobs_property ON cleaning_jobs(property_id);

-- ==============================================
-- STEP 6: CREATE UNIFIED PAYMENTS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

    -- Service discrimination
    service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('cleaning', 'laundry')),
    cleaning_job_id INTEGER REFERENCES cleaning_jobs(id) ON DELETE CASCADE,
    laundry_order_id INTEGER REFERENCES laundry_orders_new(id) ON DELETE CASCADE,

    -- Payment details
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'mbway', 'other')),
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Tax handling (flexible per receipt)
    tax_percentage DECIMAL(5,2) NOT NULL DEFAULT 23.00,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    amount_before_tax DECIMAL(10,2) NOT NULL DEFAULT 0,

    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure only one service FK is set
    CONSTRAINT check_single_service CHECK (
        (service_type = 'cleaning' AND cleaning_job_id IS NOT NULL AND laundry_order_id IS NULL) OR
        (service_type = 'laundry' AND laundry_order_id IS NOT NULL AND cleaning_job_id IS NULL)
    )
);

-- Migrate data from payments_cleaning
INSERT INTO payments (
    client_id, service_type, cleaning_job_id, amount, payment_method, payment_date, notes, created_at,
    tax_percentage, tax_amount, amount_before_tax
)
SELECT
    client_id,
    'cleaning'::VARCHAR(20),
    cleaning_job_id,
    amount,
    payment_method,
    payment_date,
    notes,
    created_at,
    23.00,
    ROUND((amount - (amount / 1.23))::numeric, 2),
    ROUND((amount / 1.23)::numeric, 2)
FROM payments_cleaning
ON CONFLICT DO NOTHING;

-- Migrate data from payments_laundry
INSERT INTO payments (
    client_id, service_type, laundry_order_id, amount, payment_method, payment_date, notes, created_at,
    tax_percentage, tax_amount, amount_before_tax
)
SELECT
    client_id,
    'laundry'::VARCHAR(20),
    laundry_order_id,
    amount,
    payment_method,
    payment_date,
    notes,
    created_at,
    23.00,
    ROUND((amount - (amount / 1.23))::numeric, 2),
    ROUND((amount / 1.23)::numeric, 2)
FROM payments_laundry
ON CONFLICT DO NOTHING;

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

DROP TRIGGER IF EXISTS trigger_calculate_payment_tax ON payments;
CREATE TRIGGER trigger_calculate_payment_tax
    BEFORE INSERT OR UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION calculate_payment_tax();

-- ==============================================
-- STEP 7: UPDATE TICKETS TABLE
-- ==============================================

-- Rename order_type to service_type if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'tickets' AND column_name = 'order_type') THEN
        ALTER TABLE tickets RENAME COLUMN order_type TO service_type;
    END IF;
END $$;

-- Update CHECK constraint for service_type
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_service_type_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_service_type_check
    CHECK (service_type IN ('laundry', 'cleaning', 'general'));

-- ==============================================
-- STEP 8: DROP OLD TABLES (AFTER VERIFICATION)
-- ==============================================

-- Drop old payment tables (only after verifying migration succeeded)
DROP TABLE IF EXISTS payments_cleaning CASCADE;
DROP TABLE IF EXISTS payments_laundry CASCADE;

COMMIT;

-- ==============================================
-- POST-MIGRATION VERIFICATION QUERIES
-- ==============================================

-- Verify role_types
SELECT 'role_types' as table_name, COUNT(*) as count FROM role_types;

-- Verify property_types
SELECT 'property_types' as table_name, COUNT(*) as count FROM property_types;

-- Verify users have name (not first_name/last_name)
SELECT 'users with name' as check_name, COUNT(*) as count
FROM users WHERE name IS NOT NULL AND name != '';

-- Verify clients have name (not first_name/last_name)
SELECT 'clients with name' as check_name, COUNT(*) as count
FROM clients WHERE name IS NOT NULL AND name != '';

-- Verify cleaning_jobs have property_id
SELECT 'jobs with property_id' as check_name, COUNT(*) as count
FROM cleaning_jobs WHERE property_id IS NOT NULL;

-- Verify unified payments table
SELECT 'payments by service' as check_name, service_type, COUNT(*) as count, SUM(amount) as total
FROM payments
GROUP BY service_type;

-- Verify tax calculations
SELECT 'payment tax check' as check_name,
       COUNT(*) as total_payments,
       COUNT(*) FILTER (WHERE ABS((amount_before_tax + tax_amount) - amount) < 0.01) as correct_calculations
FROM payments;

-- Summary
SELECT 'MIGRATION COMPLETE' as status,
       (SELECT COUNT(*) FROM role_types) as role_types,
       (SELECT COUNT(*) FROM property_types) as property_types,
       (SELECT COUNT(*) FROM users) as users,
       (SELECT COUNT(*) FROM clients) as clients,
       (SELECT COUNT(*) FROM properties) as properties,
       (SELECT COUNT(*) FROM cleaning_jobs) as cleaning_jobs,
       (SELECT COUNT(*) FROM payments) as payments;

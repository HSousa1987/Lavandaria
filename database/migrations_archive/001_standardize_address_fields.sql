-- ===============================================
-- MIGRATION 001: Standardize Address Fields
-- ===============================================
-- Purpose: Align all tables (users, clients, cleaning_jobs)
--          with best practice address schema
-- Date: 2025-10-07
-- Author: Senior Software Engineer
-- ===============================================

BEGIN;

-- ===============================================
-- 1. USERS TABLE - Add Address Fields
-- ===============================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS nif VARCHAR(20),
    ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(200),
    ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(200),
    ADD COLUMN IF NOT EXISTS city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS district VARCHAR(100),
    ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Portugal',
    ADD COLUMN IF NOT EXISTS registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Migrate existing address data to address_line1 if address column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'address'
    ) THEN
        UPDATE users SET address_line1 = address WHERE address IS NOT NULL AND address_line1 IS NULL;
        ALTER TABLE users DROP COLUMN address;
    END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_nif ON users(nif);
CREATE INDEX IF NOT EXISTS idx_users_postal_code ON users(postal_code);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);

-- ===============================================
-- 2. CLIENTS TABLE - Add Address Fields
-- ===============================================
ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS nif VARCHAR(20),
    ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(200),
    ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(200),
    ADD COLUMN IF NOT EXISTS city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS district VARCHAR(100),
    ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Portugal',
    ADD COLUMN IF NOT EXISTS registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS is_enterprise BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS company_name VARCHAR(200);

-- Migrate existing address data to address_line1 if address column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clients' AND column_name = 'address'
    ) THEN
        UPDATE clients SET address_line1 = address WHERE address IS NOT NULL AND address_line1 IS NULL;
        ALTER TABLE clients DROP COLUMN address;
    END IF;
END $$;

-- Update full_name for enterprise clients
UPDATE clients
SET full_name = company_name
WHERE is_enterprise = TRUE AND company_name IS NOT NULL AND full_name IS NULL;

-- Update full_name for individual clients
UPDATE clients
SET full_name = CONCAT(first_name, ' ', last_name)
WHERE is_enterprise = FALSE AND first_name IS NOT NULL AND last_name IS NOT NULL AND full_name IS NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_nif ON clients(nif);
CREATE INDEX IF NOT EXISTS idx_clients_is_enterprise ON clients(is_enterprise);
CREATE INDEX IF NOT EXISTS idx_clients_postal_code ON clients(postal_code);
CREATE INDEX IF NOT EXISTS idx_clients_city ON clients(city);

-- ===============================================
-- 3. CLEANING_JOBS TABLE - Add Missing Fields
-- ===============================================
-- cleaning_jobs already has good address structure, just add district if missing
ALTER TABLE cleaning_jobs
    ADD COLUMN IF NOT EXISTS district VARCHAR(100),
    ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Portugal';

-- Add index for district
CREATE INDEX IF NOT EXISTS idx_cleaning_jobs_district ON cleaning_jobs(district);
CREATE INDEX IF NOT EXISTS idx_cleaning_jobs_postal_code ON cleaning_jobs(postal_code);

-- ===============================================
-- 4. PROPERTIES TABLE - Add District Field
-- ===============================================
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS district VARCHAR(100);

-- Add index for district
CREATE INDEX IF NOT EXISTS idx_properties_district ON properties(district);
CREATE INDEX IF NOT EXISTS idx_properties_postal_code ON properties(postal_code);

-- ===============================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- ===============================================
COMMENT ON COLUMN users.address_line1 IS 'Street name and number (mandatory)';
COMMENT ON COLUMN users.address_line2 IS 'Apartment, floor, building (optional)';
COMMENT ON COLUMN users.city IS 'Municipality/City (mandatory for complete address)';
COMMENT ON COLUMN users.postal_code IS 'Portuguese postal code format: XXXX-XXX';
COMMENT ON COLUMN users.district IS 'Portuguese district (e.g., Lisboa, Porto, Faro)';
COMMENT ON COLUMN users.nif IS 'Tax identification number (NIF/NIPC)';

COMMENT ON COLUMN clients.address_line1 IS 'Street name and number (mandatory)';
COMMENT ON COLUMN clients.address_line2 IS 'Apartment, floor, building (optional)';
COMMENT ON COLUMN clients.city IS 'Municipality/City (mandatory for complete address)';
COMMENT ON COLUMN clients.postal_code IS 'Portuguese postal code format: XXXX-XXX';
COMMENT ON COLUMN clients.district IS 'Portuguese district (e.g., Lisboa, Porto, Faro)';
COMMENT ON COLUMN clients.nif IS 'Tax identification number (NIF/NIPC)';
COMMENT ON COLUMN clients.is_enterprise IS 'TRUE for business clients, FALSE for individuals';
COMMENT ON COLUMN clients.company_name IS 'Company name for enterprise clients';

COMMENT ON COLUMN properties.district IS 'Portuguese district (e.g., Lisboa, Porto, Faro)';

COMMENT ON COLUMN cleaning_jobs.district IS 'Portuguese district (e.g., Lisboa, Porto, Faro)';

-- ===============================================
-- 6. VERIFY MIGRATION
-- ===============================================
DO $$
DECLARE
    v_tables TEXT[] := ARRAY['users', 'clients', 'properties', 'cleaning_jobs'];
    v_table TEXT;
    v_columns TEXT;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATION 001 - VERIFICATION';
    RAISE NOTICE '========================================';

    FOREACH v_table IN ARRAY v_tables
    LOOP
        SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
        INTO v_columns
        FROM information_schema.columns
        WHERE table_name = v_table
        AND column_name IN ('address_line1', 'address_line2', 'city', 'postal_code', 'district', 'country');

        RAISE NOTICE 'Table: % - Address columns: %', v_table, COALESCE(v_columns, 'NONE');
    END LOOP;

    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ===============================================
-- ROLLBACK SCRIPT (Keep for reference - DO NOT RUN)
-- ===============================================
/*
BEGIN;

-- Remove new columns from users
ALTER TABLE users
    DROP COLUMN IF EXISTS first_name,
    DROP COLUMN IF EXISTS last_name,
    DROP COLUMN IF EXISTS date_of_birth,
    DROP COLUMN IF EXISTS nif,
    DROP COLUMN IF EXISTS address_line1,
    DROP COLUMN IF EXISTS address_line2,
    DROP COLUMN IF EXISTS city,
    DROP COLUMN IF EXISTS postal_code,
    DROP COLUMN IF EXISTS district,
    DROP COLUMN IF EXISTS country,
    DROP COLUMN IF EXISTS registration_date;

-- Remove new columns from clients
ALTER TABLE clients
    DROP COLUMN IF EXISTS first_name,
    DROP COLUMN IF EXISTS last_name,
    DROP COLUMN IF EXISTS date_of_birth,
    DROP COLUMN IF EXISTS nif,
    DROP COLUMN IF EXISTS address_line1,
    DROP COLUMN IF EXISTS address_line2,
    DROP COLUMN IF EXISTS city,
    DROP COLUMN IF EXISTS postal_code,
    DROP COLUMN IF EXISTS district,
    DROP COLUMN IF EXISTS country,
    DROP COLUMN IF EXISTS registration_date,
    DROP COLUMN IF EXISTS is_enterprise,
    DROP COLUMN IF EXISTS company_name;

-- Remove district from cleaning_jobs
ALTER TABLE cleaning_jobs
    DROP COLUMN IF EXISTS district,
    DROP COLUMN IF EXISTS country;

-- Remove district from properties
ALTER TABLE properties
    DROP COLUMN IF EXISTS district;

COMMIT;
*/

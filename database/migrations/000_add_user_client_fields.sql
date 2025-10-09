-- Migration: Add comprehensive user and client fields
-- Date: 2025-10-01

-- ==============================================
-- USERS TABLE UPDATES
-- ==============================================

-- Add new fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS nif VARCHAR(20),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing users to split full_name into first_name and last_name
UPDATE users
SET
    first_name = SPLIT_PART(full_name, ' ', 1),
    last_name = CASE
        WHEN ARRAY_LENGTH(STRING_TO_ARRAY(full_name, ' '), 1) > 1
        THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
        ELSE ''
    END,
    registration_date = COALESCE(created_at, CURRENT_TIMESTAMP)
WHERE first_name IS NULL;

-- Create index for NIF
CREATE INDEX IF NOT EXISTS idx_users_nif ON users(nif);

-- ==============================================
-- CLIENTS TABLE UPDATES
-- ==============================================

-- Add new fields to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS nif VARCHAR(20),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_enterprise BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS company_name VARCHAR(200);

-- Update existing clients to split full_name
UPDATE clients
SET
    first_name = SPLIT_PART(full_name, ' ', 1),
    last_name = CASE
        WHEN ARRAY_LENGTH(STRING_TO_ARRAY(full_name, ' '), 1) > 1
        THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
        ELSE ''
    END,
    registration_date = COALESCE(created_at, CURRENT_TIMESTAMP),
    is_enterprise = FALSE
WHERE first_name IS NULL;

-- Create indexes for clients
CREATE INDEX IF NOT EXISTS idx_clients_nif ON clients(nif);
CREATE INDEX IF NOT EXISTS idx_clients_is_enterprise ON clients(is_enterprise);

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON COLUMN users.first_name IS 'User first name';
COMMENT ON COLUMN users.last_name IS 'User last name';
COMMENT ON COLUMN users.date_of_birth IS 'User date of birth';
COMMENT ON COLUMN users.nif IS 'Número de Identificação Fiscal (Tax ID)';
COMMENT ON COLUMN users.address IS 'User full address';
COMMENT ON COLUMN users.registration_date IS 'Date when user was registered in the system';

COMMENT ON COLUMN clients.first_name IS 'Client first name (for individuals)';
COMMENT ON COLUMN clients.last_name IS 'Client last name (for individuals)';
COMMENT ON COLUMN clients.date_of_birth IS 'Client date of birth (for individuals)';
COMMENT ON COLUMN clients.nif IS 'Número de Identificação Fiscal (Tax ID) - for individuals or companies';
COMMENT ON COLUMN clients.address IS 'Client full address';
COMMENT ON COLUMN clients.registration_date IS 'Date when client was registered in the system';
COMMENT ON COLUMN clients.is_enterprise IS 'TRUE if client is a company, FALSE if individual person';
COMMENT ON COLUMN clients.company_name IS 'Company name (only for enterprises)';

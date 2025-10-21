-- Migration: Split payments table for FK integrity
-- Date: 2025-10-21
-- Purpose: Create separate payments_cleaning and payments_laundry tables with proper foreign keys

-- ==============================================
-- CREATE NEW PAYMENT TABLES
-- ==============================================

-- Payments for cleaning jobs (Airbnb/House)
CREATE TABLE IF NOT EXISTS payments_cleaning (
    id SERIAL PRIMARY KEY,
    cleaning_job_id INTEGER NOT NULL REFERENCES cleaning_jobs(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'mbway', 'other')),
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments for laundry orders
CREATE TABLE IF NOT EXISTS payments_laundry (
    id SERIAL PRIMARY KEY,
    laundry_order_id INTEGER NOT NULL REFERENCES laundry_orders_new(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'mbway', 'other')),
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- MIGRATE EXISTING DATA
-- ==============================================

-- Migrate cleaning job payments
INSERT INTO payments_cleaning (cleaning_job_id, client_id, amount, payment_method, payment_date, notes, created_at)
SELECT
    p.order_id,
    p.client_id,
    p.amount,
    p.payment_method,
    p.payment_date,
    p.notes,
    p.created_at
FROM payments p
WHERE p.order_type = 'airbnb'
ON CONFLICT DO NOTHING;

-- Migrate laundry order payments
INSERT INTO payments_laundry (laundry_order_id, client_id, amount, payment_method, payment_date, notes, created_at)
SELECT
    p.order_id,
    p.client_id,
    p.amount,
    p.payment_method,
    p.payment_date,
    p.notes,
    p.created_at
FROM payments p
WHERE p.order_type = 'laundry'
ON CONFLICT DO NOTHING;

-- ==============================================
-- CREATE INDEXES
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_payments_cleaning_job ON payments_cleaning(cleaning_job_id);
CREATE INDEX IF NOT EXISTS idx_payments_cleaning_client ON payments_cleaning(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_cleaning_date ON payments_cleaning(payment_date);

CREATE INDEX IF NOT EXISTS idx_payments_laundry_order ON payments_laundry(laundry_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_laundry_client ON payments_laundry(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_laundry_date ON payments_laundry(payment_date);

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE payments_cleaning IS 'Payments for cleaning jobs with FK to cleaning_jobs';
COMMENT ON TABLE payments_laundry IS 'Payments for laundry orders with FK to laundry_orders_new';

-- Note: Old payments table is retained for backup (can be dropped after verification)

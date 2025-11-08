-- ============================================
-- Migration: Add VAT fields to cleaning_jobs and laundry_orders_new
-- Date: 2025-11-08
-- Purpose: Portuguese IVA (23%) tracking for tax compliance
-- ============================================

BEGIN;

-- ===========================================
-- CLEANING JOBS TABLE
-- ===========================================

-- Add VAT columns
ALTER TABLE cleaning_jobs
ADD COLUMN subtotal_before_vat NUMERIC(10,2) DEFAULT 0,
ADD COLUMN vat_rate NUMERIC(5,2) DEFAULT 23.00,
ADD COLUMN vat_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN total_with_vat NUMERIC(10,2) DEFAULT 0;

-- Update CHECK constraint to use total_with_vat
COMMENT ON COLUMN cleaning_jobs.subtotal_before_vat IS 'Base cost before VAT (hourly_rate * hours)';
COMMENT ON COLUMN cleaning_jobs.vat_rate IS 'VAT percentage (default 23% for Portugal)';
COMMENT ON COLUMN cleaning_jobs.vat_amount IS 'Calculated VAT amount';
COMMENT ON COLUMN cleaning_jobs.total_with_vat IS 'Final total including VAT';

-- Rename total_cost to avoid confusion (optional - keep for backward compatibility)
COMMENT ON COLUMN cleaning_jobs.total_cost IS 'DEPRECATED: Use total_with_vat instead';

-- ===========================================
-- LAUNDRY ORDERS TABLE
-- ===========================================

-- Add VAT columns
ALTER TABLE laundry_orders_new
ADD COLUMN subtotal_before_vat NUMERIC(10,2) DEFAULT 0,
ADD COLUMN vat_rate NUMERIC(5,2) DEFAULT 23.00,
ADD COLUMN vat_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN total_with_vat NUMERIC(10,2) DEFAULT 0;

COMMENT ON COLUMN laundry_orders_new.subtotal_before_vat IS 'Base price before VAT (base_price + additional_charges - discount)';
COMMENT ON COLUMN laundry_orders_new.vat_rate IS 'VAT percentage (default 23% for Portugal)';
COMMENT ON COLUMN laundry_orders_new.vat_amount IS 'Calculated VAT amount';
COMMENT ON COLUMN laundry_orders_new.total_with_vat IS 'Final total including VAT';

COMMENT ON COLUMN laundry_orders_new.total_price IS 'DEPRECATED: Use total_with_vat instead';

-- ===========================================
-- DATABASE FUNCTIONS FOR VAT CALCULATION
-- ===========================================

-- Function: Calculate VAT for cleaning jobs
CREATE OR REPLACE FUNCTION calculate_cleaning_vat()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate subtotal (hourly_rate * estimated_hours, or use total_cost if set)
    IF NEW.total_duration_minutes IS NOT NULL AND NEW.total_duration_minutes > 0 THEN
        -- Use actual duration if available
        NEW.subtotal_before_vat := NEW.hourly_rate * (NEW.total_duration_minutes / 60.0);
    ELSIF NEW.estimated_hours IS NOT NULL THEN
        -- Use estimated hours
        NEW.subtotal_before_vat := NEW.hourly_rate * NEW.estimated_hours;
    ELSE
        -- Fallback to total_cost if no hours
        NEW.subtotal_before_vat := COALESCE(NEW.total_cost, 0);
    END IF;

    -- Calculate VAT
    NEW.vat_amount := ROUND(NEW.subtotal_before_vat * (NEW.vat_rate / 100.0), 2);

    -- Calculate total with VAT
    NEW.total_with_vat := NEW.subtotal_before_vat + NEW.vat_amount;

    -- Keep total_cost synchronized (backward compatibility)
    NEW.total_cost := NEW.total_with_vat;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate VAT for laundry orders
CREATE OR REPLACE FUNCTION calculate_laundry_vat()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate subtotal
    IF NEW.order_type = 'bulk_kg' AND NEW.total_weight_kg IS NOT NULL THEN
        NEW.base_price := NEW.total_weight_kg * NEW.price_per_kg;
    END IF;

    NEW.subtotal_before_vat := COALESCE(NEW.base_price, 0) +
                                COALESCE(NEW.additional_charges, 0) -
                                COALESCE(NEW.discount, 0);

    -- Calculate VAT
    NEW.vat_amount := ROUND(NEW.subtotal_before_vat * (NEW.vat_rate / 100.0), 2);

    -- Calculate total with VAT
    NEW.total_with_vat := NEW.subtotal_before_vat + NEW.vat_amount;

    -- Keep total_price synchronized (backward compatibility)
    NEW.total_price := NEW.total_with_vat;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Drop existing cost calculation triggers (we're replacing them)
DROP TRIGGER IF EXISTS trigger_calculate_cleaning_cost ON cleaning_jobs;
DROP TRIGGER IF EXISTS trigger_calculate_laundry_total ON laundry_orders_new;

-- Create new VAT calculation triggers
CREATE TRIGGER trigger_calculate_cleaning_vat
    BEFORE INSERT OR UPDATE ON cleaning_jobs
    FOR EACH ROW
    EXECUTE FUNCTION calculate_cleaning_vat();

CREATE TRIGGER trigger_calculate_laundry_vat
    BEFORE INSERT OR UPDATE ON laundry_orders_new
    FOR EACH ROW
    EXECUTE FUNCTION calculate_laundry_vat();

-- ===========================================
-- BACKFILL EXISTING RECORDS
-- ===========================================

-- Backfill cleaning jobs (assume total_cost already includes VAT at 23%)
UPDATE cleaning_jobs
SET
    vat_rate = 23.00,
    subtotal_before_vat = ROUND(total_cost / 1.23, 2),
    vat_amount = ROUND(total_cost - (total_cost / 1.23), 2),
    total_with_vat = total_cost
WHERE vat_amount IS NULL OR vat_amount = 0;

-- Backfill laundry orders (assume total_price already includes VAT at 23%)
UPDATE laundry_orders_new
SET
    vat_rate = 23.00,
    subtotal_before_vat = ROUND(total_price / 1.23, 2),
    vat_amount = ROUND(total_price - (total_price / 1.23), 2),
    total_with_vat = total_price
WHERE vat_amount IS NULL OR vat_amount = 0;

COMMIT;

-- ===========================================
-- VERIFICATION QUERIES
-- ===========================================

-- Check cleaning jobs VAT calculation
SELECT
    id,
    subtotal_before_vat,
    vat_rate,
    vat_amount,
    total_with_vat,
    total_cost,
    (total_with_vat = total_cost) as totals_match
FROM cleaning_jobs
LIMIT 5;

-- Check laundry orders VAT calculation
SELECT
    id,
    subtotal_before_vat,
    vat_rate,
    vat_amount,
    total_with_vat,
    total_price,
    (total_with_vat = total_price) as totals_match
FROM laundry_orders_new
LIMIT 5;

-- =====================================================
-- Migration 003: Pricing, VAT, and System Settings
-- =====================================================
-- Purpose: Add system-wide settings (VAT, delivery fee, cleaning rate)
--          Add laundry services catalog with pricing
--          Add VAT calculation to all orders
--          Add delivery fee to laundry orders
--          Update cleaning jobs to use 30-minute rounding
-- =====================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_calculate_cleaning_cost ON cleaning_jobs;
DROP TRIGGER IF EXISTS trigger_calculate_laundry_total ON laundry_orders_new;

-- =====================================================
-- 1. SYSTEM SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE system_settings IS 'System-wide configuration settings (VAT rate, fees, rates)';
COMMENT ON COLUMN system_settings.setting_key IS 'Unique identifier for setting (e.g., vat_rate, delivery_fee)';
COMMENT ON COLUMN system_settings.setting_value IS 'Setting value as text (will be cast to appropriate type when used)';

-- Insert default settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('vat_rate', '23', 'IVA/VAT percentage (23% in Portugal)'),
('delivery_fee', '5.00', 'Fixed delivery fee for laundry orders (EUR)'),
('cleaning_rate_30min', '15.00', 'Rate charged per 30-minute block for cleaning services (EUR)')
ON CONFLICT (setting_key) DO NOTHING;

-- =====================================================
-- 2. LAUNDRY SERVICES CATALOG
-- =====================================================
CREATE TABLE IF NOT EXISTS laundry_services (
    id SERIAL PRIMARY KEY,
    service_code VARCHAR(50) UNIQUE NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
    unit VARCHAR(20) NOT NULL, -- 'per_kg', 'per_item'
    is_package BOOLEAN DEFAULT FALSE,
    package_includes TEXT[], -- Array of service_codes included in package
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE laundry_services IS 'Predefined laundry services with pricing (WASH_IRON, DRY_CLEAN, IRON_ONLY)';
COMMENT ON COLUMN laundry_services.service_code IS 'Unique code for service (WASH_IRON, DRY_CLEAN, IRON_ONLY)';
COMMENT ON COLUMN laundry_services.unit IS 'Pricing unit: per_kg or per_item';
COMMENT ON COLUMN laundry_services.is_package IS 'TRUE if this is a bundled service (e.g., Wash+Iron)';
COMMENT ON COLUMN laundry_services.package_includes IS 'Array of service codes included in package';

-- Insert default laundry services
INSERT INTO laundry_services (service_code, service_name, base_price, unit, is_package, package_includes, description) VALUES
('WASH_IRON', 'Wash + Iron Package', 3.50, 'per_kg', TRUE, ARRAY['WASH', 'IRON'], 'Mandatory package - wash and iron together (cannot be separated)'),
('DRY_CLEAN', 'Dry Clean', 8.00, 'per_item', FALSE, NULL, 'Professional dry cleaning service per item'),
('IRON_ONLY', 'Iron Only', 2.00, 'per_kg', FALSE, NULL, 'Iron only service (no washing)')
ON CONFLICT (service_code) DO NOTHING;

-- =====================================================
-- 3. UPDATE CLEANING_JOBS TABLE
-- =====================================================
-- Add VAT and subtotal fields to cleaning_jobs
ALTER TABLE cleaning_jobs
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS cleaning_tier VARCHAR(50) DEFAULT 'cleaning_only';

COMMENT ON COLUMN cleaning_jobs.cleaning_tier IS 'Service tier: cleaning_only or cleaning_with_laundry';
COMMENT ON COLUMN cleaning_jobs.subtotal IS 'Subtotal before VAT (time blocks × rate)';
COMMENT ON COLUMN cleaning_jobs.vat_rate IS 'VAT rate applied (%)';
COMMENT ON COLUMN cleaning_jobs.vat_amount IS 'VAT amount in EUR';
COMMENT ON COLUMN cleaning_jobs.total_cost IS 'Total cost including VAT (subtotal + vat_amount)';

-- =====================================================
-- 4. UPDATE LAUNDRY_ORDERS_NEW TABLE
-- =====================================================
-- Add service reference, delivery, and VAT fields
ALTER TABLE laundry_orders_new
ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES laundry_services(id),
ADD COLUMN IF NOT EXISTS delivery_requested BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS total_with_vat DECIMAL(10,2);

COMMENT ON COLUMN laundry_orders_new.service_id IS 'Reference to laundry_services table';
COMMENT ON COLUMN laundry_orders_new.delivery_requested IS 'TRUE if client requested delivery service';
COMMENT ON COLUMN laundry_orders_new.delivery_fee IS 'Delivery fee charged (from system_settings)';
COMMENT ON COLUMN laundry_orders_new.subtotal IS 'Subtotal before VAT (base_price + delivery_fee)';
COMMENT ON COLUMN laundry_orders_new.vat_rate IS 'VAT rate applied (%)';
COMMENT ON COLUMN laundry_orders_new.vat_amount IS 'VAT amount in EUR';
COMMENT ON COLUMN laundry_orders_new.total_with_vat IS 'Total cost including VAT';
COMMENT ON COLUMN laundry_orders_new.total_price IS 'Same as total_with_vat (for backwards compatibility)';

-- =====================================================
-- 5. TRIGGER: CALCULATE CLEANING JOB COST WITH 30MIN ROUNDING
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_cleaning_cost()
RETURNS TRIGGER AS $$
DECLARE
    v_duration_minutes INTEGER;
    v_blocks_30min INTEGER;
    v_rate_per_block DECIMAL(10,2);
    v_vat_rate DECIMAL(5,2);
BEGIN
    -- Only calculate if job has ended
    IF NEW.actual_end_time IS NOT NULL AND NEW.actual_start_time IS NOT NULL THEN
        -- Calculate duration in minutes
        v_duration_minutes := EXTRACT(EPOCH FROM (NEW.actual_end_time - NEW.actual_start_time)) / 60;

        -- Round UP to nearest 30-minute block (CEIL)
        -- Examples: 1-30min = 1 block, 31-60min = 2 blocks, 61-90min = 3 blocks
        v_blocks_30min := CEIL(v_duration_minutes / 30.0);

        -- Get rate per 30min block from system settings
        SELECT setting_value::DECIMAL INTO v_rate_per_block
        FROM system_settings WHERE setting_key = 'cleaning_rate_30min';

        -- Default to 15.00 if setting not found
        IF v_rate_per_block IS NULL THEN
            v_rate_per_block := 15.00;
        END IF;

        -- Calculate subtotal (number of 30min blocks × rate per block)
        NEW.total_duration_minutes := v_blocks_30min * 30;
        NEW.subtotal := v_blocks_30min * v_rate_per_block;

        -- Get VAT rate from system settings
        SELECT setting_value::DECIMAL INTO v_vat_rate
        FROM system_settings WHERE setting_key = 'vat_rate';

        -- Default to 23% if setting not found
        IF v_vat_rate IS NULL THEN
            v_vat_rate := 23;
        END IF;

        -- Calculate VAT
        NEW.vat_rate := v_vat_rate;
        NEW.vat_amount := ROUND(NEW.subtotal * (v_vat_rate / 100), 2);

        -- Calculate total with VAT
        NEW.total_cost := NEW.subtotal + NEW.vat_amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_cleaning_cost
    BEFORE INSERT OR UPDATE ON cleaning_jobs
    FOR EACH ROW
    EXECUTE FUNCTION calculate_cleaning_cost();

COMMENT ON FUNCTION calculate_cleaning_cost() IS 'Auto-calculate cleaning job cost: rounds time to 30min blocks, applies rate, adds VAT';

-- =====================================================
-- 6. TRIGGER: CALCULATE LAUNDRY ORDER TOTAL WITH VAT
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_laundry_total()
RETURNS TRIGGER AS $$
DECLARE
    v_vat_rate DECIMAL(5,2);
    v_delivery_fee DECIMAL(10,2);
BEGIN
    -- Get current VAT rate from system settings
    SELECT setting_value::DECIMAL INTO v_vat_rate
    FROM system_settings WHERE setting_key = 'vat_rate';

    -- Default to 23% if not found
    IF v_vat_rate IS NULL THEN
        v_vat_rate := 23;
    END IF;

    -- Get delivery fee from settings if delivery requested
    IF NEW.delivery_requested = TRUE THEN
        SELECT setting_value::DECIMAL INTO v_delivery_fee
        FROM system_settings WHERE setting_key = 'delivery_fee';

        IF v_delivery_fee IS NULL THEN
            v_delivery_fee := 5.00;
        END IF;

        NEW.delivery_fee := v_delivery_fee;
    ELSE
        NEW.delivery_fee := 0.00;
    END IF;

    -- Calculate subtotal (base_price already set + delivery fee)
    NEW.subtotal := COALESCE(NEW.base_price, 0.00) + COALESCE(NEW.delivery_fee, 0.00);

    -- Calculate VAT
    NEW.vat_rate := v_vat_rate;
    NEW.vat_amount := ROUND(NEW.subtotal * (v_vat_rate / 100), 2);

    -- Calculate total with VAT
    NEW.total_with_vat := NEW.subtotal + NEW.vat_amount;

    -- Update total_price for backwards compatibility
    NEW.total_price := NEW.total_with_vat;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_laundry_total
    BEFORE INSERT OR UPDATE ON laundry_orders_new
    FOR EACH ROW
    EXECUTE FUNCTION calculate_laundry_total();

COMMENT ON FUNCTION calculate_laundry_total() IS 'Auto-calculate laundry order total: base_price + delivery (if requested) + VAT';

-- =====================================================
-- 7. UPDATE EXISTING DATA
-- =====================================================
-- Set default service_id for existing laundry orders (NULL is OK for old data)
-- Update existing cleaning jobs with default tier
UPDATE cleaning_jobs SET cleaning_tier = 'cleaning_only' WHERE cleaning_tier IS NULL;

-- =====================================================
-- 8. CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_laundry_services_code ON laundry_services(service_code);
CREATE INDEX IF NOT EXISTS idx_laundry_services_active ON laundry_services(is_active);
CREATE INDEX IF NOT EXISTS idx_laundry_orders_service ON laundry_orders_new(service_id);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Summary of changes:
-- 1. ✅ Created system_settings table with VAT, delivery fee, cleaning rate
-- 2. ✅ Created laundry_services table with 3 services
-- 3. ✅ Added VAT fields to cleaning_jobs
-- 4. ✅ Added service_id, delivery, and VAT fields to laundry_orders_new
-- 5. ✅ Created trigger for cleaning cost calculation (30min rounding + VAT)
-- 6. ✅ Created trigger for laundry total calculation (delivery + VAT)
-- 7. ✅ Created indexes for performance
-- =====================================================

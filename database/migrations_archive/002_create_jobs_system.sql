-- Migration: Create comprehensive jobs/tasks system
-- Date: 2025-10-02
-- Purpose: Airbnb/House cleaning jobs and Laundry orders with mobile app support

-- ==============================================
-- DROP EXISTING TABLES (if needed for clean migration)
-- ==============================================
DROP TABLE IF EXISTS cleaning_job_photos CASCADE;
DROP TABLE IF EXISTS cleaning_time_logs CASCADE;
DROP TABLE IF EXISTS cleaning_jobs CASCADE;
DROP TABLE IF EXISTS laundry_order_items CASCADE;
DROP TABLE IF EXISTS laundry_orders_new CASCADE;
DROP TABLE IF EXISTS job_notifications CASCADE;

-- ==============================================
-- CLEANING JOBS (Airbnb & Houses)
-- ==============================================
CREATE TABLE cleaning_jobs (
    id SERIAL PRIMARY KEY,

    -- Client & Assignment
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    assigned_worker_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Job Type
    job_type VARCHAR(20) NOT NULL CHECK (job_type IN ('airbnb', 'house')),

    -- Location Details
    property_name VARCHAR(200),
    property_address TEXT NOT NULL,
    address_line1 VARCHAR(200) NOT NULL,
    address_line2 VARCHAR(200),
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    district VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Portugal',

    -- Scheduling
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,

    -- Time Tracking & Billing
    estimated_hours DECIMAL(5,2),
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    total_duration_minutes INTEGER,
    hourly_rate DECIMAL(10,2) DEFAULT 15.00,
    total_cost DECIMAL(10,2),

    -- Job Status
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),

    -- Payment
    payment_status VARCHAR(20) DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'partial')),
    payment_method VARCHAR(50),
    paid_amount DECIMAL(10,2) DEFAULT 0,

    -- Additional Info
    notes TEXT,
    special_instructions TEXT,
    client_feedback TEXT,
    client_rating INTEGER CHECK (client_rating >= 1 AND client_rating <= 5),

    -- Metadata
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,

    -- Mobile App Support
    push_notification_sent BOOLEAN DEFAULT FALSE,
    client_viewed_photos BOOLEAN DEFAULT FALSE,
    last_synced_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_cleaning_jobs_client ON cleaning_jobs(client_id);
CREATE INDEX idx_cleaning_jobs_worker ON cleaning_jobs(assigned_worker_id);
CREATE INDEX idx_cleaning_jobs_status ON cleaning_jobs(status);
CREATE INDEX idx_cleaning_jobs_date ON cleaning_jobs(scheduled_date);
CREATE INDEX idx_cleaning_jobs_type ON cleaning_jobs(job_type);

-- ==============================================
-- CLEANING JOB WORKERS (Multiple workers per job)
-- ==============================================
CREATE TABLE cleaning_job_workers (
    id SERIAL PRIMARY KEY,
    cleaning_job_id INTEGER NOT NULL REFERENCES cleaning_jobs(id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_primary BOOLEAN DEFAULT FALSE,
    UNIQUE(cleaning_job_id, worker_id)
);

CREATE INDEX idx_job_workers_job ON cleaning_job_workers(cleaning_job_id);
CREATE INDEX idx_job_workers_worker ON cleaning_job_workers(worker_id);

-- ==============================================
-- CLEANING TIME LOGS (for accurate billing)
-- ==============================================
CREATE TABLE cleaning_time_logs (
    id SERIAL PRIMARY KEY,
    cleaning_job_id INTEGER NOT NULL REFERENCES cleaning_jobs(id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Time Tracking
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_minutes INTEGER,

    -- Location Tracking (for mobile app)
    start_latitude DECIMAL(10,8),
    start_longitude DECIMAL(11,8),
    end_latitude DECIMAL(10,8),
    end_longitude DECIMAL(11,8),

    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_time_logs_job ON cleaning_time_logs(cleaning_job_id);
CREATE INDEX idx_time_logs_worker ON cleaning_time_logs(worker_id);

-- ==============================================
-- CLEANING JOB PHOTOS (Before/After)
-- ==============================================
CREATE TABLE cleaning_job_photos (
    id SERIAL PRIMARY KEY,
    cleaning_job_id INTEGER NOT NULL REFERENCES cleaning_jobs(id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Photo Details
    photo_url VARCHAR(500) NOT NULL,
    photo_type VARCHAR(20) NOT NULL CHECK (photo_type IN ('before', 'after', 'detail')),
    room_area VARCHAR(100), -- e.g., 'Kitchen', 'Bathroom', 'Living Room'

    -- Mobile Support
    thumbnail_url VARCHAR(500),
    file_size_kb INTEGER,
    original_filename VARCHAR(255),

    -- Metadata
    caption TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Client Viewing
    viewed_by_client BOOLEAN DEFAULT FALSE,
    viewed_at TIMESTAMP
);

CREATE INDEX idx_photos_job ON cleaning_job_photos(cleaning_job_id);
CREATE INDEX idx_photos_type ON cleaning_job_photos(photo_type);

-- ==============================================
-- LAUNDRY ORDERS (Updated with new requirements)
-- ==============================================
CREATE TABLE laundry_orders_new (
    id SERIAL PRIMARY KEY,

    -- Client & Assignment
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    assigned_worker_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Order Number (for tracking)
    order_number VARCHAR(50) UNIQUE NOT NULL,

    -- Order Type
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('bulk_kg', 'itemized', 'house_bundle')),

    -- Bulk Weight (if order_type = 'bulk_kg')
    total_weight_kg DECIMAL(10,2),
    price_per_kg DECIMAL(10,2) DEFAULT 3.50,

    -- Pricing
    base_price DECIMAL(10,2),
    additional_charges DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'in_progress', 'ready', 'collected', 'cancelled')),

    -- Payment
    payment_status VARCHAR(20) DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'partial')),
    payment_method VARCHAR(50),
    paid_amount DECIMAL(10,2) DEFAULT 0,

    -- Dates & Times
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ready_at TIMESTAMP,
    collected_at TIMESTAMP,
    expected_ready_date DATE,

    -- Notifications
    ready_notification_sent BOOLEAN DEFAULT FALSE,
    ready_notification_sent_at TIMESTAMP,
    client_notified_via VARCHAR(50), -- 'sms', 'email', 'push', 'whatsapp'

    -- Additional Info
    special_instructions TEXT,
    internal_notes TEXT,
    client_feedback TEXT,
    client_rating INTEGER CHECK (client_rating >= 1 AND client_rating <= 5),

    -- Metadata
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Mobile App Support
    push_notification_sent BOOLEAN DEFAULT FALSE,
    last_synced_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_laundry_orders_client ON laundry_orders_new(client_id);
CREATE INDEX idx_laundry_orders_worker ON laundry_orders_new(assigned_worker_id);
CREATE INDEX idx_laundry_orders_status ON laundry_orders_new(status);
CREATE INDEX idx_laundry_orders_number ON laundry_orders_new(order_number);

-- ==============================================
-- LAUNDRY ORDER ITEMS (for itemized orders)
-- ==============================================
CREATE TABLE laundry_order_items (
    id SERIAL PRIMARY KEY,
    laundry_order_id INTEGER NOT NULL REFERENCES laundry_orders_new(id) ON DELETE CASCADE,

    -- Item Details
    item_type VARCHAR(100) NOT NULL, -- 'shirt', 'pants', 'dress', 'blanket', 'towel', etc.
    item_category VARCHAR(50), -- 'clothing', 'bedding', 'curtains', etc.
    quantity INTEGER NOT NULL DEFAULT 1,

    -- Pricing
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,

    -- Item Condition
    condition_notes TEXT, -- 'stain on collar', 'missing button', etc.
    special_treatment VARCHAR(100), -- 'delicate', 'dry-clean', 'iron-only', etc.

    -- Status per item
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'washing', 'drying', 'ironing', 'ready')),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_laundry_items_order ON laundry_order_items(laundry_order_id);
CREATE INDEX idx_laundry_items_type ON laundry_order_items(item_type);

-- ==============================================
-- NOTIFICATIONS SYSTEM (for mobile apps)
-- ==============================================
CREATE TABLE job_notifications (
    id SERIAL PRIMARY KEY,

    -- Recipient
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,

    -- Notification Type
    notification_type VARCHAR(50) NOT NULL
        CHECK (notification_type IN (
            'job_assigned', 'job_started', 'job_completed',
            'laundry_ready', 'laundry_collected', 'payment_received',
            'photo_uploaded', 'feedback_requested'
        )),

    -- Related Entities
    cleaning_job_id INTEGER REFERENCES cleaning_jobs(id) ON DELETE CASCADE,
    laundry_order_id INTEGER REFERENCES laundry_orders_new(id) ON DELETE CASCADE,

    -- Message
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,

    -- Delivery
    delivery_method VARCHAR(20) CHECK (delivery_method IN ('push', 'sms', 'email', 'in_app')),
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,

    -- Status
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),

    -- Mobile App
    push_token TEXT, -- FCM/APNs token
    deep_link VARCHAR(500), -- for app navigation

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON job_notifications(user_id);
CREATE INDEX idx_notifications_client ON job_notifications(client_id);
CREATE INDEX idx_notifications_status ON job_notifications(status);
CREATE INDEX idx_notifications_type ON job_notifications(notification_type);

-- ==============================================
-- TRIGGERS FOR UPDATED_AT
-- ==============================================

-- Cleaning Jobs
CREATE OR REPLACE FUNCTION update_cleaning_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cleaning_jobs_updated_at
    BEFORE UPDATE ON cleaning_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_cleaning_jobs_updated_at();

-- Laundry Orders
CREATE OR REPLACE FUNCTION update_laundry_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_laundry_orders_updated_at
    BEFORE UPDATE ON laundry_orders_new
    FOR EACH ROW
    EXECUTE FUNCTION update_laundry_orders_updated_at();

-- ==============================================
-- TRIGGERS FOR AUTO-CALCULATIONS
-- ==============================================

-- Auto-calculate cleaning job total cost
CREATE OR REPLACE FUNCTION calculate_cleaning_job_cost()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.actual_end_time IS NOT NULL AND NEW.actual_start_time IS NOT NULL THEN
        NEW.total_duration_minutes = EXTRACT(EPOCH FROM (NEW.actual_end_time - NEW.actual_start_time)) / 60;
        NEW.total_cost = (NEW.total_duration_minutes / 60.0) * NEW.hourly_rate;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_cleaning_cost
    BEFORE INSERT OR UPDATE ON cleaning_jobs
    FOR EACH ROW
    EXECUTE FUNCTION calculate_cleaning_job_cost();

-- Auto-calculate laundry order total
CREATE OR REPLACE FUNCTION calculate_laundry_total()
RETURNS TRIGGER AS $$
BEGIN
    -- For bulk orders, calculate from weight
    IF NEW.order_type = 'bulk_kg' AND NEW.total_weight_kg IS NOT NULL THEN
        NEW.base_price = NEW.total_weight_kg * NEW.price_per_kg;
    END IF;

    -- Calculate final total
    NEW.total_price = NEW.base_price + COALESCE(NEW.additional_charges, 0) - COALESCE(NEW.discount, 0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_laundry_total
    BEFORE INSERT OR UPDATE ON laundry_orders_new
    FOR EACH ROW
    EXECUTE FUNCTION calculate_laundry_total();

-- ==============================================
-- COMMENTS FOR DOCUMENTATION
-- ==============================================

COMMENT ON TABLE cleaning_jobs IS 'Airbnb and house cleaning jobs with time tracking';
COMMENT ON TABLE cleaning_time_logs IS 'Time tracking logs for billing accuracy';
COMMENT ON TABLE cleaning_job_photos IS 'Before/after photos for client viewing';
COMMENT ON TABLE laundry_orders_new IS 'Laundry orders supporting bulk, itemized, and house bundles';
COMMENT ON TABLE laundry_order_items IS 'Individual items in laundry orders';
COMMENT ON TABLE job_notifications IS 'Notification system for mobile apps and SMS/email';

COMMENT ON COLUMN cleaning_jobs.job_type IS 'Type of cleaning: airbnb or house';
COMMENT ON COLUMN cleaning_jobs.status IS 'Job workflow status';
COMMENT ON COLUMN cleaning_jobs.total_duration_minutes IS 'Auto-calculated from time logs';
COMMENT ON COLUMN cleaning_jobs.total_cost IS 'Auto-calculated: duration * hourly_rate';

COMMENT ON COLUMN laundry_orders_new.order_type IS 'bulk_kg, itemized, or house_bundle';
COMMENT ON COLUMN laundry_orders_new.status IS 'received → in_progress → ready → collected';
COMMENT ON COLUMN laundry_orders_new.ready_notification_sent IS 'TRUE when client notified order is ready';

-- ==============================================
-- SAMPLE DATA (for testing)
-- ==============================================

-- Sample cleaning job
INSERT INTO cleaning_jobs (
    client_id, job_type, property_address, address_line1, city,
    scheduled_date, scheduled_time, status, created_by
) VALUES (
    1, 'airbnb', 'Apartment 12B, Rua das Flores', 'Rua das Flores, 123', 'Lisboa',
    CURRENT_DATE + INTERVAL '2 days', '10:00:00', 'scheduled', 1
);

-- Sample laundry order (bulk)
INSERT INTO laundry_orders_new (
    client_id, order_number, order_type, total_weight_kg,
    base_price, total_price, status, created_by
) VALUES (
    1, 'LDR-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-001',
    'bulk_kg', 5.5, 19.25, 19.25, 'received', 1
);

-- Sample laundry order (itemized)
INSERT INTO laundry_orders_new (
    client_id, order_number, order_type, base_price, total_price, status, created_by
) VALUES (
    1, 'LDR-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-002',
    'itemized', 0, 0, 'received', 1
) RETURNING id;

-- Sample items (assuming order id = 2)
INSERT INTO laundry_order_items (laundry_order_id, item_type, item_category, quantity, unit_price, total_price)
VALUES
    (2, 'Shirt', 'clothing', 3, 2.50, 7.50),
    (2, 'Pants', 'clothing', 2, 3.00, 6.00),
    (2, 'Towel', 'bedding', 5, 1.50, 7.50);

-- Update the order total
UPDATE laundry_orders_new SET base_price = 21.00, total_price = 21.00 WHERE id = 2;

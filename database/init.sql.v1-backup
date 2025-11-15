-- ==============================================
-- Lavandaria PostgreSQL Database Schema (COMPLETE)
-- ==============================================
-- This is the SINGLE SOURCE OF TRUTH for development
-- No migration files needed - this creates everything from scratch
--
-- Date: 2025-10-21
-- Purpose: Complete database schema for Lavandaria dual-business system
-- ==============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- SESSION TABLE (for express-session)
-- ==============================================
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- ==============================================
-- USERS (Staff: master, admin, worker)
-- ==============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('master', 'admin', 'worker')),
    full_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    date_of_birth DATE,
    nif VARCHAR(20),
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    district VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Portugal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ==============================================
-- CLIENTS (Customers)
-- ==============================================
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(100),
    date_of_birth DATE,
    nif VARCHAR(20),
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    district VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Portugal',
    notes TEXT,
    is_enterprise BOOLEAN DEFAULT FALSE,
    company_name VARCHAR(200),
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    must_change_password BOOLEAN DEFAULT TRUE
);

-- ==============================================
-- PROPERTIES (Client addresses for services)
-- ==============================================
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(200),
    address_line1 VARCHAR(200) NOT NULL,
    address_line2 VARCHAR(200),
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    district VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Portugal',
    property_type VARCHAR(50),
    access_instructions TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- CLEANING JOBS (Airbnb & Houses)
-- ==============================================
CREATE TABLE cleaning_jobs (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    assigned_worker_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    job_type VARCHAR(20) NOT NULL CHECK (job_type IN ('airbnb', 'house')),
    property_name VARCHAR(200),
    property_address TEXT NOT NULL,
    address_line1 VARCHAR(200) NOT NULL,
    address_line2 VARCHAR(200),
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    district VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Portugal',
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    estimated_hours DECIMAL(5,2),
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    total_duration_minutes INTEGER,
    hourly_rate DECIMAL(10,2) DEFAULT 15.00,
    total_cost DECIMAL(10,2),
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    payment_status VARCHAR(20) DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'partial')),
    payment_method VARCHAR(50),
    paid_amount DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    special_instructions TEXT,
    client_feedback TEXT,
    client_rating INTEGER CHECK (client_rating >= 1 AND client_rating <= 5),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    push_notification_sent BOOLEAN DEFAULT FALSE,
    client_viewed_photos BOOLEAN DEFAULT FALSE,
    last_synced_at TIMESTAMP
);

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
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_minutes INTEGER,
    start_latitude DECIMAL(10,8),
    start_longitude DECIMAL(11,8),
    end_latitude DECIMAL(10,8),
    end_longitude DECIMAL(11,8),
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
    photo_url VARCHAR(500) NOT NULL,
    photo_type VARCHAR(20) NOT NULL CHECK (photo_type IN ('before', 'after', 'detail')),
    room_area VARCHAR(100),
    thumbnail_url VARCHAR(500),
    file_size_kb INTEGER,
    original_filename VARCHAR(255),
    caption TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    viewed_by_client BOOLEAN DEFAULT FALSE,
    viewed_at TIMESTAMP
);

CREATE INDEX idx_photos_job ON cleaning_job_photos(cleaning_job_id);
CREATE INDEX idx_photos_type ON cleaning_job_photos(photo_type);

-- ==============================================
-- LAUNDRY SERVICES (Service catalog with pricing)
-- ==============================================
CREATE TABLE laundry_services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('wash', 'dry_clean', 'iron', 'special')),
    base_price DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) DEFAULT 'item',
    estimated_duration_minutes INTEGER,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- LAUNDRY ORDERS
-- ==============================================
CREATE TABLE laundry_orders_new (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    assigned_worker_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('bulk_kg', 'itemized', 'house_bundle')),
    total_weight_kg DECIMAL(10,2),
    price_per_kg DECIMAL(10,2) DEFAULT 3.50,
    base_price DECIMAL(10,2),
    additional_charges DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'in_progress', 'ready', 'collected', 'cancelled')),
    payment_status VARCHAR(20) DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'partial')),
    payment_method VARCHAR(50),
    paid_amount DECIMAL(10,2) DEFAULT 0,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ready_at TIMESTAMP,
    collected_at TIMESTAMP,
    expected_ready_date DATE,
    ready_notification_sent BOOLEAN DEFAULT FALSE,
    ready_notification_sent_at TIMESTAMP,
    client_notified_via VARCHAR(50),
    special_instructions TEXT,
    internal_notes TEXT,
    client_feedback TEXT,
    client_rating INTEGER CHECK (client_rating >= 1 AND client_rating <= 5),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    push_notification_sent BOOLEAN DEFAULT FALSE,
    last_synced_at TIMESTAMP
);

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
    item_type VARCHAR(100) NOT NULL,
    item_category VARCHAR(50),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    condition_notes TEXT,
    special_treatment VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'washing', 'drying', 'ironing', 'ready')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_laundry_items_order ON laundry_order_items(laundry_order_id);
CREATE INDEX idx_laundry_items_type ON laundry_order_items(item_type);

-- ==============================================
-- PAYMENTS - SPLIT TABLES FOR FK INTEGRITY
-- ==============================================

-- Payments for cleaning jobs
CREATE TABLE payments_cleaning (
    id SERIAL PRIMARY KEY,
    cleaning_job_id INTEGER NOT NULL REFERENCES cleaning_jobs(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'mbway', 'other')),
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_cleaning_job ON payments_cleaning(cleaning_job_id);
CREATE INDEX idx_payments_cleaning_client ON payments_cleaning(client_id);
CREATE INDEX idx_payments_cleaning_date ON payments_cleaning(payment_date);

-- Payments for laundry orders
CREATE TABLE payments_laundry (
    id SERIAL PRIMARY KEY,
    laundry_order_id INTEGER NOT NULL REFERENCES laundry_orders_new(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'mbway', 'other')),
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_laundry_order ON payments_laundry(laundry_order_id);
CREATE INDEX idx_payments_laundry_client ON payments_laundry(client_id);
CREATE INDEX idx_payments_laundry_date ON payments_laundry(payment_date);

-- ==============================================
-- TICKETS (Worker issue reporting)
-- ==============================================
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    order_type VARCHAR(20) CHECK (order_type IN ('laundry', 'cleaning', 'general')),
    order_id INTEGER,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);

-- ==============================================
-- JOB NOTIFICATIONS (for mobile apps)
-- ==============================================
CREATE TABLE job_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL
        CHECK (notification_type IN (
            'job_assigned', 'job_started', 'job_completed',
            'laundry_ready', 'laundry_collected', 'payment_received',
            'photo_uploaded', 'feedback_requested'
        )),
    cleaning_job_id INTEGER REFERENCES cleaning_jobs(id) ON DELETE CASCADE,
    laundry_order_id INTEGER REFERENCES laundry_orders_new(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    delivery_method VARCHAR(20) CHECK (delivery_method IN ('push', 'sms', 'email', 'in_app')),
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    push_token TEXT,
    deep_link VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON job_notifications(user_id);
CREATE INDEX idx_notifications_client ON job_notifications(client_id);
CREATE INDEX idx_notifications_status ON job_notifications(status);
CREATE INDEX idx_notifications_type ON job_notifications(notification_type);

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_properties_client ON properties(client_id);

-- ==============================================
-- TRIGGERS FOR AUTO-UPDATES
-- ==============================================

-- Auto-update updated_at for users
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- Auto-update updated_at for cleaning_jobs
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

-- Auto-update updated_at for laundry_orders_new
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

-- Auto-calculate cleaning job cost
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
    IF NEW.order_type = 'bulk_kg' AND NEW.total_weight_kg IS NOT NULL THEN
        NEW.base_price = NEW.total_weight_kg * NEW.price_per_kg;
    END IF;
    NEW.total_price = NEW.base_price + COALESCE(NEW.additional_charges, 0) - COALESCE(NEW.discount, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_laundry_total
    BEFORE INSERT OR UPDATE ON laundry_orders_new
    FOR EACH ROW
    EXECUTE FUNCTION calculate_laundry_total();

-- ==============================================
-- SEED DATA (for development/testing)
-- ==============================================

-- Insert default users (passwords are bcrypt hashed)
-- Master: password = master123
-- Admin: password = admin123
-- Worker: password = worker123
INSERT INTO users (username, password, role, full_name, first_name, last_name, email) VALUES
('master', '$2b$10$iyoWMyQRwUrseBPEUOvu6.9xMRJ4d6RCjIbfv/OpollcbeMQWiU.e', 'master', 'Master Admin', 'Master', 'Admin', 'master@lavandaria.com'),
('admin', '$2b$10$AC7dVLo.KeW3YgIeveZ9C.Dy/qmDxQhoDtvf0Q2vW2k/EZyy8uNEy', 'admin', 'Administrator', 'Administrator', '', 'admin@lavandaria.com'),
('worker1', '$2b$10$5TBBvMz.csBeXlp/isBgnuMi8xlMGywuot8VUxN5QaP5Qz7ELYZJW', 'worker', 'Maria Silva', 'Maria', 'Silva', NULL)
ON CONFLICT (username) DO NOTHING;

UPDATE users SET created_by = 1 WHERE username IN ('admin', 'worker1');

-- Insert sample client
INSERT INTO clients (phone, password, full_name, first_name, last_name, email, notes) VALUES
('911111111', '$2b$10$XYjLzqW8K9H.eN6D9h3.8OZN.q7K6r3zv3fV3d7N.H8K9XYjLzqW8K', 'João Santos', 'João', 'Santos', 'joao@example.com', 'Sample client for testing')
ON CONFLICT (phone) DO NOTHING;

-- Insert laundry services
INSERT INTO laundry_services (name, service_type, base_price, unit, estimated_duration_minutes, description) VALUES
('Wash & Fold', 'wash', 8.00, 'kg', 1440, 'Standard wash and fold service'),
('Dry Cleaning', 'dry_clean', 12.00, 'item', 2880, 'Professional dry cleaning'),
('Iron Only', 'iron', 3.00, 'item', 720, 'Ironing service only'),
('Express Wash', 'wash', 15.00, 'kg', 180, '3-hour express service'),
('Delicate Care', 'special', 10.00, 'kg', 1440, 'Special care for delicate items'),
('Shirt Service', 'wash', 4.00, 'item', 1440, 'Wash and iron shirts'),
('Suit Service', 'dry_clean', 18.00, 'item', 2880, 'Dry clean and press suits'),
('Bedding Service', 'wash', 12.00, 'item', 1440, 'Wash and fold bedding'),
('Curtain Cleaning', 'special', 20.00, 'item', 2880, 'Professional curtain cleaning'),
('Shoe Cleaning', 'special', 8.00, 'item', 1440, 'Professional shoe cleaning'),
('Bag Cleaning', 'special', 15.00, 'item', 2880, 'Handbag and backpack cleaning'),
('Alterations', 'special', 10.00, 'item', NULL, 'Basic clothing alterations')
ON CONFLICT DO NOTHING;

-- Insert sample laundry orders
INSERT INTO laundry_orders_new (client_id, order_number, order_type, total_weight_kg, base_price, total_price, status, created_by) VALUES
(1, 'LDR-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-001', 'bulk_kg', 5.5, 19.25, 19.25, 'received', 1),
(1, 'LDR-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-002', 'itemized', 0, 21.00, 21.00, 'received', 1)
ON CONFLICT (order_number) DO NOTHING;

-- Insert sample cleaning job
INSERT INTO cleaning_jobs (client_id, job_type, property_address, address_line1, city, scheduled_date, scheduled_time, status, created_by) VALUES
(1, 'airbnb', 'Apartment 12B, Rua das Flores', 'Rua das Flores, 123', 'Lisboa', CURRENT_DATE + INTERVAL '2 days', '10:00:00', 'scheduled', 1)
ON CONFLICT DO NOTHING;

-- ==============================================
-- COMMENTS FOR DOCUMENTATION
-- ==============================================
COMMENT ON TABLE cleaning_jobs IS 'Airbnb and house cleaning jobs with time tracking';
COMMENT ON TABLE cleaning_time_logs IS 'Time tracking logs for billing accuracy';
COMMENT ON TABLE cleaning_job_photos IS 'Before/after photos for client viewing';
COMMENT ON TABLE laundry_orders_new IS 'Laundry orders supporting bulk, itemized, and house bundles';
COMMENT ON TABLE laundry_order_items IS 'Individual items in laundry orders';
COMMENT ON TABLE payments_cleaning IS 'Payments for cleaning jobs with FK to cleaning_jobs';
COMMENT ON TABLE payments_laundry IS 'Payments for laundry orders with FK to laundry_orders_new';
COMMENT ON TABLE job_notifications IS 'Notification system for mobile apps and SMS/email';


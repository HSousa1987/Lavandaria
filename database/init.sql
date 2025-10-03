-- Lavandaria PostgreSQL Database Schema
-- This file is automatically executed when the database container starts

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Session table for express-session with connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Users table (master, admin, and workers)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('master', 'admin', 'worker')),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Clients table
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    must_change_password BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT
);

-- Properties/Addresses table (for both laundry pickup and Airbnb cleaning)
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    property_name VARCHAR(100),
    address_line1 VARCHAR(200) NOT NULL,
    address_line2 VARCHAR(200),
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) DEFAULT 'Portugal',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    property_type VARCHAR(50) CHECK (property_type IN ('house', 'apartment', 'studio', 'airbnb', 'commercial')),
    access_instructions TEXT,
    key_location VARCHAR(200),
    parking_info VARCHAR(200),
    special_notes TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Laundry orders
CREATE TABLE laundry_orders (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    service_type VARCHAR(50) NOT NULL,
    quantity DECIMAL(10,2),
    unit VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'ready', 'delivered', 'cancelled')),
    price DECIMAL(10,2),
    paid BOOLEAN DEFAULT FALSE,
    pickup_scheduled TIMESTAMP,
    pickup_completed TIMESTAMP,
    delivery_scheduled TIMESTAMP,
    delivery_completed TIMESTAMP,
    assigned_worker_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Airbnb cleaning orders
CREATE TABLE airbnb_orders (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'verified', 'cancelled')),
    scheduled_date DATE NOT NULL,
    scheduled_time TIME,
    arrived_at TIMESTAMP,
    completed_date TIMESTAMP,
    assigned_cleaner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    price DECIMAL(10,2),
    paid BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Photos for cleaning verification
CREATE TABLE cleaning_photos (
    id SERIAL PRIMARY KEY,
    airbnb_order_id INTEGER NOT NULL REFERENCES airbnb_orders(id) ON DELETE CASCADE,
    photo_path VARCHAR(255) NOT NULL,
    photo_type VARCHAR(20) DEFAULT 'after' CHECK (photo_type IN ('before', 'after', 'detail')),
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes VARCHAR(255)
);

-- Time logs for cleaners
CREATE TABLE time_logs (
    id SERIAL PRIMARY KEY,
    airbnb_order_id INTEGER NOT NULL REFERENCES airbnb_orders(id) ON DELETE CASCADE,
    cleaner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    total_hours DECIMAL(5,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments/Finance tracking
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('laundry', 'airbnb')),
    order_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'mbway', 'other')),
    payment_date TIMESTAMP NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tickets/Issues table (workers can create these when there's a problem)
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    order_type VARCHAR(20) CHECK (order_type IN ('laundry', 'airbnb', 'general')),
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

-- Services catalog (what services do you offer?)
CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('laundry', 'airbnb')),
    price DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) DEFAULT 'item',
    duration_minutes INTEGER,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items (breakdown of services in each order)
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('laundry', 'airbnb')),
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    service_name VARCHAR(100),
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order status history (track all status changes)
CREATE TABLE order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('laundry', 'airbnb')),
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_properties_client ON properties(client_id);
CREATE INDEX idx_properties_location ON properties(latitude, longitude);
CREATE INDEX idx_laundry_orders_client ON laundry_orders(client_id);
CREATE INDEX idx_laundry_orders_property ON laundry_orders(property_id);
CREATE INDEX idx_laundry_orders_status ON laundry_orders(status);
CREATE INDEX idx_airbnb_orders_client ON airbnb_orders(client_id);
CREATE INDEX idx_airbnb_orders_property ON airbnb_orders(property_id);
CREATE INDEX idx_airbnb_orders_cleaner ON airbnb_orders(assigned_cleaner_id);
CREATE INDEX idx_airbnb_orders_status ON airbnb_orders(status);
CREATE INDEX idx_airbnb_orders_scheduled ON airbnb_orders(scheduled_date, scheduled_time);
CREATE INDEX idx_cleaning_photos_order ON cleaning_photos(airbnb_order_id);
CREATE INDEX idx_time_logs_order ON time_logs(airbnb_order_id);
CREATE INDEX idx_payments_client ON payments(client_id);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_services_type ON services(type);
CREATE INDEX idx_order_items_order ON order_items(order_id, order_type);
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id, order_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_laundry_orders_updated_at BEFORE UPDATE ON laundry_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_airbnb_orders_updated_at BEFORE UPDATE ON airbnb_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert master user (YOU - full access)
-- Username: master, Password: master123 (CHANGE THIS IN PRODUCTION!)
INSERT INTO users (username, password, role, full_name, email)
VALUES ('master', '$2b$10$iyoWMyQRwUrseBPEUOvu6.9xMRJ4d6RCjIbfv/OpollcbeMQWiU.e', 'master', 'Master Admin', 'master@lavandaria.com');

-- Insert sample admin user (created by master)
-- Username: admin, Password: admin123
INSERT INTO users (username, password, role, full_name, email, created_by)
VALUES ('admin', '$2b$10$AC7dVLo.KeW3YgIeveZ9C.Dy/qmDxQhoDtvf0Q2vW2k/EZyy8uNEy', 'admin', 'Administrator', 'admin@lavandaria.com', 1);

-- Insert sample worker
-- Username: worker1, Password: worker123
INSERT INTO users (username, password, role, full_name, phone, created_by)
VALUES ('worker1', '$2b$10$5TBBvMz.csBeXlp/isBgnuMi8xlMGywuot8VUxN5QaP5Qz7ELYZJW', 'worker', 'Maria Silva', '910000001', 1);

-- Insert sample client for testing
-- Phone: 911111111, Password: lavandaria2025 (default password)
INSERT INTO clients (phone, password, full_name, email, notes)
VALUES ('911111111', '$2b$10$vOCSsIFeI161eBGdwTDLUOC/VoZ/EMfPhw7qemFE/UpiIoZPxRMN6', 'João Santos', 'joao@example.com', 'Sample client for testing');

-- Insert sample services (Laundry)
INSERT INTO services (name, type, price, unit, duration_minutes, description) VALUES
('Wash & Fold', 'laundry', 8.00, 'kg', 1440, 'Standard wash and fold service - 24h turnaround'),
('Dry Cleaning', 'laundry', 12.00, 'item', 2880, 'Professional dry cleaning - 48h turnaround'),
('Iron Only', 'laundry', 3.00, 'item', 720, 'Ironing service only - 12h turnaround'),
('Express Wash', 'laundry', 15.00, 'kg', 180, 'Express wash and fold - 3h turnaround'),
('Delicate Care', 'laundry', 10.00, 'kg', 1440, 'Special care for delicate fabrics');

-- Insert sample services (Airbnb Cleaning)
INSERT INTO services (name, type, price, unit, duration_minutes, description) VALUES
('Studio Cleaning', 'airbnb', 45.00, 'property', 90, 'Complete cleaning for studio apartments'),
('1-Bedroom Cleaning', 'airbnb', 65.00, 'property', 120, 'Complete cleaning for 1-bedroom apartments'),
('2-Bedroom Cleaning', 'airbnb', 85.00, 'property', 150, 'Complete cleaning for 2-bedroom apartments'),
('Deep Clean', 'airbnb', 120.00, 'property', 240, 'Thorough deep cleaning service'),
('Check-Out Clean', 'airbnb', 75.00, 'property', 120, 'Post-guest checkout cleaning and inspection'),
('Linen Change', 'airbnb', 20.00, 'property', 30, 'Change all bed linens and towels'),
('Restocking', 'airbnb', 15.00, 'property', 20, 'Restock toiletries and essentials');

-- Insert sample properties for the test client
-- Lisboa center (lat/long approximate)
INSERT INTO properties (client_id, property_name, address_line1, city, postal_code, latitude, longitude, property_type, access_instructions, key_location, is_primary) VALUES
(1, 'Home Address', 'Rua Example, 123', 'Lisboa', '1000-001', 38.7223, -9.1393, 'house', 'Ring doorbell', 'Under mat', TRUE),
(1, 'Airbnb - Baixa Studio', 'Rua da Prata, 45', 'Lisboa', '1100-420', 38.7118, -9.1398, 'airbnb', 'Key in lockbox, code: 1234', 'Lockbox on door', FALSE),
(1, 'Airbnb - Alfama Apartment', 'Rua São João da Praça, 78', 'Lisboa', '1100-521', 38.7107, -9.1308, 'airbnb', 'Contact doorman', 'Concierge', FALSE);

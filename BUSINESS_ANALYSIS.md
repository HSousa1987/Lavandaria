# Lavandaria - Business Requirements & Implementation Plan

## 🏢 Business Model

**Small laundry and Airbnb cleaning startup - 3 people team**

### Services Offered:

**1. Laundry Services:**
- **Wash + Iron Package** (mandatory together, cannot separate)
- **Dry Clean**
- **Iron Only**
- **Delivery Service** (optional add-on, charged extra - NO PICKUP)

**2. Airbnb/House Cleaning Services:**
- **Cleaning Only** (standard tier)
- **Cleaning + Laundry Package** (wash, dry, iron of house linens)

**Pricing Model:**
- Laundry: Master/Admin set fixed prices per service
- Cleaning: Charged by time worked (rounded to 30-minute blocks)
- Delivery: Fixed extra charge

---

## ✅ Already Implemented

1. ✅ User management (Master/Admin/Worker/Client)
2. ✅ Client CRM with enterprise/individual distinction
3. ✅ Cleaning jobs system with time tracking
4. ✅ Photo upload for cleaning verification
5. ✅ Laundry orders with 3 types (bulk_kg, itemized, house_bundle)
6. ✅ "Mark Ready" notification system
7. ✅ Session-based authentication
8. ✅ PostgreSQL database with proper schema

---

## 🎯 Critical Features to Add

### 1. **Service Catalog & Dynamic Pricing** 🏷️

**What's needed:**
- Master can adjust IVA/VAT rate (system-wide tax setting)
- Master/Admin can adjust service prices
- Predefined laundry services (cannot be deleted, only price-adjusted)
- Delivery fee setting

**Database additions:**
```sql
-- System settings for tax and fees
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('vat_rate', '23', 'IVA/VAT percentage (23% in Portugal)'),
('delivery_fee', '5.00', 'Fixed delivery fee for laundry orders'),
('cleaning_rate_30min', '15.00', 'Hourly rate for cleaning (per 30min block)');

-- Laundry service catalog (predefined, only prices editable)
CREATE TABLE laundry_services (
    id SERIAL PRIMARY KEY,
    service_code VARCHAR(50) UNIQUE NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL, -- 'per_kg', 'per_item', 'fixed'
    is_package BOOLEAN DEFAULT FALSE,
    package_includes TEXT[], -- Array of service_codes if package
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default laundry services
INSERT INTO laundry_services (service_code, service_name, base_price, unit, is_package, package_includes, description) VALUES
('WASH_IRON', 'Wash + Iron Package', 3.50, 'per_kg', TRUE, ARRAY['WASH', 'IRON'], 'Mandatory package - wash and iron together'),
('DRY_CLEAN', 'Dry Clean', 8.00, 'per_item', FALSE, NULL, 'Professional dry cleaning per item'),
('IRON_ONLY', 'Iron Only', 2.00, 'per_kg', FALSE, NULL, 'Iron only service');
```

**UI Requirements:**
- Settings page for Master to adjust VAT, delivery fee, cleaning rate
- Service prices table for Master/Admin to edit
- Clear indication that Wash+Iron is a package (cannot split)

---

### 2. **Enhanced Order System** 📋

**Laundry Order Improvements:**

Current issues:
- Need to link orders to specific services
- Need to calculate with VAT
- Need delivery fee toggle
- Need proper item tracking

**Database changes:**
```sql
-- Update laundry_orders_new table
ALTER TABLE laundry_orders_new
ADD COLUMN service_id INTEGER REFERENCES laundry_services(id),
ADD COLUMN delivery_requested BOOLEAN DEFAULT FALSE,
ADD COLUMN delivery_fee DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN subtotal DECIMAL(10,2),
ADD COLUMN vat_rate DECIMAL(5,2),
ADD COLUMN vat_amount DECIMAL(10,2),
ADD COLUMN total_with_vat DECIMAL(10,2);

-- Auto-calculate totals trigger
CREATE OR REPLACE FUNCTION calculate_laundry_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_vat_rate DECIMAL(5,2);
BEGIN
    -- Get current VAT rate from settings
    SELECT setting_value::DECIMAL INTO v_vat_rate
    FROM system_settings WHERE setting_key = 'vat_rate';

    -- Calculate subtotal (base_price + delivery if requested)
    NEW.subtotal := NEW.base_price + COALESCE(NEW.delivery_fee, 0);

    -- Calculate VAT
    NEW.vat_rate := v_vat_rate;
    NEW.vat_amount := NEW.subtotal * (v_vat_rate / 100);

    -- Calculate total with VAT
    NEW.total_with_vat := NEW.subtotal + NEW.vat_amount;

    -- Update total_price field (for backwards compatibility)
    NEW.total_price := NEW.total_with_vat;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_laundry_totals
    BEFORE INSERT OR UPDATE ON laundry_orders_new
    FOR EACH ROW
    EXECUTE FUNCTION calculate_laundry_totals();
```

**Cleaning Order Improvements:**

Current: Hourly rate exists but not rounded to 30min blocks

```sql
-- Update cleaning_jobs time calculation
CREATE OR REPLACE FUNCTION calculate_cleaning_cost()
RETURNS TRIGGER AS $$
DECLARE
    v_duration_minutes INTEGER;
    v_blocks_30min INTEGER;
    v_rate_per_block DECIMAL(10,2);
    v_vat_rate DECIMAL(5,2);
BEGIN
    IF NEW.actual_end_time IS NOT NULL AND NEW.actual_start_time IS NOT NULL THEN
        -- Calculate duration in minutes
        v_duration_minutes := EXTRACT(EPOCH FROM (NEW.actual_end_time - NEW.actual_start_time)) / 60;

        -- Round up to nearest 30-minute block
        v_blocks_30min := CEIL(v_duration_minutes / 30.0);

        -- Get rate per 30min block from settings
        SELECT setting_value::DECIMAL INTO v_rate_per_block
        FROM system_settings WHERE setting_key = 'cleaning_rate_30min';

        -- Calculate subtotal
        NEW.total_duration_minutes := v_blocks_30min * 30;
        NEW.subtotal := v_blocks_30min * v_rate_per_block;

        -- Get VAT rate
        SELECT setting_value::DECIMAL INTO v_vat_rate
        FROM system_settings WHERE setting_key = 'vat_rate';

        -- Calculate VAT
        NEW.vat_rate := v_vat_rate;
        NEW.vat_amount := NEW.subtotal * (v_vat_rate / 100);

        -- Total with VAT
        NEW.total_cost := NEW.subtotal + NEW.vat_amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add VAT fields to cleaning_jobs
ALTER TABLE cleaning_jobs
ADD COLUMN subtotal DECIMAL(10,2),
ADD COLUMN vat_rate DECIMAL(5,2),
ADD COLUMN vat_amount DECIMAL(10,2);
```

---

### 3. **Simplified Invoice Generation** 🧾

**Requirements:**
- Simple invoice with line items
- Show subtotal, VAT, total
- Client info
- Order number
- Print/PDF view

**No external libraries needed - HTML/CSS print-friendly template**

```sql
-- Invoice table for tracking
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    order_type VARCHAR(20) NOT NULL, -- 'cleaning' or 'laundry'
    order_id INTEGER NOT NULL,
    client_id INTEGER REFERENCES clients(id),
    subtotal DECIMAL(10,2) NOT NULL,
    vat_rate DECIMAL(5,2) NOT NULL,
    vat_amount DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    issued_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    paid_date DATE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'overdue'
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 4. **Basic Reporting** 📊

**What you actually need (NOT complex analytics):**

Simple reports for Master/Admin:
- Daily revenue summary
- Monthly revenue summary
- Orders by status count
- Outstanding payments

**NO NEED FOR:**
- ❌ Worker performance metrics (3-person team, you know who does what)
- ❌ Service popularity analysis (limited services)
- ❌ Complex charts and graphs
- ❌ Worker location tracking
- ❌ Route optimization
- ❌ Automatic assignment algorithms

---

### 5. **What You DON'T Need** ❌

Based on your requirements, removing:

**❌ Inventory Management:**
- You said "stocks of cleaning products not necessary"
- Remove this completely

**❌ Worker Assignment & Routing:**
- 3-person team - manual assignment is fine
- No complex algorithms needed

**❌ Quality Control System:**
- Client feedback exists in orders (client_feedback field)
- No need for separate ratings table

**❌ Multi-Location Support:**
- Single location startup
- Not needed

**❌ Pickup Service:**
- You only do delivery, not pickup
- Remove pickup-related fields

---

## 🚀 Implementation Plan

### Phase 1: Core Business Logic (NOW)

1. **System Settings Management**
   - Settings table
   - Master settings page (VAT, delivery fee, cleaning rate)
   - Laundry services pricing table

2. **Enhanced Order Calculations**
   - VAT calculation on all orders
   - Delivery fee toggle for laundry
   - 30-minute rounding for cleaning
   - Auto-calculate triggers

3. **Service Selection in Orders**
   - Link laundry orders to services
   - Cleaning tier selection (cleaning only vs cleaning+laundry)
   - Price display based on selected service

4. **Simple Invoicing**
   - Generate invoice from order
   - Print-friendly invoice view
   - Invoice history

### Phase 2: Business Operations

5. **Order Status Improvements**
   - Better workflow tracking
   - Status history log
   - Worker assignment to laundry orders

6. **Basic Reports**
   - Daily/monthly revenue
   - Orders summary
   - Outstanding payments list

### Phase 3: Polish

7. **UI Improvements**
   - Better forms
   - Print views
   - Mobile responsive

8. **Client Portal Enhancements**
   - View invoices
   - View photos from cleaning jobs
   - Order history

---

## 🎯 Immediate Next Steps

I will now implement:

1. ✅ Create migration 003_pricing_and_settings.sql
   - system_settings table
   - laundry_services table
   - Update cleaning_jobs with VAT fields
   - Update laundry_orders_new with VAT and delivery fields
   - Calculation triggers

2. ✅ Create /api/settings routes (Master only)
   - GET /api/settings - Get all settings
   - PUT /api/settings/:key - Update setting

3. ✅ Create /api/services routes (Master/Admin)
   - GET /api/services - List laundry services
   - PUT /api/services/:id - Update service price

4. ✅ Update frontend Dashboard
   - Settings tab for Master
   - Service pricing management
   - Updated order forms with service selection
   - Delivery toggle for laundry

5. ✅ Test complete workflow:
   - Master adjusts VAT to 23%
   - Master sets delivery fee to €5
   - Admin updates Wash+Iron price to €4/kg
   - Create laundry order with delivery
   - Verify calculations: subtotal + delivery + VAT = total
   - Create cleaning job, track time, verify 30min rounding

---

## 📝 Business Process Documentation

### Laundry Workflow:
```
1. Client calls/visits → Admin creates order
2. Admin selects service (Wash+Iron, Dry Clean, or Iron Only)
3. Admin enters weight (kg) or item count
4. Admin checks "Delivery" if client wants delivery (+€5)
5. System calculates: (price × quantity) + delivery + 23% VAT
6. Worker processes laundry
7. Worker marks ready → Client notified
8. If delivery requested → Worker delivers
9. Mark as collected/delivered
10. Generate invoice
```

### Cleaning Workflow:
```
1. Client books → Master/Admin creates cleaning job
2. Select tier: Cleaning Only OR Cleaning + Laundry
3. Assign worker
4. Worker arrives → Clicks "Start"
5. Worker cleans (takes photos)
6. Worker clicks "End"
7. System calculates: time rounded to 30min blocks × rate + 23% VAT
8. If Cleaning+Laundry → Worker also does linens
9. Mark complete → Client sees photos
10. Generate invoice
```

---

**Ready to implement. Starting with database migration...**

# Architecture Documentation

**Last Updated:** 2025-10-23
**System Version:** Production (Post-Cutover)

## System Overview

Lavandaria is a dual-business management system serving two distinct service lines:

1. **Laundry Service** - Traditional clothing cleaning with order tracking and itemization
2. **Property Cleaning Service** - Airbnb/house cleaning with photo verification and time tracking

### Core Principles

- **Single Source of Truth**: PostgreSQL database with strict referential integrity
- **Role-Based Isolation**: Four-tier hierarchy (Master → Admin → Worker → Client)
- **Session-Based Authentication**: PostgreSQL-backed sessions for horizontal scalability
- **Photo Verification**: Multi-type photo upload with client viewing tracking
- **Split Financial Model**: Separate payment tables for referential integrity

---

## Role Hierarchy & Permissions

### Four-Tier Permission Model

```
┌─────────────────────────────────────────────┐
│ Master (Owner)                              │
│ • Full system access                        │
│ • Can create admins                         │
│ • Finance access                            │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ Admin (Manager)                             │
│ • Can create workers & clients              │
│ • Manage all orders                         │
│ • Finance access                            │
│ • Cannot create other admins                │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ Worker/Cleaner (Field Operations)           │
│ • View assigned jobs only                   │
│ • Upload photos to assigned jobs            │
│ • Track time for assigned jobs              │
│ • NO finance access                         │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│ Client (Customer)                           │
│ • View own orders (read-only)               │
│ • View photos for own jobs                  │
│ • Provide feedback/ratings                  │
└─────────────────────────────────────────────┘
```

### Access Control Enforcement

**Two-Level Enforcement:**

1. **Middleware Level** - Route-level permission checks
2. **Query Level** - Role-specific WHERE clauses

**Example (Worker Isolation):**
```sql
-- Workers only see assigned jobs
SELECT * FROM cleaning_jobs cj
JOIN cleaning_job_workers cjw ON cj.id = cjw.job_id
WHERE cjw.worker_id = $1;

-- Admins/Masters see all jobs
SELECT * FROM cleaning_jobs;
```

---

## Business Workflows

### Laundry Order Lifecycle

```
┌──────────┐     ┌─────────────┐     ┌───────┐     ┌───────────┐
│ received │────▶│ in_progress │────▶│ ready │────▶│ collected │
└──────────┘     └─────────────┘     └───────┘     └───────────┘
      │
      └──────────────────────────────────────────────┐
                                                     │
                                              ┌──────▼────┐
                                              │ cancelled │
                                              └───────────┘
```

**Status Definitions:**
- `received` - Order received from client
- `in_progress` - Being processed by worker
- `ready` - Ready for client pickup (notification sent)
- `collected` - Client picked up order
- `cancelled` - Order cancelled

**Order Types:**
- `bulk_kg` - Charged by weight (default: €3.50/kg)
- `itemized` - Individual item pricing via service catalog
- `house_bundle` - Fixed-price package

### Cleaning Job Lifecycle

```
┌───────────┐     ┌─────────────┐     ┌───────────┐
│ scheduled │────▶│ in_progress │────▶│ completed │
└───────────┘     └─────────────┘     └───────────┘
      │
      └───────────────────────────────┐
                                      │
                               ┌──────▼────┐
                               │ cancelled │
                               └───────────┘
```

**Status Definitions:**
- `scheduled` - Job scheduled with date/time
- `in_progress` - Worker on-site, time tracking active
- `completed` - Job finished, photos uploaded
- `cancelled` - Job cancelled

**Job Types:**
- `airbnb` - Short-term rental property cleaning
- `house` - Residential house cleaning

### Photo Verification Workflow

```
Worker Upload (10 photos/batch, unlimited total):
┌────────┐     ┌────────┐     ┌────────┐
│ before │     │ after  │     │ detail │
└────┬───┘     └────┬───┘     └────┬───┘
     │              │              │
     └──────────────┼──────────────┘
                    │
            ┌───────▼────────┐
            │ Photo Metadata │
            │ • room_area    │
            │ • caption      │
            │ • file_size_kb │
            └───────┬────────┘
                    │
            ┌───────▼────────┐
            │ Client Viewing │
            │ • viewed_by    │
            │ • viewed_at    │
            └────────────────┘
```

**Photo Upload Policy:**
- **Unlimited total photos** per job
- **Maximum 10 files per upload batch**
- **10MB per file** limit
- **Allowed types**: JPEG, JPG, PNG, GIF
- **RBAC**: Workers upload to assigned jobs only
- **Tracking**: Client viewing status recorded

---

## Data Model

### Database Schema Snapshot

**Generated:** 2025-10-23 via PostgreSQL-RO MCP

#### Core Identity Tables

**`users` - Staff Members**
```
Columns (22):
  id (PK, auto-increment)
  username (unique, required)
  password (bcrypt, required)
  role (CHECK: master|admin|worker)
  full_name, first_name, last_name
  email, phone
  date_of_birth, nif
  address_line1, address_line2, city, postal_code, district
  country (default: 'Portugal')
  created_at, updated_at, registration_date
  is_active (default: true)
  created_by (FK → users.id, self-referential)

Constraints:
  • role CHECK (master, admin, worker)
  • created_by FK → users.id (creator tracking)

Indexes:
  • idx_users_username (B-tree)
  • idx_users_role (B-tree)
```

**`clients` - Customers**
```
Columns (22):
  id (PK, auto-increment)
  phone (unique, required, authentication key)
  password (bcrypt, required)
  full_name, first_name, last_name
  email, date_of_birth, nif
  address_line1, address_line2, city, postal_code, district
  country (default: 'Portugal')
  notes, is_enterprise, company_name
  registration_date, created_at
  is_active (default: true)
  must_change_password (default: true)

Constraints:
  • phone UNIQUE (phone-based authentication)

Indexes:
  • idx_clients_phone (B-tree)
  • idx_clients_is_active (B-tree)
```

**`session` - Express Sessions**
```
Stores session data in PostgreSQL for:
  • Container restart persistence
  • Horizontal scaling (shared session store)
  • Admin debugging (SELECT * FROM session)
```

---

#### Cleaning Jobs Domain

**`cleaning_jobs` - Main Job Table**
```
Columns (35):
  id (PK, auto-increment)
  client_id (FK → clients.id, CASCADE)
  assigned_worker_id (FK → users.id, SET NULL)
  job_type (CHECK: airbnb|house)
  property_name, property_address
  address_line1, address_line2, city, postal_code, district
  country (default: 'Portugal')
  scheduled_date, scheduled_time
  estimated_hours, hourly_rate (default: 15.00)
  actual_start_time, actual_end_time, total_duration_minutes
  total_cost
  status (CHECK: scheduled|in_progress|completed|cancelled, default: scheduled)
  payment_status (CHECK: pending|paid|partial, default: pending)
  payment_method, paid_amount (default: 0)
  notes, special_instructions
  client_feedback, client_rating (CHECK: 1-5)
  created_by (FK → users.id)
  created_at, updated_at, completed_at
  push_notification_sent, client_viewed_photos, last_synced_at

Constraints:
  • job_type CHECK (airbnb, house)
  • status CHECK (scheduled, in_progress, completed, cancelled)
  • payment_status CHECK (pending, paid, partial)
  • client_rating CHECK (1-5)
  • client_id FK → clients.id ON DELETE CASCADE
  • assigned_worker_id FK → users.id ON DELETE SET NULL

Indexes:
  • idx_cleaning_jobs_client (client_id)
  • idx_cleaning_jobs_worker (assigned_worker_id)
  • idx_cleaning_jobs_status (status)
  • idx_cleaning_jobs_date (scheduled_date)
  • idx_cleaning_jobs_type (job_type)
```

**`cleaning_job_workers` - Worker Assignment Junction**
```
Purpose: Many-to-many relationship for multiple workers per job

Columns:
  id (PK)
  cleaning_job_id (FK → cleaning_jobs.id)
  worker_id (FK → users.id)
  assigned_at

Constraints:
  • FK → cleaning_jobs.id ON DELETE CASCADE
  • FK → users.id ON DELETE CASCADE
```

**`cleaning_job_photos` - Photo Verification**
```
Columns (13):
  id (PK, auto-increment)
  cleaning_job_id (FK → cleaning_jobs.id, CASCADE)
  worker_id (FK → users.id, CASCADE)
  photo_url (required, full-size path)
  photo_type (CHECK: before|after|detail, required)
  room_area (optional, e.g., 'Kitchen', 'Bathroom')
  thumbnail_url, file_size_kb, original_filename
  caption
  uploaded_at
  viewed_by_client (default: false)
  viewed_at

Constraints:
  • photo_type CHECK (before, after, detail)
  • cleaning_job_id FK → cleaning_jobs.id ON DELETE CASCADE
  • worker_id FK → users.id ON DELETE CASCADE

Indexes:
  • idx_photos_job (cleaning_job_id)
  • idx_photos_type (photo_type)
```

**`cleaning_time_logs` - Worker Time Tracking**
```
Columns:
  id (PK)
  cleaning_job_id (FK → cleaning_jobs.id)
  worker_id (FK → users.id)
  start_time, end_time, duration_minutes
  notes, is_manual_entry
  created_at

Purpose: Track actual worker hours for billing accuracy
```

---

#### Laundry Orders Domain

**`laundry_orders_new` - Main Order Table**
```
Columns (31):
  id (PK, auto-increment)
  client_id (FK → clients.id, CASCADE)
  assigned_worker_id (FK → users.id, SET NULL)
  order_number (unique, required, e.g., 'LDR-20251023-001')
  order_type (CHECK: bulk_kg|itemized|house_bundle)
  total_weight_kg, price_per_kg (default: 3.50)
  base_price, additional_charges (default: 0), discount (default: 0)
  total_price (required)
  status (CHECK: received|in_progress|ready|collected|cancelled, default: received)
  payment_status (CHECK: pending|paid|partial, default: pending)
  payment_method, paid_amount (default: 0)
  received_at, ready_at, collected_at, expected_ready_date
  ready_notification_sent (default: false)
  ready_notification_sent_at, client_notified_via
  special_instructions, internal_notes
  client_feedback, client_rating (CHECK: 1-5)
  created_by (FK → users.id)
  created_at, updated_at
  push_notification_sent, last_synced_at

Constraints:
  • order_number UNIQUE
  • order_type CHECK (bulk_kg, itemized, house_bundle)
  • status CHECK (received, in_progress, ready, collected, cancelled)
  • payment_status CHECK (pending, paid, partial)
  • client_rating CHECK (1-5)
  • client_id FK → clients.id ON DELETE CASCADE
  • assigned_worker_id FK → users.id ON DELETE SET NULL

Indexes:
  • idx_laundry_orders_client (client_id)
  • idx_laundry_orders_worker (assigned_worker_id)
  • idx_laundry_orders_status (status)
  • idx_laundry_orders_number (order_number)
```

**`laundry_order_items` - Itemized Line Items**
```
Columns:
  id (PK)
  laundry_order_id (FK → laundry_orders_new.id)
  service_id (FK → laundry_services.id)
  item_description, quantity, unit_price, total_price
  notes

Purpose: Itemized billing for 'itemized' order type
```

**`laundry_services` - Service Catalog**
```
Columns:
  id (PK)
  name (e.g., 'Wash & Fold', 'Dry Cleaning')
  description, category
  base_price, unit_type (kg, item, bundle)
  is_active

Purpose: 12 pre-configured laundry services
```

---

#### Financial Domain (Split for Integrity)

**`payments_cleaning` - Cleaning Job Payments**
```
Columns (8):
  id (PK, auto-increment)
  cleaning_job_id (FK → cleaning_jobs.id, CASCADE, required)
  client_id (FK → clients.id, CASCADE, required)
  amount (required)
  payment_method (CHECK: cash|card|transfer|mbway|other, required)
  payment_date (default: CURRENT_TIMESTAMP)
  notes
  created_at

Constraints:
  • cleaning_job_id FK → cleaning_jobs.id ON DELETE CASCADE
  • client_id FK → clients.id ON DELETE CASCADE
  • payment_method CHECK (cash, card, transfer, mbway, other)

Indexes:
  • idx_payments_cleaning_job (cleaning_job_id)
  • idx_payments_cleaning_client (client_id)
  • idx_payments_cleaning_date (payment_date)
```

**`payments_laundry` - Laundry Order Payments**
```
Columns (8):
  id (PK, auto-increment)
  laundry_order_id (FK → laundry_orders_new.id, CASCADE, required)
  client_id (FK → clients.id, CASCADE, required)
  amount (required)
  payment_method (CHECK: cash|card|transfer|mbway|other, required)
  payment_date (default: CURRENT_TIMESTAMP)
  notes
  created_at

Constraints:
  • laundry_order_id FK → laundry_orders_new.id ON DELETE CASCADE
  • client_id FK → clients.id ON DELETE CASCADE
  • payment_method CHECK (cash, card, transfer, mbway, other)

Indexes:
  • idx_payments_laundry_order (laundry_order_id)
  • idx_payments_laundry_client (client_id)
  • idx_payments_laundry_date (payment_date)
```

**Why Split Payment Tables?**

Original design used a single `payments` table with polymorphic foreign keys (job_id OR order_id). This violated referential integrity by allowing NULL FKs. Split tables maintain clean constraints:

```sql
-- ✅ Clean FK constraint
payments_cleaning.cleaning_job_id → cleaning_jobs.id (never NULL)
payments_laundry.laundry_order_id → laundry_orders_new.id (never NULL)

-- ❌ Old polymorphic FK (violated integrity)
-- payments.job_id → cleaning_jobs.id (NULL for laundry)
-- payments.order_id → laundry_orders_new.id (NULL for cleaning)
```

---

#### Supporting Tables

**`properties` - Client Addresses**
```
Purpose: Reusable property addresses for cleaning jobs
Links to clients for multi-property management
```

**`tickets` - Worker Issue Reporting**
```
Purpose: Workers report equipment issues, site problems
Status tracking: open → in_progress → resolved → closed
```

**`job_notifications` - Push Notifications**
```
Purpose: Track notification delivery for job updates
Supports: ready notifications, assignment alerts
```

---

## Key Architectural Patterns

### Referential Integrity Strategy

All foreign keys use explicit CASCADE or SET NULL policies:

```sql
-- Client deletion cascades to jobs/orders
client_id FK ON DELETE CASCADE

-- Worker deletion preserves historical data
assigned_worker_id FK ON DELETE SET NULL

-- Creator tracking allows NULL
created_by FK ON DELETE SET NULL
```

### Index Strategy

**Performance-Critical Indexes:**
- All foreign keys indexed (B-tree)
- Status fields indexed (high cardinality)
- Date fields indexed (range queries)
- Phone/username indexed (authentication)

### CHECK Constraints

**Data Integrity Enforcement:**
- Valid role types (master|admin|worker)
- Valid status transitions (per workflow)
- Valid rating ranges (1-5)
- Valid payment methods (Portuguese market)

---

## Technology-Agnostic Terminology

**Order Management:**
- Order lifecycle stages
- Status transitions
- Payment tracking
- Client notifications

**Photo Verification:**
- Before/after/detail categorization
- Room-based organization
- Client viewing tracking
- Multi-batch upload support

**Time Tracking:**
- Manual entry support
- Start/end timestamps
- Duration calculation
- Billing accuracy

**Access Control:**
- Role-based permissions
- Hierarchical authority
- Resource isolation
- Finance access restrictions

**Payment Processing:**
- Multiple payment methods
- Partial payment support
- Payment history tracking
- Financial reporting

---

## Migration History

**2025-10-08 Cutover:**
- Dropped legacy tables: `airbnb_orders`, `laundry_orders` (old), `payments` (polymorphic)
- Created new tables: `cleaning_jobs`, `laundry_orders_new`, `payments_cleaning`, `payments_laundry`
- Migration order dependencies: 000 → 002 → 001 → 003 → 004

**Backup Tables (Purge Date: 2025-11-08):**
- `backup_20251008_*` (6 tables)
- `final_backup_20251008_2145_*` (6 tables)
- Total: ~106 kB

---

## Future Considerations

**Potential Schema Evolution:**
- Multi-property support for clients
- Recurring job scheduling
- Service package definitions
- Multi-currency support
- Integration webhooks table
- Audit trail tables

**Performance Monitoring:**
- Query performance tracking
- Index usage analysis
- Slow query log review
- Connection pool optimization

---

**Document Maintenance:** This file should be updated when:
- Database schema changes
- New business workflows added
- Role permissions modified
- Major architectural decisions made

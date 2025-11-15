# Lavandaria - Project Structure Documentation

**Version:** 2.0 (Post-Simplification)
**Date:** 2025-11-09
**Purpose:** Complete reference guide for developers and testers

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Directory Structure](#directory-structure)
4. [Database Architecture](#database-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Frontend Architecture](#frontend-architecture)
7. [API Endpoints Reference](#api-endpoints-reference)
8. [Testing Infrastructure](#testing-infrastructure)
9. [Development Workflow](#development-workflow)
10. [Deployment](#deployment)

---

## Overview

**Lavandaria** is a dual-business management system serving:
1. **Laundry Service** - Clothing cleaning with order tracking
2. **Property Cleaning Service** - Airbnb/house cleaning with photo verification

### Key Features:
- Multi-role user management (Master → Admin → Worker → Client)
- Property-based cleaning job workflow
- Photo verification before/after cleaning
- Time tracking for accurate billing
- Unified payment system with flexible tax handling
- Session-based authentication
- Correlation ID tracking for all requests

---

## Technology Stack

### Backend:
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL 16
- **Authentication:** express-session + bcrypt
- **File Upload:** Multer
- **Security:** Helmet.js, CORS
- **Module System:** CommonJS (require/module.exports)

### Frontend:
- **Framework:** React 18.3.1
- **Styling:** Tailwind CSS
- **HTTP Client:** Axios
- **Build Tool:** Create React App
- **Module System:** ES6 (import/export)

### Infrastructure:
- **Containerization:** Docker + Docker Compose
- **Testing:** Playwright (E2E)
- **Version Control:** Git
- **Database Client:** pg (node-postgres)

### Development Tools:
- **Package Manager:** npm
- **Process Manager:** nodemon (dev), PM2 (prod)
- **API Testing:** curl, Postman
- **Database UI:** pgAdmin, psql CLI

---

## Directory Structure

```
/Applications/XAMPP/xamppfiles/htdocs/Lavandaria/
│
├── client/                          # React frontend
│   ├── public/                      # Static assets
│   │   ├── index.html              # HTML entry point
│   │   └── favicon.ico
│   ├── src/                         # Source code
│   │   ├── components/             # Reusable components
│   │   │   ├── forms/              # CRUD forms
│   │   │   │   ├── UserForm.js
│   │   │   │   ├── ClientForm.js
│   │   │   │   ├── PropertyForm.js       # NEW
│   │   │   │   ├── CleaningJobForm.js
│   │   │   │   └── LaundryOrderForm.js
│   │   │   ├── Modal.js            # Reusable modal
│   │   │   └── ...
│   │   ├── pages/                  # Page components
│   │   │   ├── Landing.js          # Login page
│   │   │   ├── Dashboard.js        # Main app (tabbed interface)
│   │   │   ├── ChangePassword.js   # Force password change
│   │   │   └── NotFound.js         # 404 page
│   │   ├── context/                # React Context
│   │   │   └── AuthContext.js      # Auth state management
│   │   ├── App.js                  # Main app component
│   │   ├── index.js                # React entry point
│   │   └── index.css               # Tailwind imports
│   ├── package.json                # Frontend dependencies
│   └── .env                        # Frontend env vars
│
├── routes/                          # Backend API routes
│   ├── auth.js                     # Login, logout, session check
│   ├── users.js                    # Staff CRUD (master/admin/worker)
│   ├── clients.js                  # Client CRUD
│   ├── properties.js               # Property CRUD (NEW)
│   ├── cleaning-jobs.js            # Cleaning jobs CRUD
│   ├── cleaning-photos.js          # Photo upload/viewing
│   ├── laundry-orders.js           # Laundry orders CRUD
│   ├── laundry-services.js         # Service catalog
│   ├── payments.js                 # Unified payments (NEW)
│   ├── tickets.js                  # Issue reporting
│   └── dashboard.js                # Dashboard stats
│
├── middleware/                      # Express middleware
│   ├── auth.js                     # Authentication & RBAC
│   ├── correlationId.js            # Request tracking
│   ├── rateLimit.js                # Login rate limiting
│   └── upload.js                   # Multer file upload config
│
├── database/                        # Database files
│   ├── SCHEMA-SIMPLIFIED-V2.sql    # Current schema (NEW)
│   ├── migrations/                 # Migration scripts
│   │   ├── migrate-to-v2.sql      # v1 → v2 migration (NEW)
│   │   └── rollback-v2.sql        # v2 → v1 rollback (NEW)
│   └── backups/                    # Database backups
│
├── uploads/                         # Uploaded files
│   └── photos/                     # Cleaning job photos
│
├── tests/                           # Test suites
│   ├── e2e/                        # End-to-end tests (Playwright)
│   │   ├── user-crud.spec.js
│   │   ├── client-crud.spec.js
│   │   ├── properties-crud.spec.js        # NEW
│   │   ├── cleaning-jobs-crud.spec.js
│   │   ├── payments.spec.js               # UPDATED (unified)
│   │   ├── worker-photo-upload.spec.js
│   │   ├── client-photo-viewing.spec.js
│   │   ├── rbac-and-sessions.spec.js
│   │   └── tab-navigation.spec.js
│   ├── unit/                       # Unit tests
│   │   └── migration-v2.test.js    # Migration validation (NEW)
│   ├── fixtures/                   # Test data
│   │   └── test-photo.jpg
│   └── helpers/                    # Test utilities
│       └── entity-builder.js       # Create test entities via API
│
├── handoff/                         # Documentation & work orders
│   ├── WO-20251109-DATABASE-SIMPLIFICATION.md  # Developer WO
│   ├── WO-20251109-DATABASE-TESTING.md         # Tester WO
│   ├── DATABASE-SCHEMA-DUMP-20251109.sql       # Old schema (reference)
│   ├── DATABASE-SCHEMA-READABLE.txt            # Human-readable schema
│   └── ...
│
├── docs/                            # Project documentation
│   ├── PROJECT-STRUCTURE.md        # This file
│   ├── architecture.md             # System architecture
│   ├── security.md                 # Security checklist
│   ├── progress.md                 # Development progress
│   ├── decisions.md                # Architectural decisions
│   └── bugs.md                     # Bug tracking
│
├── scripts/                         # Utility scripts
│   ├── preflight-health-check.sh   # Pre-test health check
│   ├── verify-vibe-check.sh        # MCP verification
│   └── ...
│
├── server.js                        # Express server entry point
├── db.js                            # PostgreSQL connection pool
├── package.json                     # Backend dependencies
├── docker-compose.yml               # Docker services config
├── Dockerfile                       # App container
├── .env                            # Backend environment variables
├── .dockerignore                   # Docker ignore rules
├── .gitignore                      # Git ignore rules
├── CLAUDE.md                       # Claude AI instructions
└── README.md                       # Project README

```

---

## Database Architecture

### Entity Relationship Overview

```
┌─────────────┐
│ role_types  │ (lookup: master, admin, worker)
└──────┬──────┘
       │
       │ role_id (FK)
       │
┌──────▼──────┐           ┌──────────────┐
│    users    │◄──────────┤ cleaning_    │
│  (staff)    │ worker_id │ job_workers  │
└──────┬──────┘           └──────────────┘
       │                         │
       │ created_by              │ cleaning_job_id
       │                         │
┌──────▼──────┐           ┌─────▼────────┐
│   clients   │           │ cleaning_    │
└──────┬──────┘           │    jobs      │
       │                  └──────┬───────┘
       │ client_id               │
       │                         │ property_id
       │                  ┌──────▼───────┐
┌──────▼──────┐           │  properties  │
│ properties  │◄──────────┤              │
│ (1:N)       │           └──────┬───────┘
└─────────────┘                  │
       │                         │ property_type_id
       │                  ┌──────▼──────────┐
       │                  │ property_types  │ (lookup: casa, apartamento, etc.)
       │                  └─────────────────┘
       │
       │
┌──────▼──────┐
│  payments   │ (unified table)
│             │
│ service_type: 'cleaning' | 'laundry'
│             │
│ FK: cleaning_job_id (if cleaning)
│     laundry_order_id (if laundry)
└─────────────┘
```

### Core Tables (Simplified Schema)

#### 1. **role_types** (Lookup)
- `id` - Primary key
- `role_name` - master, admin, worker
- `description`

#### 2. **property_types** (Lookup)
- `id` - Primary key
- `type_name` - casa, apartamento, quinta, escritorio, loja, outro
- `description`

#### 3. **users** (Staff)
- `id` - Primary key
- `username` - Unique login
- `password` - Bcrypt hashed
- `role_id` - FK to role_types
- `name` - Full name (single field)
- `email`, `phone`, `nif`
- `address_line1`, `address_line2`, `city`, `postal_code`, `district`
- `is_active`, `created_by`, `created_at`, `updated_at`

**Key Changes:**
- ✅ Single `name` field (was `first_name` + `last_name`)
- ✅ `role_id` FK to lookup table (was string `role`)
- ❌ No `country` field (Portugal-only)

#### 4. **clients** (Customers)
- `id` - Primary key
- `phone` - Unique login
- `password` - Bcrypt hashed
- `name` - Full name (single field)
- `email`, `nif`, `date_of_birth`
- `is_enterprise`, `company_name`
- `notes`, `is_active`, `must_change_password`
- `created_at`, `updated_at`, `created_by`

**Key Changes:**
- ✅ Single `name` field (was `first_name` + `last_name`)
- ❌ No address fields (moved to properties table)
- ❌ No `country` field

#### 5. **properties** (Client Addresses)
- `id` - Primary key
- `client_id` - FK to clients (CASCADE delete)
- `property_name` - Optional name (e.g., "Main House")
- `address_line1`, `address_line2`, `city`, `postal_code`, `district`
- `property_type_id` - FK to property_types
- `access_instructions` - Parking, keys, etc.
- `is_primary` - Boolean flag for primary property
- `created_at`, `updated_at`

**Workflow:**
1. Create client
2. Add properties to client (1:N relationship)
3. When creating cleaning job, select client → shows their properties

#### 6. **cleaning_jobs**
- `id` - Primary key
- `client_id` - FK to clients (CASCADE delete)
- `property_id` - FK to properties (RESTRICT delete) **NEW**
- `assigned_worker_id` - FK to users (SET NULL delete)
- `job_type` - airbnb | house
- `scheduled_date`, `scheduled_time`
- `estimated_hours`, `hourly_rate`
- `actual_start_time`, `actual_end_time`, `total_duration_minutes`, `total_cost`
- `status` - scheduled | in_progress | completed | cancelled
- `payment_status` - pending | paid | partial
- `notes`, `special_instructions`, `client_feedback`
- `client_viewed_photos`
- `created_by`, `created_at`, `updated_at`, `completed_at`

**Key Changes:**
- ✅ `property_id` FK (was direct address fields)
- ❌ No `address`, `address_line1`, `city` fields (use JOIN with properties)

#### 7. **cleaning_job_photos**
- `id` - Primary key
- `cleaning_job_id` - FK to cleaning_jobs (CASCADE delete)
- `worker_id` - FK to users (CASCADE delete)
- `photo_url`, `thumbnail_url`
- `photo_type` - before | after | detail
- `file_size_kb`, `original_filename`, `caption`, `room_area`
- `uploaded_at`, `viewed_by_client`, `viewed_at`

#### 8. **laundry_orders_new**
- `id` - Primary key
- `client_id` - FK to clients (CASCADE delete)
- `assigned_worker_id` - FK to users (SET NULL delete)
- `order_number` - Unique identifier
- `order_type` - bulk_kg | itemized | house_bundle
- `total_weight_kg`, `price_per_kg`, `base_price`
- `additional_charges`, `discount`, `total_price`
- `status` - received | in_progress | ready | collected | cancelled
- `payment_status` - pending | paid | partial
- Timestamps, notifications, feedback fields

#### 9. **payments** (Unified Table) **NEW**
- `id` - Primary key
- `client_id` - FK to clients (CASCADE delete)
- `service_type` - cleaning | laundry (CHECK constraint)
- `cleaning_job_id` - FK to cleaning_jobs (CASCADE delete, NULL if laundry)
- `laundry_order_id` - FK to laundry_orders_new (CASCADE delete, NULL if cleaning)
- `amount` - Total amount paid by client
- `payment_method` - cash | card | transfer | mbway | other
- `payment_date`
- **Tax Fields:**
  - `tax_percentage` - Default 23.00 (IVA Portugal), editable by master/admin
  - `tax_amount` - Auto-calculated by trigger
  - `amount_before_tax` - Auto-calculated by trigger
- `notes`, `created_by`, `created_at`
- **CHECK constraint:** Ensures only one service FK is set

**Key Changes:**
- ✅ Unified table (was `payments_cleaning` + `payments_laundry`)
- ✅ Flexible tax handling (master/admin can adjust %)
- ✅ Auto-calculated tax amounts via trigger

**Tax Calculation Formula:**
```sql
amount_before_tax = amount / (1 + (tax_percentage / 100))
tax_amount = amount - amount_before_tax
```

**Example:**
- Client pays: €123.00
- Tax: 23%
- Amount before tax: €100.00
- Tax amount: €23.00

---

## Backend Architecture

### Server Entry Point: `server.js`

```javascript
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const cors = require('cors');
const pool = require('./db');

const app = express();

// Middleware stack
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGINS, credentials: true }));
app.use(express.json());
app.use(correlationIdMiddleware);

// Session configuration (PostgreSQL-backed)
app.use(session({
  store: new PgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/properties', require('./routes/properties'));          // NEW
app.use('/api/cleaning-jobs', require('./routes/cleaning-jobs'));
app.use('/api/cleaning-photos', require('./routes/cleaning-photos'));
app.use('/api/laundry-orders', require('./routes/laundry-orders'));
app.use('/api/payments', require('./routes/payments'));              // NEW (unified)
// ... other routes

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('client/build'));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build/index.html'));
  });
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

### Middleware Stack

#### 1. **correlationId.js**
- Generates unique ID for each request
- Format: `req_<timestamp>_<random>`
- Attached to `req.correlationId`
- Included in all response `_meta` objects
- Used for log tracing

#### 2. **auth.js**
- `requireAuth` - Checks if user logged in
- `requireMaster` - Master-only access
- `requireFinanceAccess` - Master or Admin only
- `requireWorker` - Worker or above
- Role-based access control (RBAC)

#### 3. **rateLimit.js**
- Login endpoint: 5 attempts per 15 minutes per IP
- Returns 429 status with `retryAfter` seconds

#### 4. **upload.js** (Multer)
- File size limit: 10MB per file
- Allowed types: JPEG, JPG, PNG, GIF
- Storage: `uploads/photos/`
- Filename: `<timestamp>-<originalname>`

### API Response Envelope

All API responses follow this standard:

```json
{
  "success": true,
  "data": {
    "user": { ... }
  },
  "_meta": {
    "timestamp": "2025-11-09T12:34:56.789Z",
    "correlationId": "req_1731153296789_abc123"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "User not found",
  "_meta": {
    "timestamp": "2025-11-09T12:34:56.789Z",
    "correlationId": "req_1731153296789_abc123"
  }
}
```

### Database Connection: `db.js`

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'lavandaria',
  user: process.env.DB_USER || 'lavandaria',
  password: process.env.DB_PASSWORD || 'lavandaria2025',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

module.exports = pool;
```

---

## Frontend Architecture

### React App Structure

```
client/src/
├── App.js                  # Main app with routing
├── index.js                # React entry point
├── context/
│   └── AuthContext.js      # Global auth state
├── pages/
│   ├── Landing.js          # Login page
│   └── Dashboard.js        # Tabbed interface
└── components/
    ├── Modal.js            # Reusable modal
    └── forms/              # CRUD forms
```

### AuthContext: `context/AuthContext.js`

Provides global authentication state:

```javascript
const { user, login, logout, checkSession } = useAuth();

// user object structure:
{
  id: 1,
  username: "master",
  name: "Master Admin",
  role: "master",
  email: "master@lavandaria.com"
}
```

**Methods:**
- `login(credentials, isClient)` - Login user/client
- `logout()` - Logout and clear session
- `checkSession()` - Verify session still valid

### Dashboard Tabs

```javascript
const tabs = [
  { id: 'my-jobs', label: 'My Jobs', roles: ['worker'] },
  { id: 'cleaning-jobs', label: 'Cleaning Jobs', roles: ['admin', 'master'] },
  { id: 'laundry-orders', label: 'Laundry Orders', roles: ['admin', 'master'] },
  { id: 'clients', label: 'Clients', roles: ['admin', 'master'] },
  { id: 'properties', label: 'Properties', roles: ['admin', 'master'] },  // NEW
  { id: 'users', label: 'Staff', roles: ['admin', 'master'] },
  { id: 'payments', label: 'Payments', roles: ['admin', 'master'] }
];
```

### Form Pattern

All CRUD forms follow this pattern:

```jsx
const SomeForm = ({ onSuccess, onCancel, editItem = null, optionsList = [] }) => {
  const [formData, setFormData] = useState({ ... });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = editItem ? `/api/resource/${editItem.id}` : '/api/resource';
      const method = editItem ? 'put' : 'post';

      const response = await axios[method](endpoint, formData);

      if (response.data.success) {
        console.log('✅ Correlation ID:', response.data._meta.correlationId);
        onSuccess(response.data.data);
      }
    } catch (err) {
      const correlationId = err.response?.data?._meta?.correlationId || 'unknown';
      setError(`Error: ${err.response?.data?.error || err.message} (${correlationId})`);
    } finally {
      setLoading(false);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
};
```

### Axios Configuration

```javascript
import axios from 'axios';

axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
axios.defaults.withCredentials = true; // Important for cookies!
```

---

## API Endpoints Reference

### Authentication: `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/login` | None | Login user/client |
| POST | `/logout` | Required | Logout current user |
| GET | `/session` | Required | Check session validity |
| POST | `/change-password` | Required | Change password |

### Users (Staff): `/api/users`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Master/Admin | List all users |
| GET | `/:id` | Master/Admin | Get user by ID |
| POST | `/` | Master/Admin | Create new user |
| PUT | `/:id` | Master/Admin | Update user |
| DELETE | `/:id` | Master | Delete user |

**Request Body (Create/Update):**
```json
{
  "username": "testworker",
  "password": "test123",
  "role": "worker",
  "name": "Test Worker",
  "email": "test@lavandaria.com"
}
```

### Clients: `/api/clients`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Master/Admin | List all clients |
| GET | `/:id` | Master/Admin | Get client by ID |
| POST | `/` | Master/Admin | Create new client |
| PUT | `/:id` | Master/Admin | Update client |
| DELETE | `/:id` | Master | Delete client |

**Request Body:**
```json
{
  "phone": "912345678",
  "password": "client123",
  "name": "Test Client",
  "email": "test@example.com"
}
```

### Properties: `/api/properties` **NEW**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Master/Admin | List all properties |
| GET | `/client/:clientId` | Master/Admin | Get properties for specific client |
| GET | `/:id` | Master/Admin | Get property by ID |
| POST | `/` | Master/Admin | Create new property |
| PUT | `/:id` | Master/Admin | Update property |
| DELETE | `/:id` | Master/Admin | Delete property (fails if jobs exist) |

**Request Body:**
```json
{
  "client_id": 1,
  "property_name": "Main House",
  "address_line1": "Rua Test, 123",
  "city": "Lisboa",
  "postal_code": "1100-123",
  "property_type_id": 1,
  "is_primary": true
}
```

### Cleaning Jobs: `/api/cleaning-jobs`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Master/Admin/Worker | List jobs (filtered by role) |
| GET | `/:id` | Master/Admin/Worker | Get job by ID |
| GET | `/:id/full` | Master/Admin/Worker | Get job with property details |
| POST | `/` | Master/Admin | Create new job |
| PUT | `/:id` | Master/Admin | Update job |
| DELETE | `/:id` | Master | Delete job |

**Request Body:**
```json
{
  "client_id": 1,
  "property_id": 1,
  "job_type": "house",
  "scheduled_date": "2025-12-01",
  "scheduled_time": "10:00",
  "assigned_worker_id": 3,
  "estimated_hours": 3
}
```

### Payments: `/api/payments` **NEW (Unified)**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Master/Admin | List all payments |
| GET | `/stats` | Master/Admin | Payment statistics |
| POST | `/` | Master/Admin | Create payment (cleaning or laundry) |
| PUT | `/:id` | Master/Admin | Update payment (adjust tax) |

**Request Body (Cleaning Payment):**
```json
{
  "client_id": 1,
  "service_type": "cleaning",
  "cleaning_job_id": 1,
  "amount": 123.00,
  "payment_method": "cash",
  "tax_percentage": 23.00
}
```

**Request Body (Laundry Payment):**
```json
{
  "client_id": 1,
  "service_type": "laundry",
  "laundry_order_id": 1,
  "amount": 50.00,
  "payment_method": "card",
  "tax_percentage": 23.00
}
```

---

## Testing Infrastructure

### E2E Tests (Playwright)

**Location:** `tests/e2e/`

**Run Commands:**
```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run in UI mode (debug)
npm run test:e2e:ui

# View HTML report
npm run test:e2e:report
```

**Test Helper Functions:**

```javascript
// Login via UI
async function loginViaUI(page, username, password) {
  await page.goto('/');
  await page.click('button:has-text("Staff")');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

// Create entity via API
async function createClientAPI(name, phone) {
  const response = await axios.post('/api/clients', {
    name, phone, password: 'test123'
  });
  return response.data.data.client;
}
```

### Test Fixtures

**Location:** `tests/fixtures/`

- `test-photo.jpg` - Sample photo for upload tests
- Generated photos for multi-batch tests

### Seed Data

**Command:**
```bash
npm run test:seed
```

**Creates:**
- Master user (master / master123)
- Admin user (admin / admin123)
- Worker user (worker1 / worker123)
- Client (911111111 / client123)

---

## Development Workflow

### 1. Setup Development Environment

```bash
# Clone repository
git clone https://github.com/YourRepo/Lavandaria.git
cd Lavandaria

# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..

# Copy environment files
cp .env.example .env
cp client/.env.example client/.env

# Start Docker services
npm run docker:up

# Run migrations
npm run db:migrate

# Seed development data
npm run test:seed
```

### 2. Run Development Servers

```bash
# Terminal 1: Backend (with nodemon)
npm run server

# Terminal 2: Frontend (React dev server)
npm run client

# Or run both concurrently
npm run dev
```

**Access:**
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- Database: localhost:5432

### 3. Make Code Changes

**Backend Route Example:**
```javascript
// routes/example.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const correlationId = req.correlationId;

  try {
    const result = await pool.query('SELECT * FROM table');

    res.json({
      success: true,
      data: { items: result.rows },
      _meta: {
        timestamp: new Date().toISOString(),
        correlationId
      }
    });
  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch items',
      _meta: { correlationId, timestamp: new Date().toISOString() }
    });
  }
});

module.exports = router;
```

**Frontend Component Example:**
```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ExampleComponent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await axios.get('/api/example');
      setItems(response.data.data.items);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return <div>...</div>;
}
```

### 4. Testing

```bash
# Run E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/user-crud.spec.js

# Debug test
npx playwright test --debug
```

### 5. Commit Changes

```bash
# Stage changes
git add .

# Commit (will trigger hooks if configured)
git commit -m "feat: add property cascade to cleaning jobs"

# Push to remote
git push origin feature-branch
```

---

## Deployment

### Production Build

```bash
# Build React frontend
cd client
npm run build
cd ..

# Build Docker image
docker build -t lavandaria:latest .

# Start production stack
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables

**Backend (`.env`):**
```env
NODE_ENV=production
PORT=3000
DB_HOST=lavandaria-db
DB_PORT=5432
DB_NAME=lavandaria
DB_USER=lavandaria
DB_PASSWORD=<secure-password>
SESSION_SECRET=<secure-secret>
CORS_ORIGINS=https://yourdomain.com
```

**Frontend (`client/.env`):**
```env
REACT_APP_API_URL=https://api.yourdomain.com
```

### Database Backup

```bash
# Create backup
docker exec lavandaria-db pg_dump -U lavandaria lavandaria > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker exec -i lavandaria-db psql -U lavandaria lavandaria < backup_20251109_120000.sql
```

---

## Quick Reference

### Common Tasks

**Create new user:**
```bash
curl -c cookies.txt -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123","role":"worker","name":"Test User"}'
```

**Create property:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/properties \
  -H "Content-Type: application/json" \
  -d '{"client_id":1,"property_name":"Test","address_line1":"Rua Test","city":"Lisboa","property_type_id":1}'
```

**Create cleaning job:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/cleaning-jobs \
  -H "Content-Type: application/json" \
  -d '{"client_id":1,"property_id":1,"job_type":"house","scheduled_date":"2025-12-01","scheduled_time":"10:00"}'
```

**View database schema:**
```bash
docker exec -it lavandaria-db psql -U lavandaria lavandaria -c "\d+ users"
```

**Check logs:**
```bash
# Backend logs
docker-compose logs -f app

# Database logs
docker-compose logs -f db

# All logs
docker-compose logs -f
```

---

## Support & Resources

**Documentation:**
- [Architecture](architecture.md)
- [Security](security.md)
- [API Reference](API-REFERENCE.md) (if exists)

**Work Orders:**
- [WO-20251109-DATABASE-SIMPLIFICATION.md](../handoff/WO-20251109-DATABASE-SIMPLIFICATION.md) - Developer implementation
- [WO-20251109-DATABASE-TESTING.md](../handoff/WO-20251109-DATABASE-TESTING.md) - Tester validation

**External Links:**
- [Express.js Docs](https://expressjs.com/)
- [React Docs](https://react.dev/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Playwright Docs](https://playwright.dev/)

---

**Last Updated:** 2025-11-09
**Version:** 2.0 (Post-Simplification)
**Maintained By:** Development Team

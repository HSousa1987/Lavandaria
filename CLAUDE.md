# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lavandaria** is a dual-business management system for:
1. **Laundry Service** - Traditional clothing cleaning with order tracking and itemization
2. **Airbnb/House Cleaning Service** - Property cleaning with photo verification and time tracking

The system serves four user roles with strict hierarchical permissions:
- **Master** (Owner - full system access, can create admins)
- **Admin** (can create workers, manage clients/orders, finance access)
- **Worker/Cleaner** (field operations, photo uploads, time tracking, NO finance access)
- **Client** (view own orders, read-only)

## Tech Stack

- **Backend**: Node.js 18+ with Express.js 4.18 (CommonJS)
- **Frontend**: React 19 + React Router 7 + Tailwind CSS 3 (ES6 modules)
- **Database**: PostgreSQL 16 (single source of truth)
- **Deployment**: Docker + Docker Compose (Alpine Linux)
- **Authentication**: Session-based (express-session with PostgreSQL store)
- **API Documentation**: OpenAPI 3.0 (Swagger UI at `/api/docs`)
- **File Uploads**: Multer (10MB limit for images)

## Critical Architecture Patterns

### Request Lifecycle & Middleware Stack

All requests flow through this **exact middleware order** in [server.js](server.js):

```
1. Helmet.js (Security Headers)
   ├─ CSP, HSTS (1 year for production), Referrer Policy

2. Morgan (Request Logging)
   └─ Logs method, URL, status, response time

3. CORS (Cross-Origin)
   ├─ Whitelist approach (process.env.CORS_ORIGINS)
   ├─ Credentials enabled (cookies)
   └─ X-Correlation-Id header exposed

4. JSON/URL-encoded Parsers

5. Correlation ID Middleware (middleware/rateLimiter.js)
   └─ Adds req.correlationId to every request

6. Session Middleware
   ├─ PostgreSQL store (connect-pg-simple)
   ├─ 30-day cookies (configurable via maxAge)
   └─ HTTP-only + SameSite=lax

7. Route-Specific Permission Middleware (middleware/permissions.js)
   ├─ requireAuth - any logged-in user
   ├─ requireMaster - master only
   ├─ requireMasterOrAdmin - master or admin
   ├─ requireStaff - master/admin/worker
   ├─ requireFinanceAccess - master/admin (blocks workers)
   └─ canManageUsers(targetRole) - context-aware factory
```

**Key Pattern**: Correlation IDs trace requests through logs and are included in all error responses. Check logs with correlation ID to debug issues.

### Authentication Flow

**Two separate login endpoints** with different strategies:

```
Staff Login:              Client Login:
POST /api/auth/login/user    POST /api/auth/login/client
└─ Username + Password       └─ Phone + Password
   ├─ Rate Limited (5/15min)    ├─ Rate Limited (5/15min)
   ├─ Bcrypt verification       ├─ Bcrypt verification
   └─ Session: userType,        └─ Session: userType='client',
      userId, username              userId, phone, mustChangePassword
```

**Frontend Integration** ([src/context/AuthContext.js](client/src/context/AuthContext.js)):

```
App Load
  ↓
GET /api/auth/check (with credentials)
  ↓
AuthContext sets user state
  ↓
ProtectedRoute enforces role-based routing
  ↓
axios.defaults.withCredentials = true (all subsequent requests include cookies)
```

**Session Persistence**:
- Sessions stored in PostgreSQL `session` table (survive container restarts)
- Enables horizontal scaling (shared session store)
- Admin can query sessions directly for debugging: `SELECT * FROM session;`

### Database Schema & Migration Strategy

**16 Active Tables** (after 2025-10-08 cutover):

**Core Identity:**
- `users` - Staff with auto-generated usernames
- `clients` - Customers (phone-based auth)
- `session` - Express sessions

**Cleaning Jobs** (NEW system):
- `cleaning_jobs` - Main table (estimated_hours, district, country, payment tracking)
- `cleaning_job_workers` - Junction for multiple workers per job
- `cleaning_job_photos` - Before/after/detail photos with uploader tracking
- `cleaning_time_logs` - Worker time tracking (manual entry support)

**Laundry Orders** (NEW system):
- `laundry_orders_new` - Orders with worker assignment
- `laundry_order_items` - Itemized line items
- `laundry_services` - Service catalog (12 pre-configured)

**Financial** (Split for FK integrity):
- `payments_cleaning` - FK to cleaning_jobs.id
- `payments_laundry` - FK to laundry_orders_new.id

**Other:**
- `tickets` - Worker issue reporting
- `properties` - Client addresses
- `job_notifications` - Push notifications

**Migration Execution Order** (CRITICAL - has dependencies):

```bash
# database/migrations_archive/ run in deploy.sh in THIS specific order:
000_add_user_client_fields.sql         # Adds first_name, last_name, date_of_birth, nif, address
002_create_jobs_system.sql              # Creates new cleaning_jobs, drops legacy airbnb_orders
001_standardize_address_fields.sql      # Depends on 002! Adds address_line1, city, postal_code, district, country
003_pricing_and_settings.sql            # Creates laundry_services, inserts 12 default services
004_split_payments_tables.sql           # Splits single payments table into payments_cleaning & payments_laundry
```

**Why special order?** Migration 001 standardizes addresses across tables created in 002. Running sequentially (000→001→002→003) would fail.

**Backup Tables** (30-day retention, purge 2025-11-08):
- `backup_20251008_*` (6 tables)
- `final_backup_20251008_2145_*` (6 tables)
- Total: ~106 kB

**Dropped Legacy Tables** (2025-10-08):
- ~~`laundry_orders`~~ → `laundry_orders_new`
- ~~`airbnb_orders`~~ → `cleaning_jobs`
- ~~`payments`~~ → `payments_cleaning` + `payments_laundry`

**Why split payment tables?** Single polymorphic FK (job_id OR order_id) violated referential integrity. Two tables maintain clean foreign key constraints.

### Role-Based Access Control (RBAC)

**Four-layer hierarchy** enforced at **two levels**:

1. **Middleware Level** ([middleware/permissions.js](middleware/permissions.js)):
   ```javascript
   requireFinanceAccess(req, res, next)
   // Blocks workers from payments/dashboard routes
   ```

2. **Query Level** (role-specific WHERE clauses):
   ```javascript
   if (req.session.userType === 'worker') {
     query = 'SELECT * FROM cleaning_jobs cj ' +
             'JOIN cleaning_job_workers cjw ON cj.id = cjw.job_id ' +
             'WHERE cjw.worker_id = $1';
     params = [req.session.userId];
   } else {
     query = 'SELECT * FROM cleaning_jobs';
     params = [];
   }
   ```

**Permission Matrix**:

| Action | Master | Admin | Worker | Client |
|--------|--------|-------|--------|--------|
| Create Admin Users | ✅ | ❌ | ❌ | ❌ |
| Create Workers | ✅ | ✅ | ❌ | ❌ |
| Manage Clients | ✅ | ✅ | ❌ | ❌ |
| View All Orders | ✅ | ✅ | ❌ | ❌ |
| View Assigned Orders | ✅ | ✅ | ✅ | ❌ |
| Finance Access | ✅ | ✅ | ❌ | ❌ |
| Upload Photos | ✅ | ✅ | ✅ | ❌ |
| Create Tickets | ✅ | ✅ | ✅ | ❌ |

### Response Envelope Pattern

**All API responses** use standardized helpers from [middleware/validation.js](middleware/validation.js):

```javascript
// List endpoints
listResponse(res, items, { total, limit, offset }, req)
// → { success: true, data: [...], _meta: { correlationId, timestamp, total, limit, offset, count } }

// Success
successResponse(res, { user }, 200, req)
// → { success: true, user: {...}, _meta: { correlationId, timestamp } }

// Errors
errorResponse(res, 404, 'Not found', 'RESOURCE_NOT_FOUND', req)
// → { error: "Not found", code: "RESOURCE_NOT_FOUND", _meta: { correlationId, timestamp } }

// Validation errors
handleValidationErrors(req, res, next)
// → { error: "Validation failed", code: "VALIDATION_ERROR", details: [...], _meta: {...} }
```

**Pattern to replicate** when adding new endpoints:

```javascript
const { listResponse, validatePagination, errorResponse } = require('../middleware/validation');
const { requireMasterOrAdmin } = require('../middleware/permissions');

router.get('/', requireMasterOrAdmin, async (req, res) => {
  try {
    const { limit, offset } = validatePagination(req);

    // Build role-filtered query
    let query = 'SELECT * FROM table';
    let params = [];

    if (req.session.userType === 'worker') {
      query += ' WHERE assigned_to = $1';
      params.push(req.session.userId);
    }

    // Parallel queries for performance
    const [result, countResult] = await Promise.all([
      pool.query(query + ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]),
      pool.query('SELECT COUNT(*) FROM table' + (params.length ? ' WHERE assigned_to = $1' : ''),
        params.length ? [req.session.userId] : [])
    ]);

    return listResponse(res, result.rows, {
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    }, req);
  } catch (error) {
    console.error(`❌ [ERROR] Failed to fetch:`, error);
    return errorResponse(res, 500, 'Server error', 'SERVER_ERROR', req);
  }
});
```

### File Upload Pattern (Photo Upload Policy)

**CRITICAL PHOTO UPLOAD POLICY:**
- **Unlimited total photos** per cleaning job
- **Maximum 10 files per upload batch** (enforced by multer and validation)
- Workers may perform **multiple uploads** to reach any total (e.g., 10, 50, 100+)
- Each file limited to **10MB**
- Allowed types: **JPEG, JPG, PNG, GIF**
- Workers can **only upload to assigned jobs** (RBAC enforced)
- Clients can **view all photos** for their own jobs with pagination support

Photos stored in `uploads/cleaning_photos/` via multer:

```javascript
// routes/cleaning-jobs.js - Batch upload endpoint
const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/cleaning_photos/',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'cleaning-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Upload endpoint - accepts up to 10 files per request
router.post('/:id/photos', requireStaff, upload.array('photos', 10), async (req, res) => {
  // Validate batch size
  if (!req.files || req.files.length === 0) {
    return errorResponse(res, 400, 'No photos uploaded', 'NO_FILES', req);
  }

  if (req.files.length > 10) {
    return errorResponse(res, 400, 'Maximum 10 photos per upload batch', 'BATCH_LIMIT_EXCEEDED', req);
  }

  // Verify worker is assigned to job
  const job = await pool.query('SELECT * FROM cleaning_jobs WHERE id = $1', [req.params.id]);
  if (req.session.userType === 'worker' && job.rows[0].assigned_worker_id !== req.session.userId) {
    return errorResponse(res, 403, 'You can only upload photos to your assigned jobs', 'NOT_ASSIGNED', req);
  }

  // Insert all photos
  const uploadedPhotos = [];
  for (const file of req.files) {
    const result = await pool.query(
      `INSERT INTO cleaning_job_photos (cleaning_job_id, worker_id, photo_url, ...)
       VALUES ($1, $2, $3, ...) RETURNING *`,
      [req.params.id, req.session.userId, '/uploads/cleaning_photos/' + file.filename, ...]
    );
    uploadedPhotos.push(result.rows[0]);
  }

  return successResponse(res, {
    photos: uploadedPhotos,
    count: uploadedPhotos.length,
    message: `Successfully uploaded ${uploadedPhotos.length} photo(s)`
  }, 201, req);
});
```

**Client Photo Viewing with Pagination:**

```javascript
// GET /api/cleaning-jobs/:id - Returns job with photos (paginated for large sets)
// Query params: photoLimit (default 100), photoOffset (default 0)

router.get('/:id', requireAuth, async (req, res) => {
  // RBAC check
  if (req.session.userType === 'client' && job.client_id !== req.session.clientId) {
    return errorResponse(res, 403, 'You can only view your own jobs', 'NOT_YOUR_JOB', req);
  }

  // Get photos with pagination
  const photoLimit = parseInt(req.query.photoLimit) || 100;
  const photoOffset = parseInt(req.query.photoOffset) || 0;

  const [photos, photoCount] = await Promise.all([
    pool.query(`SELECT * FROM cleaning_job_photos WHERE cleaning_job_id = $1
                ORDER BY uploaded_at DESC LIMIT $2 OFFSET $3`,
               [jobId, photoLimit, photoOffset]),
    pool.query(`SELECT COUNT(*) FROM cleaning_job_photos WHERE cleaning_job_id = $1`, [jobId])
  ]);

  return successResponse(res, {
    job: job,
    photos: photos.rows,
    photosPagination: {
      total: parseInt(photoCount.rows[0].count),
      limit: photoLimit,
      offset: photoOffset,
      hasMore: (photoOffset + photoLimit) < parseInt(photoCount.rows[0].count)
    }
  }, 200, req);
});
```

**Expected Error Behaviors:**

| Scenario | Status Code | Error Code | Message |
|----------|-------------|------------|---------|
| No files uploaded | 400 | `NO_FILES` | "No photos uploaded" |
| More than 10 files in batch | 400 | `BATCH_LIMIT_EXCEEDED` | "Maximum 10 photos per upload batch" |
| Invalid file type | 400 | N/A | "Only image files are allowed" |
| File exceeds 10MB | 413 | N/A | Multer error |
| Worker uploads to unassigned job | 403 | `NOT_ASSIGNED` | "You can only upload photos to your assigned jobs" |
| Client views another client's job | 403 | `NOT_YOUR_JOB` | "You can only view your own jobs" |
| Job not found | 404 | `JOB_NOT_FOUND` | "Job not found" |

## One-Command Deployment

**CRITICAL**: Always use [deploy.sh](deploy.sh) for deployment - handles complex orchestration:

```bash
./deploy.sh
```

**What it does** (50 seconds total):

1. **Pre-flight Checks**
   - Docker installed and running
   - Docker Compose available (v1 or v2)
   - Creates `uploads/`, `logs/` directories

2. **Configuration**
   - Creates `.env` from `.env.example` if missing
   - Generates secure SESSION_SECRET (32-byte hex)
   - Validates SESSION_SECRET strength (min 32 chars, exits if weak)

3. **Container Lifecycle**
   - Stops existing containers with `docker-compose down -v` (removes volumes)
   - Rebuilds with `--no-cache`
   - Starts db + app with health checks

4. **Database Initialization**
   - Waits for `pg_isready`
   - Runs migrations in order: 000 → 002 → 001 → 003
   - Verifies required tables exist

5. **Application Readiness**
   - Polls `/api/healthz` (liveness)
   - Checks `/api/readyz` (readiness + DB latency)
   - Monitors Docker healthchecks

6. **Post-deployment**
   - Displays URLs, credentials, useful commands

**Environment Variables** (critical):

```env
# Required (exits on missing)
SESSION_SECRET=<32+ char hex string>  # Auto-generated if missing
DB_HOST=db
DB_USER=lavandaria
DB_PASSWORD=lavandaria2025
DB_NAME=lavandaria

# Optional (with defaults)
NODE_ENV=production
PORT=3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Common Development Workflows

### Available NPM Scripts

**Root-level commands:**
```bash
npm run dev              # Concurrently run server + client (recommended for dev)
npm run server           # Backend only (nodemon auto-reload)
npm run client           # Frontend only (port 3001)
npm run build            # Build React production bundle to client/build/
npm start                # Production server (serves built React app)

# Docker shortcuts
npm run docker:build     # docker-compose build
npm run docker:up        # docker-compose up -d
npm run docker:down      # docker-compose down
npm run docker:logs      # docker-compose logs -f
```

**Client-specific commands:**
```bash
cd client
npm start                # Start development server (port 3001)
npm run build            # Production build
npm test                 # Run Jest tests with React Testing Library
```

### Full Stack Development

```bash
# Option 1: Concurrently (recommended)
npm install              # Install root dependencies
cd client && npm install # Install client dependencies
npm run dev              # Runs server + client
# Backend: http://localhost:3000 (nodemon auto-reload)
# Frontend: http://localhost:3001 (proxies API to :3000)

# Option 2: Separate terminals
docker-compose up -d db          # Terminal 1: Database only
npm run server                    # Terminal 2: Backend (nodemon)
cd client && npm start            # Terminal 3: Frontend (port 3001)
```

### Database Operations

```bash
# Connect to container
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria

# Query
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT * FROM users;"

# Backup
docker exec lavandaria-db pg_dump -U lavandaria lavandaria > backup.sql

# Restore
cat backup.sql | docker exec -i lavandaria-db psql -U lavandaria lavandaria

# View active sessions (debugging)
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT * FROM session;"

# Check database size
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT pg_size_pretty(pg_database_size('lavandaria'));"

# List all tables with row counts
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c "
  SELECT schemaname, tablename,
         pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
         n_live_tup AS rows
  FROM pg_stat_user_tables
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

### Debugging with Correlation IDs

```bash
# View logs with correlation ID tracing
docker-compose logs -f app | grep "req_1729..."

# Test endpoint with custom correlation ID
curl -X POST http://localhost:3000/api/auth/login/user \
  -H "Content-Type: application/json" \
  -H "X-Correlation-Id: test-login-123" \
  -d '{"username":"master","password":"master123"}' \
  -c cookies.txt

# Use cookie in subsequent requests
curl http://localhost:3000/api/users \
  -b cookies.txt \
  -H "X-Correlation-Id: test-users-456"

# Response includes correlation ID in _meta
jq '._meta.correlationId' response.json
```

### Testing Login & Rate Limiting

```bash
# Login and save cookies
curl -X POST http://localhost:3000/api/auth/login/user \
  -H "Content-Type: application/json" \
  -d '{"username":"master","password":"master123"}' \
  -c cookies.txt

# Test rate limiter (5 attempts per 15 minutes)
for i in {1..6}; do
  echo "=== Attempt $i ==="
  curl -X POST http://localhost:3000/api/auth/login/user \
    -H "Content-Type: application/json" \
    -d '{"username":"wrong","password":"wrong"}' \
    -i | grep -E "^HTTP/|RATE_LIMIT_EXCEEDED"
done
# 6th attempt returns 429 with retryAfter: 900
```

### Testing & Quality Assurance

**End-to-End Testing with Playwright:**

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Seed test data (creates master, admin, worker1, client with known credentials)
npm run test:seed

# Run E2E tests (headless, terminal-first)
npm run test:e2e

# Run with visible browser (debugging)
npm run test:e2e:headed

# Open Playwright UI mode (replay traces, inspect)
npm run test:e2e:ui

# View HTML report
npm run test:e2e:report

# Full test workflow (seed + run tests)
npm run test:prepare
```

**Playwright Test Execution Order (REQUIRED):**

1. **Terminal-first**: Run `npm run test:e2e` headless, collect artifacts (screenshots, traces, HTML report)
2. **Browser second**: Run `npm run test:e2e:ui` to replay failing traces and confirm fixes

**Test Credentials** (created by seed script):
- Master: `master` / `master123`
- Admin: `admin` / `admin123`
- Worker: `worker1` / `worker123`
- Client: `911111111` / `lavandaria2025`

**E2E Test Coverage:**

| Test Suite | File | Scenarios |
|------------|------|-----------|
| Worker Photo Upload | `tests/e2e/worker-photo-upload.spec.js` | Batch uploads (10 max), multi-batch (50+ total), invalid files, RBAC |
| Client Photo Viewing | `tests/e2e/client-photo-viewing.spec.js` | View all photos, pagination, RBAC, viewed tracking |
| RBAC & Sessions | `tests/e2e/rbac-and-sessions.spec.js` | Finance restrictions, staff routes, session persistence, health checks |

**Playwright Configuration Highlights:**

```javascript
// playwright.config.js
module.exports = defineConfig({
  use: {
    baseURL: 'http://localhost:3000',
    // Auto-grant permissions (no interactive prompts)
    permissions: ['camera', 'geolocation', 'notifications'],
    // Collect artifacts on failure
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  // Correlation IDs exposed in headers for debugging
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000/api/healthz'
  }
});
```

**Debugging Failed Tests:**

1. Check HTML report: `npm run test:e2e:report`
2. Find correlation ID in server logs: `docker-compose logs -f app | grep "req_..."`
3. Open trace in UI mode: `npm run test:e2e:ui`
4. Inspect screenshots in `test-results/` directory
5. Review network requests and console errors in trace viewer

**Frontend Tests:**
```bash
cd client
npm test                           # Run Jest tests with React Testing Library
npm test -- --coverage             # Run tests with coverage report
npm test -- --watchAll             # Run tests in watch mode
```

**Manual API Testing:**
```bash
# Test authentication flow
curl -X POST http://localhost:3000/api/auth/login/user \
  -H "Content-Type: application/json" \
  -d '{"username":"master","password":"master123"}' \
  -c cookies.txt -v

# Test authenticated endpoint
curl -X GET http://localhost:3000/api/cleaning-jobs \
  -b cookies.txt \
  -H "X-Correlation-Id: test-$(date +%s)"

# Test pagination
curl -X GET "http://localhost:3000/api/cleaning-jobs?limit=10&offset=0" \
  -b cookies.txt

# Test file upload
curl -X POST http://localhost:3000/api/cleaning-jobs/1/photos \
  -b cookies.txt \
  -F "photos=@/path/to/image.jpg" \
  -F "photos=@/path/to/image2.jpg"
```

**Testing Pattern for New Endpoints:**
1. Test unauthenticated access (should return 401)
2. Test with wrong role (should return 403)
3. Test with correct role (should return 200)
4. Test validation errors (should return 400 with details)
5. Test with invalid IDs (should return 404)
6. Verify correlation ID in all responses
7. Check response envelope structure (_meta field)

## Default Credentials

**Master (Owner):**
- Username: `master`
- Password: `master123`
- Full system access

**Admin (Manager):**
- Username: `admin`
- Password: `admin123`
- Cannot create other admins

**Worker (Cleaner):**
- Username: `worker1`
- Password: `worker123`
- No finance access

**Sample Client:**
- Phone: `911111111`
- Password: `lavandaria2025` (must change on first login)

**New Clients:**
- Default password: `lavandaria2025`
- Forced to change password on first login via [src/pages/ChangePassword.js](client/src/pages/ChangePassword.js)

## Route Structure

### Active Routes

| Route File | Auth Required | Permission Middleware | Purpose |
|-----------|---------------|----------------------|---------|
| [routes/auth.js](routes/auth.js) | Selective | N/A | Login, logout, password change |
| [routes/users.js](routes/users.js) | Yes | `canManageUsers()` | Staff CRUD (context-aware) |
| [routes/clients.js](routes/clients.js) | Yes | `requireMasterOrAdmin` | Client CRUD |
| [routes/cleaning-jobs.js](routes/cleaning-jobs.js) | Yes | `requireStaff` | Cleaning jobs with photos/time |
| [routes/laundry-orders.js](routes/laundry-orders.js) | Yes | `requireStaff` | Laundry orders |
| [routes/laundry-services.js](routes/laundry-services.js) | Yes | Mixed | Service catalog |
| [routes/payments.js](routes/payments.js) | Yes | `requireFinanceAccess` | **Blocks workers** |
| [routes/dashboard.js](routes/dashboard.js) | Yes | `requireFinanceAccess` | **Blocks workers** |
| [routes/tickets.js](routes/tickets.js) | Yes | `requireStaff` | Issue reporting |
| [routes/properties.js](routes/properties.js) | Yes | `requireMasterOrAdmin` | Client addresses |
| [routes/settings.js](routes/settings.js) | Yes | `requireMaster` | System settings |
| [routes/health.js](routes/health.js) | **No** | Public | Health checks |

### Deprecated Routes (Return 410 Gone)

- `routes/laundry.js` - Old laundry system
- `routes/airbnb.js` - Old Airbnb system
- `routes/services.js` - Old services

## Frontend Architecture

### Page Components

| Page | Route | Access | Features |
|------|-------|--------|----------|
| [Landing.js](client/src/pages/Landing.js) | `/` | Public | Dual login (staff + client) |
| [Dashboard.js](client/src/pages/Dashboard.js) | `/dashboard` | All roles | Routes to role-specific dashboards |
| [AdminDashboard.js](client/src/pages/AdminDashboard.js) | `/admin` | Master/Admin | CRM, orders, payments, services |
| [MasterDashboard.js](client/src/pages/MasterDashboard.js) | `/master` | Master | Settings, user management |
| [WorkerDashboard.js](client/src/pages/WorkerDashboard.js) | `/worker` | Worker | Job list, photo upload, time tracking |
| [ClientDashboard.js](client/src/pages/ClientDashboard.js) | `/client` | Client | My orders, photos, status |
| [ChangePassword.js](client/src/pages/ChangePassword.js) | `/change-password` | Client | Forced password change |

### State Management

[src/context/AuthContext.js](client/src/context/AuthContext.js) provides:

```javascript
export const useAuth = () => {
  // State
  user          // { id, username/phone, userType, ... }
  loading       // Boolean

  // Actions
  login(credentials)
  logout()
  changePassword(oldPassword, newPassword)

  // Computed
  isAuthenticated
  isMaster
  isAdmin
  isWorker
  isClient
}
```

**Pattern**: Context provides authentication state. No Redux - simpler for this use case.

### Frontend Component Patterns

**Route Protection Pattern** ([src/App.js](client/src/App.js)):
```javascript
// Public routes
<Route path="/" element={<Landing />} />

// Protected routes - role-based
<Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
<Route path="/admin" element={<ProtectedRoute allowedRoles={['master', 'admin']}><AdminDashboard /></ProtectedRoute>} />
<Route path="/worker" element={<ProtectedRoute allowedRoles={['worker']}><WorkerDashboard /></ProtectedRoute>} />
```

**API Call Pattern** (axios with credentials):
```javascript
// All requests automatically include session cookies
import axios from 'axios';
axios.defaults.withCredentials = true;

// Example API call
const response = await axios.get('/api/cleaning-jobs');
// Response includes _meta with correlationId, timestamp, pagination
```

**Tailwind CSS Usage**:
- Utility-first approach throughout
- Custom colors defined in [tailwind.config.js](client/tailwind.config.js)
- Responsive breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- Dark mode: Not currently implemented

### Build Process

- **Development**: Port 3001 with proxy to localhost:3000
- **Production**: Built to `client/build/`, served by Express static middleware

```bash
# Production build
cd client
npm run build
# Generates optimized bundle in client/build/
# Served via server.js: app.use(express.static(path.join(__dirname, 'client/build')))
```

## Security Features

- **Passwords**: Bcrypt hashing (cost factor 10)
- **Sessions**: PostgreSQL store (persistent, scalable)
- **Cookies**: HTTP-only + SameSite=lax (CSRF protection)
- **Headers**: Helmet.js (CSP, HSTS, referrer policy)
- **SQL Injection**: Parameterized queries (all queries use $1, $2, etc.)
- **Input Validation**: express-validator chains
- **Rate Limiting**: Login endpoints (5 attempts per 15 minutes per IP)
- **CORS**: Whitelist approach (CORS_ORIGINS env var)

## Key Architectural Decisions

### Why Dual Login Endpoints?

- `/api/auth/login/user` (username-based) vs `/api/auth/login/client` (phone-based)
- **Reason**: Different authentication strategies, password policies, rate limiting
- **Benefit**: Separate session data (userType, different forced password flows)

### Why PostgreSQL Session Store?

- Sessions survive container restarts
- Shared sessions across multiple app instances (horizontal scaling)
- Admin can query sessions for debugging
- Better than memory store for production

### Why Split Payment Tables?

- **Problem**: Single `payments` table with polymorphic FK (job_id OR order_id) had NULL values
- **Solution**: `payments_cleaning` (FK to cleaning_jobs.id) + `payments_laundry` (FK to laundry_orders_new.id)
- **Benefit**: Referential integrity maintained, no NULL FKs

### Why Emoji Logging?

- **Pattern**: Console logs prefixed with emojis for easy scanning
  - `❌` Error
  - `✅` Success
  - `🔐` Auth
  - `📊` Data
  - `🚫` Rate limited
- **Benefit**: Quickly identify log types in Docker logs without color support

### Why Correlation IDs?

- Every request gets unique ID via `X-Correlation-Id` header
- Enables request tracing through logs
- Included in error responses for debugging
- Helps trace multi-request workflows (e.g., login → fetch users → create order)

## Development Best Practices

### Code Organization

**Backend:**
- Place route handlers in `routes/` directory
- Keep middleware in `middleware/` directory
- Database configuration in `config/database.js`
- Use correlation IDs in all console.log statements: `console.log(\`[TAG] Message [\${req.correlationId}]\`)`
- Always use parameterized queries ($1, $2, etc.) - NEVER string concatenation
- Return standardized responses using helpers from `middleware/validation.js`

**Frontend:**
- Pages go in `client/src/pages/`
- Reusable components in `client/src/components/`
- Context providers in `client/src/context/`
- Always use `axios.defaults.withCredentials = true` for authenticated requests
- Use Tailwind utility classes instead of custom CSS

### Error Handling Pattern

**Backend error handling:**
```javascript
try {
    const result = await pool.query('SELECT * FROM table WHERE id = $1', [id]);

    if (result.rows.length === 0) {
        return errorResponse(res, 404, 'Resource not found', 'NOT_FOUND', req);
    }

    return successResponse(res, { item: result.rows[0] }, 200, req);
} catch (error) {
    console.error(`❌ [ERROR] Operation failed [${req.correlationId}]:`, error);
    return errorResponse(res, 500, 'Server error', 'SERVER_ERROR', req);
}
```

**Frontend error handling:**
```javascript
try {
    const response = await axios.get('/api/endpoint');
    // Handle success
} catch (error) {
    if (error.response) {
        // Server responded with error status
        const { error: message, code, _meta } = error.response.data;
        console.error(`API Error [${_meta?.correlationId}]:`, message, code);
        // Show user-friendly error message
    } else if (error.request) {
        // Request made but no response
        console.error('Network error:', error.message);
    } else {
        // Something else happened
        console.error('Error:', error.message);
    }
}
```

### Security Checklist for New Features

- [ ] Use parameterized queries (prevent SQL injection)
- [ ] Validate all inputs with express-validator
- [ ] Apply appropriate permission middleware
- [ ] Implement role-based query filtering (workers see only assigned items)
- [ ] Use bcrypt for password hashing (never store plaintext)
- [ ] Add rate limiting to authentication endpoints
- [ ] Include correlation ID in error responses
- [ ] Sanitize file uploads (check type, size, extension)
- [ ] Never expose internal error details to clients
- [ ] Test with different user roles

## Common Patterns to Replicate

### Adding a New List Endpoint with Pagination

```javascript
const { listResponse, validatePagination, errorResponse } = require('../middleware/validation');
const { requireMasterOrAdmin } = require('../middleware/permissions');

router.get('/', requireMasterOrAdmin, async (req, res) => {
  try {
    // 1. Validate pagination params
    const { limit, offset, sort, order } = validatePagination(req);

    // 2. Build role-specific query
    let query = 'SELECT * FROM table';
    let countQuery = 'SELECT COUNT(*) FROM table';
    let params = [];

    if (req.session.userType === 'worker') {
      const whereClause = ' WHERE assigned_to = $1';
      query += whereClause;
      countQuery += whereClause;
      params.push(req.session.userId);
    }

    // 3. Add sorting and pagination
    query += ` ORDER BY ${sort} ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    // 4. Execute queries in parallel for performance
    const [result, countResult] = await Promise.all([
      pool.query(query, [...params, limit, offset]),
      pool.query(countQuery, params)
    ]);

    // 5. Return standardized envelope
    return listResponse(res, result.rows, {
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    }, req);
  } catch (error) {
    console.error(`❌ [ERROR] Failed to fetch [${req.correlationId}]:`, error);
    return errorResponse(res, 500, 'Server error', 'SERVER_ERROR', req);
  }
});
```

### Adding File Upload

```javascript
const multer = require('multer');
const path = require('path');

const upload = multer({
  destination: 'uploads/photos/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const valid = allowedTypes.test(path.extname(file.originalname).toLowerCase()) &&
                  allowedTypes.test(file.mimetype);
    cb(valid ? null : new Error('Only images allowed'), valid);
  }
});

router.post('/:id/upload', requireStaff, upload.array('photos', 10), async (req, res) => {
  try {
    const files = req.files; // Array of uploaded files

    // Insert file records
    for (const file of files) {
      await pool.query(
        'INSERT INTO photos (job_id, filename, uploaded_by) VALUES ($1, $2, $3)',
        [req.params.id, file.filename, req.session.userId]
      );
    }

    return successResponse(res, { uploaded: files.length }, 200, req);
  } catch (error) {
    console.error(`❌ [UPLOAD] Failed [${req.correlationId}]:`, error);
    return errorResponse(res, 500, 'Upload failed', 'UPLOAD_ERROR', req);
  }
});
```

## Quick Reference

### Essential File Paths

**Backend:**
- Main server: [server.js](server.js)
- Database config: [config/database.js](config/database.js)
- Database schema: [database/init.sql](database/init.sql)
- Migrations: [database/migrations_archive/](database/migrations_archive/)
- Deployment script: [deploy.sh](deploy.sh)
- Environment template: [.env.example](.env.example)

**Middleware:**
- Permissions: [middleware/permissions.js](middleware/permissions.js)
- Validation helpers: [middleware/validation.js](middleware/validation.js)
- Rate limiting: [middleware/rateLimiter.js](middleware/rateLimiter.js)

**API Routes:**
- Authentication: [routes/auth.js](routes/auth.js)
- Users (staff): [routes/users.js](routes/users.js)
- Clients: [routes/clients.js](routes/clients.js)
- Cleaning jobs: [routes/cleaning-jobs.js](routes/cleaning-jobs.js)
- Laundry orders: [routes/laundry-orders.js](routes/laundry-orders.js)
- Payments: [routes/payments.js](routes/payments.js)
- Dashboard: [routes/dashboard.js](routes/dashboard.js)

**Frontend:**
- Main app: [client/src/App.js](client/src/App.js)
- Auth context: [client/src/context/AuthContext.js](client/src/context/AuthContext.js)
- Landing page: [client/src/pages/Landing.js](client/src/pages/Landing.js)
- Dashboards: [client/src/pages/*Dashboard.js](client/src/pages/)
- Tailwind config: [client/tailwind.config.js](client/tailwind.config.js)

### Key Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SESSION_SECRET` | **Yes** | - | 32+ char hex string (auto-generated by deploy.sh) |
| `DB_HOST` | Yes | `db` | Database hostname |
| `DB_PORT` | No | `5432` | Database port |
| `DB_USER` | Yes | `lavandaria` | Database username |
| `DB_PASSWORD` | Yes | `lavandaria2025` | Database password |
| `DB_NAME` | Yes | `lavandaria` | Database name |
| `NODE_ENV` | No | `development` | Environment (`production`, `development`) |
| `PORT` | No | `3000` | Server port |
| `CORS_ORIGINS` | No | `http://localhost:3000,http://localhost:3001` | Comma-separated allowed origins |
| `HTTPS` | No | `false` | Enable HTTPS-only cookies in production |

### Docker Container Names

- **Database**: `lavandaria-db`
- **Application**: `lavandaria-app`
- **Network**: `lavandaria-network`
- **Volume**: `postgres-data`

## Troubleshooting

**Database won't start:**
```bash
docker-compose down -v  # Remove volumes
./deploy.sh             # Redeploy
```

**Migrations fail:**
```bash
# Check migration execution order in deploy.sh
# Verify database is ready: docker exec -it lavandaria-db pg_isready
# View migration errors: docker-compose logs -f app
```

**Session issues (not authenticated after login):**
```bash
# Check SESSION_SECRET is set and strong (32+ chars)
# Verify session table exists: docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c "\dt session"
# Check cookies are being set: curl -v http://localhost:3000/api/auth/login/user
```

**Port conflicts:**
```bash
# Edit docker-compose.yml ports section
# Change "3000:3000" to "3001:3000" etc.
```

**Permission issues with uploads:**
```bash
chmod -R 755 uploads/
```

**React build errors:**
```bash
cd client
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Rate limiting during development:**
```bash
# Wait 15 minutes or restart app to clear rate limit store
docker-compose restart app
```

## Access URLs

- **Frontend (production)**: http://localhost:3000
- **Frontend (dev)**: http://localhost:3001
- **Backend API**: http://localhost:3000/api
- **API Documentation (Swagger UI)**: http://localhost:3000/api/docs
- **Database**: localhost:5432
- **Health Check**: http://localhost:3000/api/healthz
- **Readiness Check**: http://localhost:3000/api/readyz
- **Uploaded Files**: http://localhost:3000/uploads/cleaning_photos/

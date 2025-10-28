# Lavandaria

> **Dual-Business Management System**
> Laundry Service + Property Cleaning with Photo Verification

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-18%2B-green.svg)
![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue.svg)

---

## Table of Contents

- [Quick Start](#quick-start)
- [Project Overview](#project-overview)
- [Documentation](#documentation)
- [Tech Stack](#tech-stack)
- [Running Tests](#running-tests)
- [Deployment](#deployment)
- [Glossary](#glossary)
- [Contributing](#contributing)

---

## Quick Start

### Prerequisites
- Docker & Docker Compose installed
- Node.js 18+ (for local development)
- PostgreSQL 16 (containerized or local)

### One-Command Deployment

```bash
./deploy.sh
```

**What it does:**
- Creates `.env` from template with secure SESSION_SECRET
- Builds Docker containers (db + app)
- Runs database migrations
- Starts services with health checks
- Displays access URLs and credentials

**Access URLs:**
- Frontend: http://localhost:3000
- API Docs: http://localhost:3000/api/docs
- Database: localhost:5432

**Default Credentials:**
- Master: `master` / `master123`
- Admin: `admin` / `admin123`
- Worker: `worker1` / `worker123`
- Client: `911111111` / `lavandaria2025`

---

## Project Overview

Lavandaria manages two distinct service lines under a unified platform:

### 1. Laundry Service
Traditional clothing cleaning with:
- **Order Tracking**: Received → In Progress → Ready → Collected
- **Itemization**: Bulk weight (€/kg) or itemized service catalog
- **Client Notifications**: SMS/email when order ready

### 2. Property Cleaning Service
Airbnb/house cleaning with:
- **Photo Verification**: Before/after/detail photos with room tracking
- **Time Tracking**: Worker clock-in/out with manual entry support
- **Job Management**: Scheduled → In Progress → Completed

### Role Hierarchy

```
Master (Owner) → Admin (Manager) → Worker (Field) → Client (Customer)
```

- **Master**: Full system access, can create admins
- **Admin**: Manage workers/clients/orders, finance access
- **Worker**: View assigned jobs, upload photos, track time (NO finance access)
- **Client**: View own orders (read-only)

---

## Documentation

All documentation lives in the [`docs/`](docs/) folder:

| Document | Purpose | Update Frequency |
|----------|---------|------------------|
| [📐 architecture.md](docs/architecture.md) | System overview, database schema, workflows | On schema changes |
| [📊 progress.md](docs/progress.md) | Daily progress log (Planned/Doing/Done) | Daily |
| [💡 decisions.md](docs/decisions.md) | Implementation decisions with context | On major changes |
| [🐛 bugs.md](docs/bugs.md) | Bug tracking and fixes | On discovery/resolution |
| [🔒 security.md](docs/security.md) | Security posture, audits, open items | Quarterly |

**Start Here:** [`docs/architecture.md`](docs/architecture.md) for system design and database schema.

---

## Tech Stack

### Backend
- **Runtime**: Node.js 18+ with Express.js 4.18
- **Database**: PostgreSQL 16 (single source of truth)
- **Authentication**: Session-based (PostgreSQL store, HTTP-only cookies)
- **File Uploads**: Multer (10MB limit, batch uploads)
- **Validation**: express-validator
- **API Docs**: OpenAPI 3.0 (Swagger UI)

### Frontend
- **Framework**: React 19 with React Router 7
- **Styling**: Tailwind CSS 3 (utility-first)
- **State**: Context API (no Redux)
- **HTTP Client**: Axios with credentials

### DevOps
- **Deployment**: Docker + Docker Compose
- **Base Image**: Alpine Linux (minimal)
- **Orchestration**: [`deploy.sh`](deploy.sh) (one-command)
- **Health Checks**: `/api/healthz`, `/api/readyz`

### Testing
- **E2E**: Playwright (terminal-first, then UI)
- **Frontend**: Jest + React Testing Library
- **Manual**: cURL scripts with correlation IDs

---

## Running Tests

### Recommended Workflow (Terminal-First)

**1. Seed Test Data:**
```bash
npm run test:seed
# Creates: master, admin, worker1, client with known passwords
```

**2. Run E2E Tests (Headless):**
```bash
npm run test:e2e
# Runs all Playwright tests in terminal
# Collects: screenshots, traces, HTML report
```

**3. View Results:**
```bash
npm run test:e2e:report
# Opens HTML report in browser
```

**4. Debug Failures (Playwright UI):**
```bash
npm run test:e2e:ui
# Opens Playwright UI for trace replay
# Inspect network, console, screenshots
```

### Test Coverage

| Test Suite | File | Scenarios |
|------------|------|-----------|
| Worker Photo Upload | `tests/e2e/worker-photo-upload.spec.js` | Batch uploads, RBAC, invalid files |
| Client Photo Viewing | `tests/e2e/client-photo-viewing.spec.js` | Pagination, viewing tracking |
| RBAC & Sessions | `tests/e2e/rbac-and-sessions.spec.js` | Finance restrictions, session persistence |

### Frontend Tests
```bash
cd client
npm test                    # Run Jest tests
npm test -- --coverage      # With coverage report
npm test -- --watchAll      # Watch mode
```

---

## Deployment

### Production Deployment (Docker)

```bash
./deploy.sh
```

See [`docs/architecture.md`](docs/architecture.md) for detailed deployment architecture.

### Local Development (Without Docker)

**Terminal 1 - Database:**
```bash
docker-compose up -d db
```

**Terminal 2 - Backend:**
```bash
npm install
npm run server    # Nodemon auto-reload
```

**Terminal 3 - Frontend:**
```bash
cd client
npm install
npm start         # Runs on port 3001
```

**Access:**
- Backend: http://localhost:3000
- Frontend: http://localhost:3001 (proxies API to :3000)

### Environment Variables

Create `.env` from [`.env.example`](.env.example):

```env
# Required
SESSION_SECRET=<32+ char hex string>   # Auto-generated by deploy.sh
DB_HOST=db
DB_USER=lavandaria
DB_PASSWORD=lavandaria2025
DB_NAME=lavandaria

# Optional
NODE_ENV=production
PORT=3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

---

## Glossary

### Business Terms

**Order Lifecycle** (Laundry):
- `received` - Order received from client
- `in_progress` - Being processed by worker
- `ready` - Ready for client pickup
- `collected` - Client picked up order
- `cancelled` - Order cancelled

**Job Lifecycle** (Cleaning):
- `scheduled` - Job scheduled with date/time
- `in_progress` - Worker on-site, time tracking active
- `completed` - Job finished, photos uploaded
- `cancelled` - Job cancelled

**Order Types** (Laundry):
- `bulk_kg` - Charged by weight (€/kg)
- `itemized` - Individual item pricing
- `house_bundle` - Fixed-price package

**Job Types** (Cleaning):
- `airbnb` - Short-term rental property
- `house` - Residential house

**Photo Types**:
- `before` - Before cleaning
- `after` - After cleaning
- `detail` - Detail shots (specific areas)

**Payment Methods**:
- `cash` - Cash payment
- `card` - Credit/debit card
- `transfer` - Bank transfer
- `mbway` - Portuguese mobile payment
- `other` - Other methods

**Payment Status**:
- `pending` - Not yet paid
- `paid` - Fully paid
- `partial` - Partially paid

### Technical Terms

**RBAC** - Role-Based Access Control (Master → Admin → Worker → Client)

**Session Store** - PostgreSQL-backed sessions for persistence and horizontal scaling

**Correlation ID** - Unique request identifier for tracing (`req_1729...`)

**Photo Verification** - Multi-type photo upload with client viewing tracking

**Batch Upload** - Maximum 10 files per upload request (unlimited total)

**Middleware Stack** - Request processing order: Helmet → Morgan → CORS → Session → Auth

**Response Envelope** - Standardized API response format with `_meta` object

**Migration Dependencies** - Specific execution order: 000 → 002 → 001 → 003 → 004

---

## File Structure

```
Lavandaria/
├── server.js                      # Main Express server
├── deploy.sh                      # One-command deployment
├── package.json                   # Root dependencies
├── .env.example                   # Environment template
├── docker-compose.yml             # Container orchestration
├── Dockerfile                     # App container definition
├── README.md                      # This file
│
├── config/
│   └── database.js                # PostgreSQL connection pool
│
├── database/
│   ├── init.sql                   # Schema definition
│   └── migrations_archive/        # Migration history
│       ├── 000_add_user_client_fields.sql
│       ├── 002_create_jobs_system.sql
│       ├── 001_standardize_address_fields.sql
│       ├── 003_pricing_and_settings.sql
│       └── 004_split_payments_tables.sql
│
├── middleware/
│   ├── permissions.js             # RBAC middleware
│   ├── validation.js              # Response helpers
│   └── rateLimiter.js             # Rate limiting + correlation IDs
│
├── routes/
│   ├── auth.js                    # Login/logout
│   ├── users.js                   # Staff CRUD
│   ├── clients.js                 # Client CRUD
│   ├── cleaning-jobs.js           # Cleaning jobs + photos
│   ├── laundry-orders.js          # Laundry orders
│   ├── laundry-services.js        # Service catalog
│   ├── payments.js                # Payment tracking
│   ├── dashboard.js               # Dashboard data
│   ├── tickets.js                 # Issue reporting
│   ├── properties.js              # Client addresses
│   ├── settings.js                # System settings
│   └── health.js                  # Health checks
│
├── client/                        # React frontend
│   ├── src/
│   │   ├── App.js                 # Main React component
│   │   ├── context/
│   │   │   └── AuthContext.js     # Auth state management
│   │   ├── pages/
│   │   │   ├── Landing.js         # Dual login page
│   │   │   ├── Dashboard.js       # Role router
│   │   │   ├── AdminDashboard.js  # Admin UI
│   │   │   ├── MasterDashboard.js # Master UI
│   │   │   ├── WorkerDashboard.js # Worker UI
│   │   │   └── ClientDashboard.js # Client UI
│   │   └── components/            # Reusable components
│   ├── public/                    # Static assets
│   ├── tailwind.config.js         # Tailwind configuration
│   └── package.json               # Frontend dependencies
│
├── tests/
│   └── e2e/                       # Playwright E2E tests
│       ├── worker-photo-upload.spec.js
│       ├── client-photo-viewing.spec.js
│       └── rbac-and-sessions.spec.js
│
├── uploads/
│   └── cleaning_photos/           # Uploaded photos
│
├── logs/                          # Application logs
│
└── docs/                          # Living documentation
    ├── architecture.md            # System design + schema
    ├── progress.md                # Daily progress log
    ├── decisions.md               # Implementation decisions
    ├── bugs.md                    # Bug tracking
    └── security.md                # Security posture
```

---

## Contributing

### Development Workflow

1. **Create Feature Branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Implement Changes:**
   - Follow patterns in `docs/architecture.md`
   - Add tests (E2E for user-facing features)
   - Update `docs/decisions.md` for major decisions

3. **Run Tests:**
   ```bash
   npm run test:seed      # Seed test data
   npm run test:e2e       # Run E2E tests (terminal-first)
   npm run test:e2e:ui    # Debug failures
   ```

4. **Commit with Convention:**
   ```bash
   git commit -m "feat(orders): add bulk order import"
   git commit -m "fix(auth): resolve session persistence issue"
   git commit -m "docs: update security checklist"
   ```

5. **Update Progress Log:**
   - Add entry to `docs/progress.md`
   - Record decision in `docs/decisions.md` if applicable

6. **Create Pull Request:**
   ```bash
   git push -u origin feature/your-feature-name
   gh pr create --title "feat: your feature" --body "Description..."
   ```

### Code Style Guidelines

**Backend (Node.js):**
- CommonJS modules (`require`, `module.exports`)
- Parameterized queries (NEVER string concatenation)
- Correlation IDs in all logs
- Standard response envelope pattern
- Try/catch with proper error codes

**Frontend (React):**
- ES6 modules (`import`, `export`)
- Functional components with hooks
- Tailwind utility classes (no custom CSS)
- `axios.defaults.withCredentials = true`

**Database:**
- Explicit `ON DELETE` policies (CASCADE or SET NULL)
- CHECK constraints for valid values
- Indexes on foreign keys and status fields
- Created timestamps (created_at, updated_at)

**Testing:**
- Terminal-first (headless)
- Then Playwright UI for debugging
- Test all RBAC scenarios
- Verify correlation IDs in responses

---

## Useful Commands

### Docker Operations
```bash
npm run docker:build      # Build containers
npm run docker:up         # Start services
npm run docker:down       # Stop services
npm run docker:logs       # View logs
```

### Database Operations
```bash
# Connect to database
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria

# Query sessions
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT * FROM session;"

# Backup database
docker exec lavandaria-db pg_dump -U lavandaria lavandaria > backup.sql

# Restore database
cat backup.sql | docker exec -i lavandaria-db psql -U lavandaria lavandaria
```

### Development Shortcuts
```bash
npm run dev               # Run server + client concurrently
npm run server            # Backend only (nodemon)
npm run client            # Frontend only (port 3001)
npm run build             # Production build
npm start                 # Production server
```

---

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

## Support & Contact

- **Documentation**: [`docs/`](docs/)
- **Bug Reports**: [`docs/bugs.md`](docs/bugs.md)
- **Security Issues**: See [`docs/security.md`](docs/security.md)
- **GitHub**: [HSousa1987/Lavandaria](https://github.com/HSousa1987/Lavandaria)

---

**Last Updated:** 2025-10-23
**Version:** 1.0.0 (Post-Cutover)

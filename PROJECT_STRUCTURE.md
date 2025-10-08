# Lavandaria - Project Structure

## 📁 Directory Structure

```
Lavandaria/
├── client/                    # React frontend
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   ├── context/          # React context (AuthContext)
│   │   ├── pages/            # Page components
│   │   └── App.js           # Main app component
│   └── package.json
│
├── config/                   # Configuration files
│   └── database.js          # PostgreSQL connection
│
├── database/                 # Database schemas & migrations
│   ├── init.sql             # Base schema (auto-runs on first start)
│   └── migrations/          # Migration files (run by deploy.sh)
│       ├── 001_add_user_client_fields.sql
│       ├── 002_create_jobs_system.sql       # ← Main jobs system
│       ├── 003_pricing_and_settings.sql
│       └── 001_standardize_address_fields.sql
│
├── middleware/              # Express middleware
│   └── permissions.js      # Role-based access control
│
├── routes/                  # API endpoints
│   ├── auth.js             # Authentication (with logging)
│   ├── clients.js          # Client CRUD
│   ├── cleaning-jobs.js    # New cleaning jobs system ⭐
│   ├── laundry-orders.js   # New laundry system
│   ├── laundry-services.js # Service catalog
│   ├── payments.js         # Finance tracking
│   ├── dashboard.js        # Statistics
│   ├── tickets.js          # Issue reporting
│   ├── users.js            # User management
│   ├── laundry.js          # Legacy laundry
│   └── airbnb.js           # Legacy Airbnb
│
├── uploads/                 # User-uploaded files
│   └── cleaning_photos/    # Photo verification images
│
├── logs/                    # Application logs
│
├── .env.example            # Environment template
├── .env                    # Environment variables (not in git)
├── Dockerfile              # Backend container config
├── docker-compose.yml      # Docker services orchestration
├── deploy.sh               # One-command deployment script ⭐
├── package.json            # Backend dependencies
├── server.js               # Express server entry point
│
└── docs/                   # Documentation
    ├── CLAUDE.md           # Main project overview ⭐
    ├── SESSION_SUMMARY_2025-10-08.md  # Latest session log ⭐
    ├── PROJECT_STRUCTURE.md  # This file
    ├── BUSINESS_ANALYSIS.md
    ├── IMPLEMENTATION_DOCS.md
    ├── JOBS_SYSTEM_DESIGN.md
    ├── QUICK_REFERENCE.md
    ├── README.md
    ├── ROLE_HIERARCHY_SUMMARY.md
    ├── UPDATES.md
    └── VISUAL_GUIDE.md
```

## 📄 Essential Files

### 🔧 Configuration
- **`.env`** - Database credentials, secrets (not in git)
- **`docker-compose.yml`** - Container orchestration
- **`Dockerfile`** - Backend container build

### 🚀 Deployment
- **`deploy.sh`** - **ONE-COMMAND DEPLOYMENT** (handles everything)
- **`database/init.sql`** - Base schema
- **`database/migrations/002_create_jobs_system.sql`** - Main jobs system

### 📚 Documentation
- **`CLAUDE.md`** - **PRIMARY REFERENCE** for future sessions
- **`SESSION_SUMMARY_2025-10-08.md`** - **LATEST SESSION LOG**
- **`PROJECT_STRUCTURE.md`** - This file

## 🗄️ Database Schema (Current)

### Core Tables
```sql
users                    -- Staff (master/admin/worker)
clients                  -- Customers
session                  -- Express sessions
```

### Cleaning Jobs System (Migration 002)
```sql
cleaning_jobs            -- Main jobs table
  ├── estimated_hours    -- For billing estimates
  ├── district           -- Location
  ├── country            -- Default: Portugal
  └── assigned_worker_id -- Primary worker (backward compat)

cleaning_job_workers     -- Multiple workers per job ⭐
  ├── cleaning_job_id
  ├── worker_id
  └── is_primary         -- First worker is primary

cleaning_job_photos      -- Photo verification
cleaning_time_logs       -- Time tracking per worker
job_notifications        -- Push notifications
```

### Laundry System
```sql
laundry_orders_new       -- New laundry orders
laundry_order_items      -- Itemized orders
laundry_services         -- Service catalog
```

### Legacy (Still Active)
```sql
laundry_orders           -- Old laundry system
airbnb_orders            -- Old Airbnb cleaning
cleaning_photos          -- Old photo system
time_logs                -- Old time tracking
```

## 🔑 User Roles & Access

### Master (Owner)
- Full system access
- Can create admins
- Can create workers
- Full finance access
- **Can work as cleaner**

### Admin
- Can create workers (not admins)
- Manage clients & orders
- Full finance access
- **Can work as cleaner** ⭐

### Worker
- Manage assigned jobs
- Upload photos
- Track time
- NO finance access

### Client
- View own orders
- Download photos (no delete)
- Change password

## 🎯 Key Features

### ✅ Implemented
1. **Multiple Workers per Job**
   - Checkbox selection in UI
   - `cleaning_job_workers` junction table
   - Primary worker designation

2. **Estimated Hours for Billing**
   - Required field in job creation
   - Used for cost calculation
   - Compared with actual hours worked

3. **Admin as Worker**
   - Admins can be assigned to jobs
   - Labeled in UI: "(Admin)"
   - Both cleaning and laundry jobs

4. **Username Auto-Generation**
   - Sanitizes Portuguese characters
   - Format: firstname.lastname
   - Editable before save

5. **Comprehensive Logging**
   - Emoji-coded log messages
   - Auth: 🔐 Login events
   - Jobs: 🧹 Creation, 👥 Worker assignment
   - DB: 📊 Query results

6. **Photo Management**
   - Workers upload
   - Client view (download only)
   - Tracking: viewed_by_client flag

### ⚠️ TODO (Next Session)
1. Client photo gallery UI
2. Worker mobile interface
3. Email/SMS notifications
4. PDF invoice generation
5. Advanced analytics

## 🚀 Quick Start

### Fresh Deployment
```bash
./deploy.sh
```

### Development Mode
```bash
# Backend only
npm run server

# Frontend only
cd client && npm start

# Both
npm run dev
```

### Database Access
```bash
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria
```

### View Logs
```bash
docker-compose logs -f app
```

## 🔗 Important URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3000/api
- **Database:** localhost:5432

## 📝 Default Credentials

```
Master:    master / master123
Admin:     admin / admin123
Worker:    worker1 / worker123
Client:    911111111 / lavandaria2025
```

## 🎯 Next Steps

See `SESSION_SUMMARY_2025-10-08.md` → "Next Steps / TODO" section

---

**Last Updated:** October 8, 2025
**Status:** Production-ready for core features
**Next Focus:** Client photo gallery & notifications

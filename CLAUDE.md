# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lavandaria** is a dual-business management system for:
1. **Laundry Service** - Traditional clothing cleaning with order tracking
2. **Airbnb Cleaning Service** - Property cleaning with photo verification and time tracking

The system serves three user types: Admin (full access), Clients (view orders), and Cleaners (submit work with photos).

## Tech Stack

- **Backend**: Node.js + Express.js
- **Frontend**: React 19 + React Router + Tailwind CSS
- **Database**: PostgreSQL 16
- **Deployment**: Docker + Docker Compose
- **Platform**: Ubuntu (via Docker containers on macOS host)

## Architecture

### Database Schema (PostgreSQL)
- `users` - Staff accounts (master, admin, worker)
- `clients` - Customer accounts (login via phone number)
- `laundry_orders` - Clothing cleaning orders
- `airbnb_orders` - Property cleaning orders
- `cleaning_photos` - Photo verification for Airbnb jobs
- `time_logs` - Worker time tracking
- `payments` - Financial transactions
- `tickets` - Issue reporting system for workers
- `session` - Express session storage

### Backend Structure (Express API)
- `server.js` - Main Express server
- `routes/auth.js` - Authentication (dual login: user/client)
- `routes/clients.js` - Client CRUD (Admin only)
- `routes/laundry.js` - Laundry order management
- `routes/airbnb.js` - Airbnb orders + photo uploads
- `routes/payments.js` - Financial tracking
- `routes/dashboard.js` - Dashboard statistics

### Frontend Structure (React)
- `src/context/AuthContext.js` - Authentication state management
- `src/pages/Landing.js` - Modern landing page with dual login
- `src/pages/AdminDashboard.js` - Admin portal (CRM + Finance)
- `src/pages/ClientDashboard.js` - Client order viewing
- `src/pages/CleanerDashboard.js` - Cleaner job management + photo upload
- `src/pages/ChangePassword.js` - Force password change for new clients
- `src/components/ProtectedRoute.js` - Route authorization

## One-Command Deployment

Deploy the entire application with:

```bash
./deploy.sh
```

This script:
1. Checks Docker is installed and running
2. Creates necessary directories (uploads, logs)
3. Copies .env.example to .env if needed
4. Stops any existing containers
5. Builds Docker images
6. Starts containers (db + app)
7. Waits for database initialization
8. Displays access URLs and default credentials

## Development Commands

### Docker Management
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
docker-compose logs -f app  # Backend only
docker-compose logs -f db   # Database only

# Stop all services
docker-compose down

# Stop and remove volumes (full reset)
docker-compose down -v

# Rebuild containers
docker-compose build --no-cache
docker-compose up -d
```

### Development Mode (Without Docker)

**Backend:**
```bash
npm install
npm run server  # Uses nodemon for auto-reload
```

**Frontend:**
```bash
cd client
npm install
npm start  # Runs on port 3001
```

**Both (Concurrently):**
```bash
npm install
npm run dev
```

### Database Access
```bash
# Connect to PostgreSQL container
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria

# Run SQL queries
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT * FROM users;"

# Backup database
docker exec lavandaria-db pg_dump -U lavandaria lavandaria > backup.sql

# Restore database
cat backup.sql | docker exec -i lavandaria-db psql -U lavandaria lavandaria
```

## Access URLs

- **Frontend**: http://localhost:3000 (production) or http://localhost:3001 (dev)
- **Backend API**: http://localhost:3000/api
- **Database**: localhost:5432

## Default Credentials

**Master (YOU):**
- Username: `master`
- Password: `master123`
- Full access - can create admins

**Admin:**
- Username: `admin`
- Password: `admin123`
- Can manage clients and workers, NO admin creation

**Worker:**
- Username: `worker1`
- Password: `worker123`
- Can view/manage orders, create tickets, NO finance access

**Sample Client:**
- Phone: `911111111`
- Password: `lavandaria2025` (must change on first login)

**New Clients:**
- Default password: `lavandaria2025`
- Must change password on first login

## API Endpoints

### Authentication
- `POST /api/auth/login/user` - Staff login (master/admin/worker)
- `POST /api/auth/login/client` - Client login (phone + password)
- `GET /api/auth/check` - Check session status
- `POST /api/auth/logout` - Logout
- `POST /api/auth/change-password` - Change client password

### Users (Staff Management)
- `GET /api/users` - List users (Master sees all, Admin sees workers only)
- `GET /api/users/:id` - Get single user
- `POST /api/users` - Create user (Master creates admins, Admin creates workers)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/users/change-password` - Change own password

### Clients (Master/Admin Only)
- `GET /api/clients` - List all clients
- `GET /api/clients/:id` - Get single client
- `POST /api/clients` - Create client (auto-generates default password)
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

### Laundry Orders
- `GET /api/laundry` - List orders (filtered by role)
- `POST /api/laundry` - Create order (Master/Admin)
- `PUT /api/laundry/:id` - Update order (Master/Admin)

### Airbnb Orders
- `GET /api/airbnb` - List orders (filtered by role)
- `GET /api/airbnb/:id` - Get order with photos and time logs
- `POST /api/airbnb` - Create order (Master/Admin)
- `PUT /api/airbnb/:id` - Update order (Worker/Admin/Master)
- `POST /api/airbnb/:id/photos` - Upload photos (Worker/Admin/Master)
- `POST /api/airbnb/:id/time/start` - Start time tracking
- `PUT /api/time/:timeLogId/end` - End time tracking

### Tickets (Worker Issue Reporting)
- `GET /api/tickets` - List tickets (Workers see own, Admin/Master see all)
- `GET /api/tickets/:id` - Get single ticket
- `POST /api/tickets` - Create ticket (all staff)
- `PUT /api/tickets/:id` - Update ticket (Master/Admin only)
- `DELETE /api/tickets/:id` - Delete ticket (Master/Admin only)

### Payments (Master/Admin Only - NO Worker Access)
- `GET /api/payments` - List all payments
- `POST /api/payments` - Record payment

### Dashboard (Master/Admin Only - NO Worker Access)
- `GET /api/dashboard/stats` - Get statistics (includes revenue)

## File Upload Configuration

Photos are stored in `uploads/cleaning_photos/`
- Max file size: 5MB
- Allowed types: jpg, jpeg, png, gif
- Served via `/uploads` static route

## Environment Variables

Create `.env` file (copy from `.env.example`):

```env
NODE_ENV=production
DB_HOST=db
DB_PORT=5432
DB_USER=lavandaria
DB_PASSWORD=lavandaria2025
DB_NAME=lavandaria
PORT=3000
SESSION_SECRET=change-this-in-production
```

## Database Schema Notes

- All tables have auto-incrementing IDs
- Timestamps: `created_at`, `updated_at` (auto-updated via triggers)
- Foreign keys cascade on delete
- Indexes on frequently queried columns (client_id, status, phone)
- Password hashing uses bcrypt (cost factor 10)

## User Roles & Permissions

### Role Hierarchy:
**Master (Owner):**
- Full system access
- Create/manage admin users
- Create/manage worker users
- Full CRUD on clients
- Manage all orders (laundry + Airbnb)
- Full finance access (payments, dashboard)

**Admin:**
- Create/manage worker users (CANNOT create other admins)
- Create/manage clients
- Manage all orders (laundry + Airbnb)
- Full finance access (payments, dashboard)
- Manage tickets created by workers

**Worker:**
- View/manage assigned orders only
- Upload photos for Airbnb jobs
- Track time worked
- Update job status
- Create tickets when there's a problem
- **NO finance access** (cannot see payments or revenue)
- **CANNOT** create or manage users

**Client:**
- View own orders only
- Change password
- Read-only access

## Security Features

- Password hashing (bcrypt)
- Session-based authentication (PostgreSQL store)
- HTTP-only session cookies
- CORS configured
- Helmet.js security headers
- Input validation (express-validator)
- Parameterized SQL queries (prevents injection)

## Development Notes

- Backend uses CommonJS (`require/module.exports`)
- Frontend uses ES6 modules (`import/export`)
- React runs on port 3001 in dev, proxies API to port 3000
- Production build served by Express from `client/build`
- Sessions stored in PostgreSQL (persistent across restarts)
- File uploads use multer middleware

## Troubleshooting

**Database won't start:**
```bash
docker-compose down -v  # Remove volumes
./deploy.sh  # Redeploy
```

**Port conflicts:**
Edit `docker-compose.yml` to change port mappings

**Permission issues with uploads:**
```bash
chmod -R 755 uploads/
```

**React build errors:**
```bash
cd client
rm -rf node_modules package-lock.json
npm install
```

**View backend errors:**
```bash
docker-compose logs -f app
```

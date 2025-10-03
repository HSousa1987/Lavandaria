# Lavandaria - Role Hierarchy & Permissions Summary

## ✅ Implementation Complete

The system has been updated with a proper role hierarchy as requested.

## 👥 User Roles

### 🔑 Master (YOU - The Owner)
**Access Level:** FULL CONTROL

**Permissions:**
- ✅ See everything in the system
- ✅ Create admin users
- ✅ Create worker users
- ✅ Manage all clients (create, edit, delete)
- ✅ Manage all orders (laundry + Airbnb)
- ✅ Full finance access (payments, revenue, dashboard)
- ✅ Manage tickets

**Login:** Username/Password
**Default Account:** `master` / `master123`

---

### 👔 Admin
**Access Level:** HIGH (No admin creation, Full finance access)

**Permissions:**
- ✅ Create worker users (CANNOT create other admins or master)
- ✅ Manage all clients (create, edit, delete)
- ✅ Manage all orders (laundry + Airbnb)
- ✅ Full finance access (payments, revenue, dashboard)
- ✅ View and manage all tickets
- ❌ CANNOT create admin users
- ❌ CANNOT see/edit master account

**Login:** Username/Password
**Default Account:** `admin` / `admin123`

---

### 👷 Worker (Airbnb Cleaners)
**Access Level:** LIMITED (Operations only, NO finance)

**Permissions:**
- ✅ View assigned Airbnb cleaning orders
- ✅ Upload photos of cleaned properties
- ✅ Track time worked (start/end time)
- ✅ Update job status
- ✅ Create tickets when there's a problem
- ❌ **NO finance access** (cannot see payments or revenue)
- ❌ **NO client management**
- ❌ **NO user management**
- ❌ **NO access to dashboard statistics**

**Login:** Username/Password
**Default Account:** `worker1` / `worker123`

---

### 👤 Client
**Access Level:** VIEW ONLY (Own data)

**Permissions:**
- ✅ View own laundry orders
- ✅ View own Airbnb cleaning orders
- ✅ Change password
- ❌ Read-only access (cannot modify anything)

**Login:** Phone number + Password
**Default Account:** `911111111` / `lavandaria2025` (must change on first login)

---

## 🎫 Tickets System (NEW)

Workers can create tickets when they encounter problems:

**Examples:**
- "Missing cleaning supplies at property"
- "Client not available for key pickup"
- "Property was dirtier than expected"

**Ticket Fields:**
- Title
- Description
- Priority (low, medium, high, urgent)
- Status (open, in_progress, resolved, closed)
- Related order (optional)

**Permissions:**
- Workers: Can create tickets, view their own tickets
- Admin/Master: Can view all tickets, assign to staff, close tickets

---

## 🔐 Security & Hierarchy

### User Creation Rules:
1. **Master** → Can create Admins and Workers
2. **Admin** → Can create Workers only (NOT other admins)
3. **Worker** → Cannot create any users

### Finance Access:
- ✅ Master - Full access
- ✅ Admin - Full access
- ❌ Worker - **NO ACCESS** (completely hidden)

### Delete Protection:
- Master account cannot be deleted
- Users cannot delete themselves
- Admin cannot delete other admins or master
- Admin can only delete workers

---

## 📊 What Each Role Sees

### Master Dashboard:
- User management (all roles)
- Client management
- All orders
- Payments & Finance
- Revenue statistics
- All tickets

### Admin Dashboard:
- Worker management only
- Client management
- All orders
- Payments & Finance
- Revenue statistics
- All tickets

### Worker Dashboard:
- Assigned orders only
- Photo upload
- Time tracking
- Create tickets
- **NO finance information**

### Client Portal:
- Own orders only
- Order history

---

## 🗄️ Database Changes

### New Tables:
1. **`tickets`** - Issue reporting system

### Modified Tables:
1. **`users`** - Role changed from `('admin', 'cleaner')` to `('master', 'admin', 'worker')`
2. **`users`** - Added `created_by` field to track who created each user

---

## 🔧 API Endpoints (Updated)

### User Management:
- `POST /api/users` - Create user (permission checked by role)
- `GET /api/users` - List users (filtered by role)
- `PUT /api/users/:id` - Update user (permission checked)
- `DELETE /api/users/:id` - Delete user (permission checked)

### Tickets:
- `POST /api/tickets` - Create ticket (all staff)
- `GET /api/tickets` - List tickets (workers see own, admin/master see all)
- `PUT /api/tickets/:id` - Update ticket (admin/master only)
- `DELETE /api/tickets/:id` - Delete ticket (admin/master only)

### Finance (Protected):
- `GET /api/payments` - Requires Master or Admin
- `POST /api/payments` - Requires Master or Admin
- `GET /api/dashboard/stats` - Requires Master or Admin

---

## 🚀 Deployment

Run the deployment script:

```bash
./deploy.sh
```

The system will create:
- PostgreSQL database with updated schema
- Session storage
- Three user roles with proper permissions
- Tickets table for issue reporting

---

## 📝 Important Notes

1. **Default Passwords:** Change all default passwords in production!

2. **Master Account:** There is only ONE master account. This is YOUR account with full control.

3. **Finance Privacy:** Workers cannot see ANY financial information (payments, prices, revenue). They only see orders and can upload photos.

4. **Ticket System:** Workers use tickets to report problems. Admin/Master review and resolve them.

5. **User Creation Flow:**
   - You (Master) create Admins
   - Admins create Workers
   - Admins create Clients
   - Workers CANNOT create anyone

---

## ✅ Testing Checklist

- [ ] Login as Master → Can see everything, create admins
- [ ] Login as Admin → Can create workers, NOT admins
- [ ] Login as Worker → Can see orders, NO finance tab
- [ ] Worker creates ticket → Admin can see it
- [ ] Admin tries to create admin → Should fail
- [ ] Worker tries to access /api/payments → Should get 403 Forbidden

---

## 🎯 Next Steps

1. Deploy the system: `./deploy.sh`
2. Login as master: `master` / `master123`
3. Create your real admin users
4. Create worker accounts for your cleaners
5. Change the master password!

**Your system is ready with proper role hierarchy! 🎉**

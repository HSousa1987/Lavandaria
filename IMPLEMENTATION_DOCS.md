# LAVANDARIA - IMPLEMENTATION DOCUMENTATION

**Last Updated:** 2025-10-03
**Developer:** Claude (AI Assistant)

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Phase 1: Profile Editing](#phase-1-profile-editing)
3. [Phase 2: Order Management](#phase-2-order-management)
4. [Key Variables & State](#key-variables--state)
5. [API Endpoints](#api-endpoints)
6. [Testing Instructions](#testing-instructions)
7. [Troubleshooting](#troubleshooting)

---

## OVERVIEW

This document tracks all implementations done during the optimization sprint. Each phase documents:
- **What was implemented**
- **Key variables and their purposes**
- **Files modified**
- **Testing procedures**

---

## PHASE 1: PROFILE EDITING

### ✅ Completed Features

#### 1.1 Backend: User Editing with Optional Password
**File:** `routes/users.js` (lines 115-176)

**What Changed:**
- Password is now optional when editing users
- If password field is empty/blank, it won't be updated
- If password is provided, it gets hashed and updated
- Added proper error handling for duplicate usernames

**Key Variables:**
```javascript
// In PUT /api/users/:id endpoint
const { username, password, first_name, last_name, email, phone,
        date_of_birth, nif, address, is_active } = req.body;

// Password handling logic:
if (password && password.trim() !== '') {
  // Hash and update password
  const hashedPassword = await bcrypt.hash(password, 10);
  // UPDATE with password
} else {
  // UPDATE without touching password field
}
```

**Backend Validation:**
- `is_active` field: Boolean (true/false)
- Password: Only validated/required on creation, optional on update

---

#### 1.2 Frontend: User Form Enhancements
**File:** `client/src/pages/Dashboard.js`

**State Variables Added:**
```javascript
// Line 34-37: New state variables
const [viewingOrderDetail, setViewingOrderDetail] = useState(null);
const [orderDetailData, setOrderDetailData] = useState(null);
const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);

// Line 33-45: Updated userForm state
const [userForm, setUserForm] = useState({
  username: '',
  password: '',
  role: 'worker',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  nif: '',
  address: '',
  is_active: true  // ← NEW FIELD
});
```

**UI Changes:**
- **Line 992-1002:** Password field now shows placeholder when editing: "Leave blank to keep current password"
- **Line 1000:** `required={!editingUser}` - Password only required when creating new user
- **Line 1085-1095:** Added `is_active` checkbox toggle with label "Active (user can login)"
- **Line 1102:** Button text changes: "Create User" vs "Update User"

**Functions Modified:**
- `handleCreateUser()` - Line 189-210: Handles both create and update
- `handleEditUser()` - Line 213-229: Populates form with existing user data including `is_active`

---

#### 1.3 Frontend: Client Form Enhancements
**File:** `client/src/pages/Dashboard.js`

**State Variables Updated:**
```javascript
// Line 46-58: Updated clientForm state
const [clientForm, setClientForm] = useState({
  phone: '',
  first_name: '',
  last_name: '',
  email: '',
  date_of_birth: '',
  nif: '',
  address: '',
  notes: '',
  is_enterprise: false,
  company_name: '',
  is_active: true  // ← NEW FIELD
});
```

**UI Changes:**
- **Line 1252-1262:** Added `is_active` checkbox for clients
- **Line 1269:** Button text changes: "Create Client" vs "Update Client"

**Functions Modified:**
- `handleCreateClient()` - Line 232-253: Handles both create and update
- `handleEditClient()` - Line 255-271: Populates form including `is_active` field

---

## PHASE 2: ORDER MANAGEMENT

### ✅ Completed Features

#### 2.1 Backend: Enhanced Order Endpoints

**File:** `routes/laundry-orders.js`

**New Endpoint:**
```
GET /api/laundry-orders/:id/full
```

**Returns:**
```javascript
{
  order: {
    // Full order details
    id, order_number, client_id, client_name, client_phone,
    client_email, client_address, worker_name, created_by_name,
    order_type, status, total_weight_kg, price_per_kg,
    base_price, additional_charges, discount, total_price,
    payment_status, created_at, expected_ready_date, etc.
  },
  items: [
    // Array of order items (if itemized/house_bundle)
    { id, item_type, item_category, quantity, unit_price, total_price }
  ],
  payments: [
    // Array of payments for this order
    { id, amount, payment_method, payment_date, recorded_by_name }
  ],
  statusHistory: [
    // Array of status changes (from order_status_history table)
    { id, old_status, new_status, changed_at, changed_by_name }
  ]
}
```

**Lines:** 123-195

---

**File:** `routes/cleaning-jobs.js`

**New Endpoint:**
```
GET /api/cleaning-jobs/:id/full
```

**Returns:**
```javascript
{
  job: {
    // Full job details
    id, client_id, client_name, client_phone, client_email,
    client_address, worker_name, created_by_name,
    job_type, status, property_address, scheduled_date,
    scheduled_time, hourly_rate, total_cost, etc.
  },
  photos: [
    // Array of cleaning photos
    { id, photo_url, photo_type, room_area, caption,
      uploaded_at, uploaded_by_name, viewed_by_client }
  ],
  timeLogs: [
    // Array of time tracking logs
    { id, worker_name, start_time, end_time, duration_minutes }
  ],
  payments: [
    // Array of payments
    { id, amount, payment_method, payment_date }
  ]
}
```

**Lines:** 169-256

---

#### 2.2 Frontend: Order Detail Modal

**File:** `client/src/pages/Dashboard.js`

**New Functions Added:**

```javascript
// Line 389-404: View order details
const handleViewOrderDetail = async (orderId, orderType = 'laundry') => {
  // orderType: 'laundry' or 'cleaning'
  // Fetches full order details from backend
  // Sets viewingOrderDetail and orderDetailData states
}

// Line 406-409: Close modal
const handleCloseOrderDetail = () => {
  // Clears viewingOrderDetail and orderDetailData
}

// Line 411-430: Update order status
const handleUpdateOrderStatus = async (orderId, orderType, newStatus) => {
  // Updates status via API
  // Refreshes order detail view
  // orderType: 'laundry' or 'cleaning'
  // newStatus: depends on order type (see status flows below)
}
```

**Status Flows:**

**Laundry Orders:**
- `received` → `in_progress` → `ready` → `collected`
- Can also be `cancelled`

**Cleaning Jobs:**
- `scheduled` → `in_progress` → `completed`

**UI Components Added:**

**Line 992-997:** "View Details" button in Laundry Orders table
```javascript
<button
  onClick={() => handleViewOrderDetail(order.id, 'laundry')}
  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
>
  View Details
</button>
```

**Line 919-924:** "View Details" button in Cleaning Jobs table
```javascript
<button
  onClick={() => handleViewOrderDetail(job.id, 'cleaning')}
  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
>
  View Details
</button>
```

**Line 1714-2039:** Complete Order Detail Modal

**Modal Structure:**
```
┌─────────────────────────────────────┐
│ Header (Blue gradient)              │
│ - Order number / Job ID             │
│ - Close button (×)                  │
├─────────────────────────────────────┤
│ Content (Scrollable)                │
│                                     │
│ FOR LAUNDRY ORDERS:                 │
│ - Client Information                │
│ - Order Details                     │
│ - Order Items (if itemized)         │
│ - Pricing Breakdown                 │
│ - Payment History                   │
│ - Status Update Buttons             │
│                                     │
│ FOR CLEANING JOBS:                  │
│ - Client Information                │
│ - Job Details                       │
│ - Cleaning Photos (3-col grid)      │
│ - Time Tracking Logs                │
│ - Payment History                   │
│ - Status Update Buttons             │
├─────────────────────────────────────┤
│ Footer                              │
│ - Close button                      │
└─────────────────────────────────────┘
```

**Modal Features:**
1. **Loading State:** Shows spinner while fetching data (line 1718-1722)
2. **Conditional Content:** Different layouts for laundry vs cleaning (line 1749)
3. **Photo Gallery:** For cleaning jobs, displays all photos in 3-column grid (line 1892-1911)
4. **Time Tracking:** Shows worker time logs with duration (line 1914-1936)
5. **Payment History:** Displays all payments in table format (line 1941-1965)
6. **Status Buttons:** Master/Admin can update status with one click (line 1968-2023)
7. **Pricing Breakdown:** Shows base price, charges, discounts, total (line 1821-1853)

---

## KEY VARIABLES & STATE

### Frontend State Management (Dashboard.js)

```javascript
// ==================================
// USER & CLIENT MANAGEMENT
// ==================================
const [users, setUsers] = useState([]);           // All users (master/admin/worker)
const [clients, setClients] = useState([]);       // All clients
const [editingUser, setEditingUser] = useState(null);     // User being edited
const [editingClient, setEditingClient] = useState(null); // Client being edited

// Form states
const [userForm, setUserForm] = useState({
  username, password, role, first_name, last_name,
  email, phone, date_of_birth, nif, address, is_active
});

const [clientForm, setClientForm] = useState({
  phone, first_name, last_name, email, date_of_birth,
  nif, address, notes, is_enterprise, company_name, is_active
});

// ==================================
// ORDER DETAIL MODAL
// ==================================
const [viewingOrderDetail, setViewingOrderDetail] = useState(null);
// Structure: { id: number, type: 'laundry' | 'cleaning' }
// null = modal closed
// { id: 5, type: 'laundry' } = viewing laundry order #5

const [orderDetailData, setOrderDetailData] = useState(null);
// Structure varies by type:
// - Laundry: { order, items, payments, statusHistory }
// - Cleaning: { job, photos, timeLogs, payments }

const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
// true = showing loading spinner
// false = showing content

// ==================================
// ORDERS & JOBS
// ==================================
const [laundryOrdersNew, setLaundryOrdersNew] = useState([]);  // New laundry system
const [cleaningJobs, setCleaningJobs] = useState([]);          // Cleaning jobs
const [laundryOrders, setLaundryOrders] = useState([]);        // Old laundry (legacy)
const [airbnbOrders, setAirbnbOrders] = useState([]);          // Old airbnb (legacy)
```

### Backend Route Parameters

```javascript
// ==================================
// LAUNDRY ORDERS (routes/laundry-orders.js)
// ==================================

// GET /api/laundry-orders/:id/full
// Params: id (order ID)
// Returns: { order, items, payments, statusHistory }

// PATCH /api/laundry-orders/:id/status
// Params: id (order ID)
// Body: { status: 'received' | 'in_progress' | 'ready' | 'collected' | 'cancelled' }

// ==================================
// CLEANING JOBS (routes/cleaning-jobs.js)
// ==================================

// GET /api/cleaning-jobs/:id/full
// Params: id (job ID)
// Returns: { job, photos, timeLogs, payments }

// PUT /api/cleaning-jobs/:id
// Params: id (job ID)
// Body: { status: 'scheduled' | 'in_progress' | 'completed' }
```

---

## API ENDPOINTS

### Authentication Required for All Endpoints

**Session Variable:** `req.session.userType`
**Possible Values:** `'master'`, `'admin'`, `'worker'`, `'client'`

### User Management

```
GET    /api/users              - List users (role-based filtering)
GET    /api/users/:id          - Get single user
POST   /api/users              - Create user
PUT    /api/users/:id          - Update user (password optional)
DELETE /api/users/:id          - Delete user
```

### Client Management

```
GET    /api/clients            - List all clients
GET    /api/clients/:id        - Get single client
POST   /api/clients            - Create client
PUT    /api/clients/:id        - Update client
DELETE /api/clients/:id        - Delete client
```

### Laundry Orders (Enhanced)

```
GET    /api/laundry-orders              - List orders
GET    /api/laundry-orders/:id          - Get order with items
GET    /api/laundry-orders/:id/full     - Get FULL order details ← NEW
POST   /api/laundry-orders              - Create order
PUT    /api/laundry-orders/:id          - Update order
PATCH  /api/laundry-orders/:id/status   - Update status only
POST   /api/laundry-orders/:id/mark-ready - Mark ready + notify
DELETE /api/laundry-orders/:id          - Delete order
```

### Cleaning Jobs (Enhanced)

```
GET    /api/cleaning-jobs             - List jobs
GET    /api/cleaning-jobs/:id         - Get job with photos/time
GET    /api/cleaning-jobs/:id/full    - Get FULL job details ← NEW
POST   /api/cleaning-jobs             - Create job
PUT    /api/cleaning-jobs/:id         - Update job
POST   /api/cleaning-jobs/:id/start   - Start job (create time log)
POST   /api/cleaning-jobs/:id/end     - End job
POST   /api/cleaning-jobs/:id/photos  - Upload photo
DELETE /api/cleaning-jobs/:id         - Delete job
```

---

## TESTING INSTRUCTIONS

### Phase 1: Profile Editing Tests

**Open:** http://localhost:3000

#### Test 1: User Creation & Editing
1. Login as `master` / `master123`
2. Go to "All Users" tab
3. Click "Add User"
4. **Verify:** Password field is REQUIRED (has * and required attribute)
5. **Verify:** "Active (user can login)" checkbox exists and is checked by default
6. Create a test worker with username `test_worker`
7. Click "Edit" on `test_worker`
8. **Verify:** Password field shows: "Password (leave blank to keep current)"
9. **Verify:** Password field is NOT required
10. Change first name WITHOUT entering password → Click "Update User"
11. **Expected:** Update succeeds, password unchanged
12. Click "Edit" again, enter a NEW password → Click "Update User"
13. **Expected:** Password updates successfully
14. Logout and login with new password → Should work
15. Login as master again, edit `test_worker`, uncheck "Active"
16. **Expected:** User cannot login (gets "User account is inactive" error)

#### Test 2: Client Creation & Editing
1. Stay logged in as master
2. Go to "Clients" tab
3. Click "Add Client"
4. **Verify:** "Active (client can login)" checkbox exists
5. Create a test client with phone `999000000`
6. Click "Edit" on the test client
7. **Verify:** is_active checkbox shows current status
8. Toggle is_active OFF → Save
9. **Expected:** Client cannot login
10. Toggle back ON → Save
11. **Expected:** Client can login

---

### Phase 2: Order Detail Modal Tests

#### Test 3: Laundry Order Details
1. Login as `master` / `master123`
2. Go to "Laundry Orders" tab
3. Click "View Details" on any order
4. **Verify Modal Opens:**
   - Header shows order number
   - Client information section visible
   - Order details section visible
   - If itemized order: Items table displays
   - Pricing breakdown shows base price, charges, discount, total
   - Payment status badge visible
   - Status update buttons visible (Master/Admin only)
5. Click "Mark In Progress" button
6. **Expected:** Status updates, modal refreshes automatically
7. **Verify:** Status badge changes color
8. Click "Close" button
9. **Expected:** Modal closes cleanly

#### Test 4: Cleaning Job Details
1. Stay logged in as master
2. Go to "Cleaning Jobs" tab
3. Click "View Details" on any job
4. **Verify Modal Opens:**
   - Header shows Job #ID
   - Client information visible
   - Job details (property, scheduled date/time)
   - If photos exist: 3-column photo grid displays
   - Photos show type badge (before/after/detail)
   - If time logs exist: Time tracking section shows
   - Duration displayed in minutes
   - Status update buttons visible
5. Click "Mark In Progress"
6. **Expected:** Status updates
7. Click "Mark Completed"
8. **Expected:** Status changes to completed
9. Click "Close"

#### Test 5: Worker Access (Limited View)
1. Logout, login as `worker1` / `worker123`
2. Go to "Cleaning Jobs" tab
3. **Expected:** "View Details" button visible for assigned jobs
4. Click "View Details" on assigned job
5. **Expected:** Modal opens BUT no status update buttons (worker can't change status)
6. **Expected:** Can see photos, time logs, client info

---

## TROUBLESHOOTING

### Issue: Order detail modal shows "undefined" values

**Cause:** Backend endpoint returning null/missing fields

**Fix:**
1. Check Docker logs: `docker-compose logs -f app`
2. Look for SQL errors in console
3. Verify order/job exists: `docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT * FROM laundry_orders_new WHERE id=1;"`
4. Check API response in browser DevTools Network tab

---

### Issue: Password update not working

**Cause:** Password field validation issue

**Debug:**
1. Open browser DevTools → Network tab
2. Edit user and submit
3. Check request payload - is `password` field empty string or missing?
4. Check response - any errors?
5. Backend logs: `docker-compose logs -f app`

**Expected Behavior:**
- Empty password = don't update password field in DB
- Non-empty password = hash and update

---

### Issue: Modal not opening

**Cause:** Frontend state not updating

**Debug:**
1. Open browser DevTools → Console
2. Look for errors when clicking "View Details"
3. Add console.log in `handleViewOrderDetail`:
   ```javascript
   console.log('Fetching order:', orderId, orderType);
   console.log('Response:', res.data);
   ```
4. Check if `viewingOrderDetail` state is being set
5. Check if API call succeeds (Network tab)

---

### Issue: Status update not working

**Cause:** Wrong endpoint or status value

**Debug:**
1. Check endpoint in browser Network tab
2. Verify status value is correct for order type
3. Laundry: `received`, `in_progress`, `ready`, `collected`, `cancelled`
4. Cleaning: `scheduled`, `in_progress`, `completed`
5. Check backend logs for errors

---

### Issue: Photos not displaying

**Cause:** Photo URL path incorrect or file missing

**Debug:**
1. Check photo URL in API response: should be `/uploads/cleaning_photos/filename.jpg`
2. Verify file exists: `docker exec lavandaria-app ls -la /app/uploads/cleaning_photos/`
3. Check if nginx/express serving static files correctly
4. Try accessing photo directly: `http://localhost:3000/uploads/cleaning_photos/filename.jpg`

---

## DATABASE SCHEMA NOTES

### Users Table (Important Fields)
```sql
id, username, password, role (master/admin/worker),
full_name, first_name, last_name, email, phone,
date_of_birth, nif, address, is_active, created_at
```

### Clients Table (Important Fields)
```sql
id, phone (unique), password, full_name, first_name, last_name,
email, date_of_birth, nif, address, is_active,
is_enterprise, company_name, notes, created_at
```

### Laundry Orders (laundry_orders_new)
```sql
id, client_id, order_number (unique), order_type (bulk_kg/itemized/house_bundle),
status (received/in_progress/ready/collected/cancelled),
total_weight_kg, price_per_kg, base_price, additional_charges,
discount, total_price, payment_status (pending/paid),
expected_ready_date, assigned_worker_id, created_by
```

### Cleaning Jobs
```sql
id, client_id, job_type (airbnb/house/commercial),
status (scheduled/in_progress/completed),
property_address, scheduled_date, scheduled_time,
assigned_worker_id, hourly_rate, total_cost, created_by
```

### Cleaning Job Photos
```sql
id, cleaning_job_id, worker_id, photo_url, photo_type (before/after/detail),
room_area, caption, viewed_by_client, uploaded_at
```

### Cleaning Time Logs
```sql
id, cleaning_job_id, worker_id, start_time, end_time,
duration_minutes, start_latitude, start_longitude, notes
```

---

## NEXT PHASES (TODO)

### Phase 3: Client Photo Gallery
- [ ] Client dashboard photo viewing
- [ ] Before/After photo comparison slider
- [ ] Photo download functionality
- [ ] New photos badge notification

### Phase 4: Worker Calendar
- [ ] Backend: GET /api/calendar/worker/:id
- [ ] Backend: GET /api/calendar/today
- [ ] Frontend: Weekly calendar view
- [ ] Frontend: "Today's Jobs" dashboard widget

### Phase 5: Enhanced Analytics
- [ ] Backend: Revenue graph endpoint
- [ ] Backend: Worker stats endpoint
- [ ] Frontend: Chart.js/Recharts integration
- [ ] Frontend: Dashboard widgets

### Phase 6: Payment Integration
- [ ] Backend: Auto-create payment on "mark paid"
- [ ] Backend: Outstanding balance calculation
- [ ] Frontend: Payment recording UI
- [ ] Frontend: Invoice generation

---

## FILE CHANGE LOG

```
BACKEND (Node.js/Express):
├── routes/users.js                    ← Modified (optional password)
├── routes/laundry-orders.js           ← Modified (added /full endpoint)
└── routes/cleaning-jobs.js            ← Modified (added /full endpoint)

FRONTEND (React):
└── client/src/pages/Dashboard.js      ← Major modifications
    ├── Added order detail modal (350+ lines)
    ├── Updated userForm state (is_active)
    ├── Updated clientForm state (is_active)
    ├── Added 3 new functions (view/close/update order)
    └── Added "View Details" buttons to tables
```

---

## DEPLOYMENT NOTES

**After any code changes:**

```bash
# 1. Build React frontend
cd /Applications/XAMPP/xamppfiles/htdocs/Lavandaria/client
npm run build

# 2. Restart Docker containers
cd /Applications/XAMPP/xamppfiles/htdocs/Lavandaria
docker-compose restart app

# 3. Check logs
docker-compose logs -f app

# 4. Verify database connection
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT NOW();"
```

**Quick restart (development):**
```bash
docker-compose restart app && sleep 3 && docker-compose logs --tail=20 app
```

---

## CONTACT & SUPPORT

**System:** Lavandaria Management System
**Environment:** Docker (Ubuntu containers on macOS)
**Database:** PostgreSQL 16
**Backend:** Node.js 20 + Express
**Frontend:** React 19

**Access URLs:**
- Frontend: http://localhost:3000
- API: http://localhost:3000/api
- Database: localhost:5432

**Default Credentials:**
- Master: `master` / `master123`
- Admin: `admin` / `admin123`
- Worker: `worker1` / `worker123`
- Client: `911111111` / `lavandaria2025`

---

**END OF DOCUMENTATION**

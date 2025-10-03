# LAVANDARIA - QUICK REFERENCE GUIDE

**Last Updated:** 2025-10-03

---

## 🚀 QUICK START

```bash
# Start everything
./deploy.sh

# Rebuild frontend
cd client && npm run build && cd ..

# Restart backend
docker-compose restart app

# View logs
docker-compose logs -f app

# Access database
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria
```

---

## 🔑 KEY STATE VARIABLES (Dashboard.js)

### Order Detail Modal States

```javascript
// Modal control
viewingOrderDetail = null | { id: number, type: 'laundry' | 'cleaning' }
orderDetailData = null | { order, items, payments } | { job, photos, timeLogs, payments }
loadingOrderDetail = boolean

// Usage:
handleViewOrderDetail(orderId, 'laundry')  // Open modal
handleCloseOrderDetail()                    // Close modal
handleUpdateOrderStatus(id, type, status)   // Update status
```

### Form States

```javascript
// User management
userForm = {
  username, password, role, first_name, last_name,
  email, phone, date_of_birth, nif, address,
  is_active  // ← NEW: Boolean
}
editingUser = null | user_object

// Client management
clientForm = {
  phone, first_name, last_name, email, date_of_birth,
  nif, address, notes, is_enterprise, company_name,
  is_active  // ← NEW: Boolean
}
editingClient = null | client_object
```

---

## 📡 NEW API ENDPOINTS

### Laundry Orders - Full Details
```
GET /api/laundry-orders/:id/full

Response:
{
  order: { ...order_fields, client_name, worker_name, created_by_name },
  items: [ { id, item_type, quantity, unit_price, total_price } ],
  payments: [ { id, amount, payment_method, payment_date } ],
  statusHistory: [ { old_status, new_status, changed_at, changed_by_name } ]
}
```

### Cleaning Jobs - Full Details
```
GET /api/cleaning-jobs/:id/full

Response:
{
  job: { ...job_fields, client_name, worker_name, created_by_name },
  photos: [ { id, photo_url, photo_type, room_area, uploaded_at } ],
  timeLogs: [ { id, worker_name, start_time, end_time, duration_minutes } ],
  payments: [ { id, amount, payment_method, payment_date } ]
}
```

---

## 🎯 ORDER STATUS FLOWS

### Laundry Orders
```
received → in_progress → ready → collected
                      ↓
                  cancelled
```

**Valid statuses:**
- `received` - Order received from client
- `in_progress` - Being processed
- `ready` - Ready for pickup
- `collected` - Client picked up
- `cancelled` - Order cancelled

### Cleaning Jobs
```
scheduled → in_progress → completed
```

**Valid statuses:**
- `scheduled` - Job scheduled
- `in_progress` - Worker on site
- `completed` - Job finished

---

## 🧪 TESTING CHECKLIST

### ✅ Phase 1: Profile Editing
- [ ] Create user with is_active = true
- [ ] Edit user WITHOUT password → works
- [ ] Edit user WITH password → updates
- [ ] Toggle is_active OFF → user cannot login
- [ ] Create client with is_active checkbox
- [ ] Edit client and toggle is_active

### ✅ Phase 2: Order Detail Modal
- [ ] Click "View Details" on laundry order → modal opens
- [ ] Modal shows: client info, items, pricing, payments
- [ ] Click status update button → status changes
- [ ] Click "View Details" on cleaning job → modal opens
- [ ] Modal shows: photos, time logs, job details
- [ ] Worker login → View Details works (no status buttons)
- [ ] Close modal → closes cleanly

---

## 🐛 COMMON ISSUES & FIXES

### Modal shows "undefined"
```bash
# Check API response
docker-compose logs -f app | grep "GET.*full"

# Check database
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria
SELECT * FROM laundry_orders_new WHERE id=1;
```

### Password update not working
```javascript
// Check browser DevTools → Network → Request Payload
// Should see: { password: "" }  OR  { password: "newpass" }

// Backend checks:
if (password && password.trim() !== '') {
  // Updates password
} else {
  // Skips password field
}
```

### Build errors
```bash
# Clear cache and rebuild
cd client
rm -rf node_modules package-lock.json build
npm install
npm run build
```

---

## 📊 DATABASE QUICK QUERIES

```sql
-- View all users
SELECT id, username, role, full_name, is_active FROM users;

-- View all clients
SELECT id, phone, full_name, is_active FROM clients;

-- View laundry orders with status
SELECT id, order_number, status, total_price, payment_status
FROM laundry_orders_new
ORDER BY created_at DESC LIMIT 10;

-- View cleaning jobs
SELECT id, job_type, status, property_address, scheduled_date
FROM cleaning_jobs
ORDER BY scheduled_date DESC LIMIT 10;

-- View cleaning photos
SELECT cj.id as job_id, cj.property_address, COUNT(p.id) as photo_count
FROM cleaning_jobs cj
LEFT JOIN cleaning_job_photos p ON p.cleaning_job_id = cj.id
GROUP BY cj.id, cj.property_address;

-- View time logs
SELECT tl.*, u.full_name as worker, cj.property_address
FROM cleaning_time_logs tl
JOIN users u ON tl.worker_id = u.id
JOIN cleaning_jobs cj ON tl.cleaning_job_id = cj.id
ORDER BY tl.start_time DESC LIMIT 10;
```

---

## 📁 KEY FILES

### Backend
```
routes/users.js              - User CRUD (optional password on edit)
routes/laundry-orders.js     - Laundry orders + /full endpoint
routes/cleaning-jobs.js      - Cleaning jobs + /full endpoint
middleware/permissions.js    - Role-based access control
```

### Frontend
```
client/src/pages/Dashboard.js       - Main dashboard (2044 lines)
client/src/context/AuthContext.js   - Authentication state
client/src/components/ProtectedRoute.js - Route protection
```

### Database
```
database/init.sql            - Initial schema
database/migrations/         - Schema updates
```

---

## 🎨 MODAL STYLING CLASSES

```javascript
// Modal overlay
className="fixed inset-0 bg-black bg-opacity-50 z-50"

// Modal container
className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"

// Header (blue gradient)
className="p-6 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white"

// Status badges
className={`px-2 py-1 text-xs rounded ${
  status === 'completed' ? 'bg-green-100 text-green-700' :
  status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
  'bg-gray-100 text-gray-700'
}`}
```

---

## 🔐 AUTHENTICATION

### Session Variables
```javascript
req.session.userType     // 'master' | 'admin' | 'worker'
req.session.userId       // User ID (for staff)
req.session.clientId     // Client ID (for clients)
```

### Middleware
```javascript
requireAuth              // Any authenticated user
requireMaster            // Master only
requireMasterOrAdmin     // Master or Admin
requireStaff             // Master, Admin, or Worker
requireClient            // Client only
requireFinanceAccess     // Master or Admin (NO workers)
```

---

## 🚦 STATUS CODE MEANINGS

```
200 - OK (Success)
201 - Created (Resource created)
304 - Not Modified (Cached)
400 - Bad Request (Validation error)
401 - Unauthorized (Not logged in)
403 - Forbidden (Wrong role/permissions)
404 - Not Found (Resource doesn't exist)
500 - Server Error (Backend crash)
```

---

## 📞 FUNCTIONS REFERENCE

### Dashboard.js Key Functions

```javascript
// Data fetching
fetchData()                              // Loads all data (users, clients, orders)

// User management
handleCreateUser(e)                      // Create or update user
handleEditUser(user)                     // Open edit form
handleDeleteUser(userId)                 // Delete user

// Client management
handleCreateClient(e)                    // Create or update client
handleEditClient(client)                 // Open edit form

// Order detail modal (NEW)
handleViewOrderDetail(id, type)          // Open modal (type: 'laundry' | 'cleaning')
handleCloseOrderDetail()                 // Close modal
handleUpdateOrderStatus(id, type, status) // Update order status

// Order operations
handleMarkReady(orderId)                 // Mark laundry ready + notify
```

---

## 🔄 STATE UPDATE PATTERNS

### Opening Order Detail Modal
```javascript
// 1. User clicks "View Details"
onClick={() => handleViewOrderDetail(order.id, 'laundry')}

// 2. Function sets loading state
setLoadingOrderDetail(true);
setViewingOrderDetail({ id: orderId, type: orderType });

// 3. Fetches data from API
const res = await axios.get(`/api/laundry-orders/${orderId}/full`);

// 4. Updates data state
setOrderDetailData(res.data);
setLoadingOrderDetail(false);

// 5. Modal renders with data
{viewingOrderDetail && (
  <div className="modal">
    {loadingOrderDetail ? <Spinner /> : <Content />}
  </div>
)}
```

### Updating Order Status
```javascript
// 1. User clicks status button
onClick={() => handleUpdateOrderStatus(id, 'laundry', 'ready')}

// 2. Function calls API
await axios.patch(`/api/laundry-orders/${id}/status`, { status: 'ready' });

// 3. Refreshes main data
fetchData();

// 4. Refreshes modal view
handleViewOrderDetail(id, 'laundry');

// 5. Shows success message
setSuccess('Status updated successfully');
```

---

## 💡 PRO TIPS

1. **Always check Docker logs when debugging:**
   ```bash
   docker-compose logs -f app | grep ERROR
   ```

2. **Use browser DevTools Network tab to see API calls:**
   - Check request payload
   - Check response data
   - Look for error messages

3. **Test with different user roles:**
   - Master sees everything
   - Admin sees workers only
   - Worker has limited access
   - Client only sees own data

4. **Modal not updating? Check these:**
   - `viewingOrderDetail` state set correctly?
   - `orderDetailData` has data?
   - API endpoint returning data?
   - Console errors in browser?

5. **Password not updating? Remember:**
   - Empty string = don't update
   - Filled string = hash and update
   - Backend checks `password && password.trim() !== ''`

---

**END OF QUICK REFERENCE**

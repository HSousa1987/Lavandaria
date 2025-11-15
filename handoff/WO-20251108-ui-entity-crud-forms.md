# 🏗️ Work Order: UI Entity Creation & CRUD Forms

**WO ID**: WO-20251108-UI-CRUD
**Priority**: P0 - CRITICAL BLOCKER
**Assigned to**: Developer Agent
**Created**: 2025-11-08
**Discovered by**: Maestro E2E Baseline Testing

---

## 🚨 PROBLEM STATEMENT

**Current State**: The Lavandaria system has **ZERO UI interfaces** for creating entities. Users can view existing data but cannot create new:
- Admin users
- Worker users
- Client users
- Cleaning jobs
- Laundry orders
- Laundry services

**Evidence**:
- E2E test suite: 17/60 tests fail due to missing "Add User", "Create Job" buttons
- Dashboard.js: No `Add` or `Create` buttons found in entire component
- No Form or Modal components exist in `client/src/components/`

**Impact**: **100% of user onboarding and job creation workflows are blocked**

---

## 🎯 OBJECTIVES

Build complete UI workflows for entity CRUD operations accessible from the Dashboard:

1. ✅ **User Management** (Master/Admin only)
   - Create Admin users (Master only)
   - Create Worker users (Master/Admin)
   - Edit user profiles
   - Delete users (soft delete)

2. ✅ **Client Management** (Master/Admin only)
   - Create clients
   - Edit client details
   - View client order history
   - Delete clients (soft delete)

3. ✅ **Cleaning Job Management** (Master/Admin)
   - Create cleaning jobs
   - Assign workers to jobs
   - Update job status (scheduled → in_progress → completed)
   - Delete jobs (soft delete)

4. ✅ **Laundry Order Management** (Master/Admin)
   - Create laundry orders
   - Select services from catalog
   - Update order status (received → in_progress → ready → collected)
   - Delete orders (soft delete)

5. ✅ **Service Management** (Master/Admin only)
   - Create laundry services
   - Edit service pricing
   - Activate/deactivate services

---

## 📋 ACCEPTANCE CRITERIA

### Must Have (P0)

**User Workflows**:
- [ ] Master logs in → clicks "Users" tab → clicks "Add User" button → modal opens
- [ ] Modal has fields: Username, Password, Role dropdown (Admin/Worker), Phone
- [ ] Form validates: Username required, Password min 8 chars, Phone format
- [ ] Clicking "Save" sends POST `/api/users` → shows success message with correlation ID
- [ ] Success closes modal and refreshes user list
- [ ] Error shows message: "Error creating user (req_123456): [error message]"

**Client Workflows**:
- [ ] Admin logs in → clicks "Clients" tab → clicks "Add Client" button → modal opens
- [ ] Modal has fields: Name, Phone, Email, Address, Notes
- [ ] Form validates: Name required, Phone format (9 digits), Email format
- [ ] Clicking "Save" sends POST `/api/clients` → shows success with correlation ID
- [ ] Success closes modal and refreshes client list

**Cleaning Job Workflows**:
- [ ] Admin logs in → clicks "Cleaning Jobs" tab → clicks "Create Job" button → modal opens
- [ ] Modal has fields: Client (searchable dropdown), Job Type (airbnb/house), Address, Date, Time, Assigned Worker (dropdown)
- [ ] Form validates: Client required, Job Type required, Date/Time required
- [ ] Clicking "Save" sends POST `/api/cleaning-jobs` → shows success with correlation ID
- [ ] Success closes modal and refreshes job list

**Laundry Order Workflows**:
- [ ] Admin logs in → clicks "Laundry Orders" tab → clicks "Create Order" button → modal opens
- [ ] Modal has fields: Client (searchable dropdown), Service (multi-select from catalog), Weight (if bulk_kg), Pickup Date
- [ ] Services fetched from GET `/api/laundry-services` (must fix 500 error first!)
- [ ] Form calculates total price based on selected services
- [ ] Clicking "Save" sends POST `/api/laundry-orders` → shows success with correlation ID
- [ ] Success closes modal and refreshes order list

### Edit Workflows (P0)

- [ ] Every list view has "Edit" button/icon per row
- [ ] Clicking "Edit" opens same modal as "Add" but pre-filled with existing data
- [ ] Clicking "Save" sends PUT `/api/{entity}/{id}` → shows success message
- [ ] Changed fields highlighted or logged in correlation ID context

### Delete Workflows (P1)

- [ ] Every list view has "Delete" button/icon per row
- [ ] Clicking "Delete" shows confirmation modal: "Are you sure you want to delete [Entity Name]?"
- [ ] Confirmation modal shows warning for cascading effects (e.g., "Deleting this client will also delete X jobs")
- [ ] Clicking "Confirm Delete" sends DELETE `/api/{entity}/{id}` → shows success message
- [ ] Soft delete preferred (set `is_active = false`) over hard delete

### Status Update Workflows (P0)

**Cleaning Jobs**:
- [ ] Job card/row has status dropdown or buttons: Scheduled, In Progress, Completed, Cancelled
- [ ] Clicking status sends PUT `/api/cleaning-jobs/{id}` with `{ status: "new_status" }`
- [ ] Status change shows success message with correlation ID
- [ ] Completed jobs show "View Photos" button (if photos uploaded)

**Laundry Orders**:
- [ ] Order card/row has status dropdown or buttons: Received, In Progress, Ready, Collected, Cancelled
- [ ] Clicking "Ready" triggers notification to client (future: email/SMS)
- [ ] Status change shows success message with correlation ID

---

## 🛠️ IMPLEMENTATION GUIDE

### Step 1: Fix Laundry Services 500 Error (PREREQUISITE)

**File**: `routes/laundry-services.js`

**Current Error**:
```
GET /api/laundry-services 500 Internal Server Error
Error: column "service_code" does not exist
```

**Fix**:
```javascript
// Find the query using service_code and change to:
const result = await pool.query(`
  SELECT id, name, service_type, base_price, unit,
         estimated_duration_minutes, description, is_active
  FROM laundry_services
  WHERE is_active = true
  ORDER BY service_type, name
`);
```

**Test**:
```bash
curl http://localhost:3000/api/laundry-services
# Should return 200 OK with service list
```

---

### Step 2: Create Reusable Modal Component

**File to create**: `client/src/components/Modal.js`

```javascript
import React from 'react';

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
```

---

### Step 3: Create User Form Component

**File to create**: `client/src/components/forms/UserForm.js`

```javascript
import React, { useState } from 'react';
import axios from 'axios';

const UserForm = ({ onSuccess, onCancel, editUser = null }) => {
  const [formData, setFormData] = useState({
    username: editUser?.username || '',
    password: editUser ? '' : '', // Don't pre-fill password on edit
    role: editUser?.role || 'worker',
    phone: editUser?.phone || ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = editUser
        ? `/api/users/${editUser.id}`
        : '/api/users';
      const method = editUser ? 'put' : 'post';

      const response = await axios[method](endpoint, formData);

      if (response.data.success) {
        console.log(`✅ User ${editUser ? 'updated' : 'created'} with correlation ID:`, response.data._meta.correlationId);
        onSuccess(response.data.data);
      }
    } catch (err) {
      const correlationId = err.response?.data?._meta?.correlationId || 'unknown';
      setError(`Error: ${err.response?.data?.error || err.message} (${correlationId})`);
      console.error('❌ User form error:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Username *</label>
        <input
          type="text"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          disabled={!!editUser} // Can't change username on edit
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Password {editUser ? '(leave blank to keep current)' : '*'}
        </label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required={!editUser}
          minLength={8}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Role *</label>
        <select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="admin">Admin</option>
          <option value="worker">Worker</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Phone *</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          required
          pattern="[0-9]{9}"
          placeholder="912345678"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
        <p className="mt-1 text-sm text-gray-500">9 digits, Portuguese format</p>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Saving...' : editUser ? 'Update User' : 'Create User'}
        </button>
      </div>
    </form>
  );
};

export default UserForm;
```

---

### Step 4: Create Client Form Component

**File to create**: `client/src/components/forms/ClientForm.js`

```javascript
import React, { useState } from 'react';
import axios from 'axios';

const ClientForm = ({ onSuccess, onCancel, editClient = null }) => {
  const [formData, setFormData] = useState({
    name: editClient?.name || '',
    phone: editClient?.phone || '',
    email: editClient?.email || '',
    address: editClient?.address || '',
    notes: editClient?.notes || ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = editClient
        ? `/api/clients/${editClient.id}`
        : '/api/clients';
      const method = editClient ? 'put' : 'post';

      const response = await axios[method](endpoint, formData);

      if (response.data.success) {
        console.log(`✅ Client ${editClient ? 'updated' : 'created'} with correlation ID:`, response.data._meta.correlationId);
        onSuccess(response.data.data);
      }
    } catch (err) {
      const correlationId = err.response?.data?._meta?.correlationId || 'unknown';
      setError(`Error: ${err.response?.data?.error || err.message} (${correlationId})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Phone *</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          required
          pattern="[0-9]{9}"
          placeholder="912345678"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Address</label>
        <textarea
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Saving...' : editClient ? 'Update Client' : 'Create Client'}
        </button>
      </div>
    </form>
  );
};

export default ClientForm;
```

---

### Step 5: Integrate Forms into Dashboard

**File to modify**: `client/src/pages/Dashboard.js`

**Add these imports at the top**:
```javascript
import Modal from '../components/Modal';
import UserForm from '../components/forms/UserForm';
import ClientForm from '../components/forms/ClientForm';
```

**Add state for modals** (inside Dashboard component):
```javascript
const [modals, setModals] = useState({
  addUser: false,
  editUser: null,
  addClient: false,
  editClient: null,
  addJob: false,
  editJob: null
});
```

**Add "Add User" button** (in the Users tab section):
```javascript
{activeTab === 'users' && (
  <div className="mb-4 flex justify-between items-center">
    <h3 className="text-xl font-semibold">Users</h3>
    {(user.userType === 'master' || user.userType === 'admin') && (
      <button
        onClick={() => setModals({ ...modals, addUser: true })}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
      >
        <span className="mr-2">+</span> Add User
      </button>
    )}
  </div>
)}
```

**Add Modal rendering** (before the closing return statement):
```javascript
{/* Add User Modal */}
<Modal
  isOpen={modals.addUser}
  onClose={() => setModals({ ...modals, addUser: false })}
  title="Create New User"
>
  <UserForm
    onSuccess={(newUser) => {
      setModals({ ...modals, addUser: false });
      // Refresh user list
      fetchUsers();
    }}
    onCancel={() => setModals({ ...modals, addUser: false })}
  />
</Modal>

{/* Add Client Modal */}
<Modal
  isOpen={modals.addClient}
  onClose={() => setModals({ ...modals, addClient: false })}
  title="Create New Client"
>
  <ClientForm
    onSuccess={(newClient) => {
      setModals({ ...modals, addClient: false });
      // Refresh client list
      fetchClients();
    }}
    onCancel={() => setModals({ ...modals, addClient: false })}
  />
</Modal>
```

**Repeat this pattern for**:
- "Add Client" button in Clients tab
- "Create Cleaning Job" button in Cleaning Jobs tab
- "Create Laundry Order" button in Laundry Orders tab

---

### Step 6: Add Edit/Delete Buttons to List Views

**For each list item** (users, clients, jobs, orders), add action buttons:

```javascript
<div className="flex space-x-2">
  <button
    onClick={() => setModals({ ...modals, editUser: user })}
    className="text-blue-600 hover:text-blue-800"
    aria-label="Edit user"
  >
    ✏️ Edit
  </button>
  <button
    onClick={() => handleDelete('user', user.id, user.username)}
    className="text-red-600 hover:text-red-800"
    aria-label="Delete user"
  >
    🗑️ Delete
  </button>
</div>
```

**Delete handler**:
```javascript
const handleDelete = async (entityType, id, name) => {
  const confirmed = window.confirm(`Are you sure you want to delete ${name}?`);
  if (!confirmed) return;

  try {
    const endpoints = {
      user: '/api/users',
      client: '/api/clients',
      job: '/api/cleaning-jobs',
      order: '/api/laundry-orders'
    };

    const response = await axios.delete(`${endpoints[entityType]}/${id}`);

    if (response.data.success) {
      console.log(`✅ ${entityType} deleted with correlation ID:`, response.data._meta.correlationId);
      // Refresh list
      switch(entityType) {
        case 'user': fetchUsers(); break;
        case 'client': fetchClients(); break;
        case 'job': fetchJobs(); break;
        case 'order': fetchOrders(); break;
      }
    }
  } catch (err) {
    const correlationId = err.response?.data?._meta?.correlationId || 'unknown';
    alert(`Error deleting ${entityType}: ${err.response?.data?.error} (${correlationId})`);
  }
};
```

---

## ✅ TESTING CHECKLIST

### Developer Self-Test (Before PR)

**User Management**:
- [ ] Login as Master → Add Admin user → See success message with correlation ID
- [ ] Verify new admin appears in user list
- [ ] Login as new admin → Verify dashboard loads
- [ ] Edit admin user → Change phone → See success message
- [ ] Delete admin user → Confirm → See success message

**Client Management**:
- [ ] Login as Admin → Add client → See success message
- [ ] Verify client appears in client list
- [ ] Edit client → Change email → See success message
- [ ] Try to delete client with jobs → See warning about cascade

**Cleaning Job Management**:
- [ ] Login as Admin → Create cleaning job → Select client, worker, date → See success
- [ ] Verify job appears in job list
- [ ] Change job status to "In Progress" → See success
- [ ] Change job status to "Completed" → See success

**Laundry Order Management**:
- [ ] Verify GET /api/laundry-services returns 200 OK (service_code fix applied)
- [ ] Login as Admin → Create laundry order → Select client, services → See total price calculated
- [ ] Verify order appears in order list
- [ ] Change order status to "Ready" → See success

### Browser Validation (Manual)

- [ ] Open DevTools Console → No errors during form operations
- [ ] Open DevTools Network → All requests return 200/201 with correlation IDs
- [ ] All success messages display correlation ID
- [ ] All error messages display correlation ID
- [ ] Forms validate required fields (can't submit empty)
- [ ] Forms validate phone format (must be 9 digits)
- [ ] Forms validate email format
- [ ] Modals close on "Cancel" without saving
- [ ] Modals close on success after saving

---

## 📦 DELIVERABLES

### Code Files to Create

1. ✅ `client/src/components/Modal.js`
2. ✅ `client/src/components/forms/UserForm.js`
3. ✅ `client/src/components/forms/ClientForm.js`
4. ✅ `client/src/components/forms/CleaningJobForm.js`
5. ✅ `client/src/components/forms/LaundryOrderForm.js`
6. ✅ `client/src/components/forms/ServiceForm.js` (optional P2)

### Code Files to Modify

1. ✅ `client/src/pages/Dashboard.js` - Add buttons, modals, handlers
2. ✅ `routes/laundry-services.js` - Fix service_code 500 error

### Documentation Updates

1. ✅ Update `docs/progress.md` - Record completion with PR link
2. ✅ Update `docs/decisions.md` - Document UI form patterns chosen
3. ✅ Update `docs/bugs.md` - Record laundry services 500 fix

### Pull Request

**Branch**: `feat/ui-entity-crud-forms`

**Commit Message**:
```
feat(P0): Add UI entity creation and CRUD forms

- Created reusable Modal component for all forms
- Implemented UserForm for Admin/Worker creation
- Implemented ClientForm for client management
- Implemented CleaningJobForm for job creation
- Implemented LaundryOrderForm for order creation
- Integrated all forms into Dashboard with Add buttons
- Added Edit/Delete buttons to all list views
- Fixed laundry-services 500 error (service_code column)

BREAKING CHANGES:
- Laundry services query no longer uses service_code column

Fixes: #TBD
Closes: WO-20251108-UI-CRUD

Evidence:
- Browser validation video: [attach]
- Network tab showing correlation IDs: [attach]
- All CRUD operations tested manually

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 🎯 ACCEPTANCE VALIDATION

Once PR is submitted, Tester will validate using:
- `tests/e2e/maestro-full-crud-validation.spec.js` (created by Maestro)
- Manual browser testing checklist (above)

**Expected Test Results**:
- All "Golden Path" tests pass ✅
- All user CRUD tests pass ✅
- All client CRUD tests pass ✅
- All job CRUD tests pass ✅
- All order CRUD tests pass ✅
- Overall E2E pass rate: **95%+** (up from current 71.7%)

---

**Estimated Effort**: 6-8 hours
**Blocking**: Yes - Blocks all user onboarding and job creation workflows
**Dependencies**: None (can start immediately)


# Work Order: Frontend V2 Schema Critical Fix (P0 Blockers)

**Date**: 2025-11-15
**Work Order ID**: WO-20251115-DEV-FRONTEND-V2-FIX
**Assigned To**: Developer Agent (Claude Haiku)
**Priority**: P0 (CRITICAL BLOCKER - Frontend completely broken)
**Estimated Complexity**: Medium (Frontend component fixes only, backend already complete)
**Previous Work Order**: WO-20251114-PROPERTY-MANAGEMENT-DEVELOPER (NOT executed)

---

## Executive Summary

**CRITICAL**: The V2 database migration is complete, but the **frontend was never updated**. Tester validation revealed that:

1. ❌ Users table shows **empty Name column** (accessing V1 `first_name` field instead of V2 `name` field)
2. ❌ Clients table shows **empty Name column** (same V1/V2 mismatch)
3. ❌ **NO modal components exist** - cannot create/edit users, clients, or properties via WebUI
4. ✅ Database has correct V2 data with populated `name` fields

**This work order is a REDUCED SCOPE version** of the original property management work order. It focuses ONLY on:
- **Phase 1**: Fix V1/V2 field name mismatch in existing tables (quick win)
- **Phase 2**: Create missing modal components (critical for CRUD operations)
- **Phase 3**: Docker rebuild and smoke test

**Original comprehensive property management system (properties CRUD, side-by-side forms) is DEFERRED to next work order** after these P0 blockers are fixed.

---

## Tester Report Summary

**Source**: `handoff/PROPERTY-MGMT-TEST-REPORT-20251114.md`

**Test Results**: 20% Pass Rate (1/5 P0 criteria met)

**P0 Issues Found**:
- **P0-1**: UserModal component missing
- **P0-2**: ClientModal component missing
- **P0-3**: PropertyListModal component missing (deferred)
- **P0-4**: PropertyFormModal component missing (deferred)
- **P0-5**: Frontend displays empty Name fields (V1/V2 mismatch) ← **THIS WORK ORDER**
- **P0-6**: Tab navigation unreliable (minor, deferred)

**What IS Working**:
- ✅ Database V2 schema correct
- ✅ Backend routes updated to V2 (clients.js, users.js, cleaning-jobs.js)
- ✅ No JavaScript console errors
- ✅ Login functionality works

---

## Phase 1: Fix V1/V2 Field Name Mismatch (QUICK WIN)

### Problem Statement

**Current State**:
- Users table displays empty Name column
- Clients table displays empty Name column
- Database has correct V2 data: `name='Master User'`, `name='Test Client'`

**Root Cause**:
Frontend code is accessing V1 field names from API responses:
```javascript
// WRONG (V1 schema)
user.first_name or user.full_name or user.last_name

// CORRECT (V2 schema)
user.name
```

**Evidence**:
- Screenshot: `.playwright-mcp/test-results/issue-user-modal-not-opening.png`
- Screenshot: `.playwright-mcp/test-results/issue-clients-name-missing.png`

---

### Task 1.1: Find Frontend Table Rendering Code

**Objective**: Locate where Users and Clients tables are rendered

**Steps**:
1. Search for file rendering users table:
   ```bash
   cd client/src
   grep -r "All Users" --include="*.js" --include="*.jsx"
   # OR
   grep -r "Users" pages/ components/ --include="*.js"
   ```

2. Search for file rendering clients table:
   ```bash
   grep -r "Clients" pages/ components/ --include="*.js"
   ```

3. **Expected Files** (based on typical React structure):
   - `client/src/pages/Dashboard.js` (most likely)
   - OR `client/src/components/UserList.js` / `client/src/components/ClientList.js`

---

### Task 1.2: Fix Users Table Rendering

**File**: Identified in Task 1.1 (likely `Dashboard.js` or `UserList.js`)

**Current Code** (example - adapt to actual structure):
```jsx
{users.map(user => (
    <tr key={user.id}>
        <td>{user.first_name} {user.last_name}</td>  {/* V1 fields */}
        <td>{user.email}</td>
        <td>{user.role}</td>
    </tr>
))}
```

**Fixed Code**:
```jsx
{users.map(user => (
    <tr key={user.id}>
        <td>{user.name}</td>  {/* V2 single name field */}
        <td>{user.email}</td>
        <td>{user.role_name || user.role}</td>  {/* V2 uses role_name from JOIN */}
    </tr>
))}
```

**Search Pattern**:
Look for ALL occurrences of:
- `user.first_name`
- `user.last_name`
- `user.full_name`
- `{user.first_name} {user.last_name}`

Replace with:
- `user.name`

**Verification**:
After fix, Users table should display:
- Master User
- Admin User
- Test Worker

---

### Task 1.3: Fix Clients Table Rendering

**File**: Identified in Task 1.1 (likely `Dashboard.js` or `ClientList.js`)

**Current Code** (example):
```jsx
{clients.map(client => (
    <tr key={client.id}>
        <td>{client.first_name} {client.last_name}</td>  {/* V1 fields */}
        <td>{client.phone}</td>
        <td>{client.email}</td>
    </tr>
))}
```

**Fixed Code**:
```jsx
{clients.map(client => (
    <tr key={client.id}>
        <td>{client.name}</td>  {/* V2 single name field */}
        <td>{client.phone}</td>
        <td>{client.email}</td>
    </tr>
))}
```

**Search Pattern**:
Look for ALL occurrences of:
- `client.first_name`
- `client.last_name`
- `client.full_name`

Replace with:
- `client.name`

**Verification**:
After fix, Clients table should display:
- Test Client

---

### Task 1.4: Global Search for V1 Field References

**Objective**: Ensure NO V1 field references remain anywhere in frontend

**Commands**:
```bash
cd client/src

# Search for all V1 user field references
grep -r "\.first_name" --include="*.js" --include="*.jsx"
grep -r "\.last_name" --include="*.js" --include="*.jsx"
grep -r "\.full_name" --include="*.js" --include="*.jsx"

# Search for V1 address field references (should be none for users/clients)
grep -r "user\.address" --include="*.js" --include="*.jsx"
grep -r "client\.address" --include="*.js" --include="*.jsx"
```

**Expected Result**: Zero matches (except in comments or strings)

**If Matches Found**:
- Review each occurrence
- Replace with V2 equivalent (`name` field)
- Document in commit message

---

## Phase 2: Create Missing Modal Components (Basic CRUD Only)

**IMPORTANT**: This phase creates **BASIC modals** for user/client creation WITHOUT property management. Full property workflow is deferred to next work order.

---

### Task 2.1: Create Basic UserModal Component

**File**: `client/src/components/modals/UserModal.js` (NEW)

**Purpose**: Simple user creation/edit modal with V2 schema fields

**Component Code**:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const UserModal = ({ isOpen, onClose, onSuccess, editingUser }) => {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role_id: '',
        name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        nif: ''
    });
    const [roleTypes, setRoleTypes] = useState([]);
    const [error, setError] = useState('');

    // Fetch role types on mount
    useEffect(() => {
        const fetchRoleTypes = async () => {
            try {
                const response = await axios.get('/api/role-types');
                setRoleTypes(response.data);
            } catch (err) {
                console.error('Error fetching role types:', err);
                setError('Failed to load role types');
            }
        };

        if (isOpen) {
            fetchRoleTypes();
        }
    }, [isOpen]);

    // Load editing user data
    useEffect(() => {
        if (editingUser) {
            setFormData({
                username: editingUser.username || '',
                password: '', // Don't pre-fill password
                role_id: editingUser.role_id || '',
                name: editingUser.name || '',
                email: editingUser.email || '',
                phone: editingUser.phone || '',
                date_of_birth: editingUser.date_of_birth || '',
                nif: editingUser.nif || ''
            });
        } else {
            setFormData({
                username: '',
                password: '',
                role_id: '',
                name: '',
                email: '',
                phone: '',
                date_of_birth: '',
                nif: ''
            });
        }
        setError('');
    }, [editingUser, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            if (editingUser) {
                await axios.put(`/api/users/${editingUser.id}`, formData);
            } else {
                await axios.post('/api/users', formData);
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Error saving user:', err);
            setError(err.response?.data?.error || 'Failed to save user');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">
                        {editingUser ? 'Edit User' : 'Add User'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        &times;
                    </button>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                Username <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                required
                                disabled={!!editingUser}
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                Password {!editingUser && <span className="text-red-500">*</span>}
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                required={!editingUser}
                                placeholder={editingUser ? 'Leave blank to keep current' : ''}
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                Role <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="role_id"
                                value={formData.role_id}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                required
                            >
                                <option value="">Select Role</option>
                                {roleTypes.map(rt => (
                                    <option key={rt.id} value={rt.id}>
                                        {rt.role_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                placeholder="e.g., João Silva"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">Phone</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">Date of Birth</label>
                            <input
                                type="date"
                                name="date_of_birth"
                                value={formData.date_of_birth}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">NIF</label>
                            <input
                                type="text"
                                name="nif"
                                value={formData.nif}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 mt-6 pt-6 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border rounded-lg hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            {editingUser ? 'Update User' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
```

**Key Points**:
- ✅ Uses V2 schema: single `name` field, `role_id` dropdown
- ✅ NO address fields
- ✅ Fetches role types from `/api/role-types`
- ✅ Handles both create and edit modes
- ❌ Does NOT include property management (deferred)

---

### Task 2.2: Create Basic ClientModal Component

**File**: `client/src/components/modals/ClientModal.js` (NEW)

**Purpose**: Simple client creation/edit modal with V2 schema fields (NO property management yet)

**Component Code**:

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ClientModal = ({ isOpen, onClose, onSuccess, editingClient }) => {
    const [formData, setFormData] = useState({
        phone: '',
        name: '',
        email: '',
        date_of_birth: '',
        nif: '',
        notes: '',
        is_enterprise: false,
        company_name: ''
    });
    const [error, setError] = useState('');

    useEffect(() => {
        if (editingClient) {
            setFormData({
                phone: editingClient.phone || '',
                name: editingClient.name || '',
                email: editingClient.email || '',
                date_of_birth: editingClient.date_of_birth || '',
                nif: editingClient.nif || '',
                notes: editingClient.notes || '',
                is_enterprise: editingClient.is_enterprise || false,
                company_name: editingClient.company_name || ''
            });
        } else {
            setFormData({
                phone: '',
                name: '',
                email: '',
                date_of_birth: '',
                nif: '',
                notes: '',
                is_enterprise: false,
                company_name: ''
            });
        }
        setError('');
    }, [editingClient, isOpen]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            if (editingClient) {
                await axios.put(`/api/clients/${editingClient.id}`, formData);
            } else {
                await axios.post('/api/clients', formData);
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Error saving client:', err);
            setError(err.response?.data?.error || 'Failed to save client');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">
                        {editingClient ? 'Edit Client' : 'Add Client'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        &times;
                    </button>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                name="is_enterprise"
                                checked={formData.is_enterprise}
                                onChange={handleChange}
                                className="mr-2"
                            />
                            <span className="font-medium">Enterprise Client</span>
                        </label>
                    </div>

                    {formData.is_enterprise && (
                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                Company Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="company_name"
                                value={formData.company_name}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                required={formData.is_enterprise}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                {formData.is_enterprise ? 'Contact Name' : 'Full Name'}{' '}
                                <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                placeholder={formData.is_enterprise ? 'e.g., Maria Silva (Manager)' : 'e.g., João Silva'}
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                Phone <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">Date of Birth</label>
                            <input
                                type="date"
                                name="date_of_birth"
                                value={formData.date_of_birth}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">NIF</label>
                            <input
                                type="text"
                                name="nif"
                                value={formData.nif}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">Notes</label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border rounded-lg"
                            rows="3"
                        />
                    </div>

                    <div className="flex justify-end gap-4 mt-6 pt-6 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border rounded-lg hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            {editingClient ? 'Update Client' : 'Create Client'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ClientModal;
```

**Key Points**:
- ✅ Uses V2 schema: single `name` field
- ✅ NO address fields on client
- ✅ Enterprise toggle for `is_enterprise` / `company_name`
- ❌ Does NOT include property creation (deferred to next work order)

**IMPORTANT**: Property management (side-by-side layout, PropertyListModal, etc.) is DEFERRED.

---

### Task 2.3: Wire Up Modals to Dashboard

**File**: Identified in Task 1.1 (likely `client/src/pages/Dashboard.js`)

**Changes Required**:

1. **Import Modals**:
```jsx
import UserModal from '../components/modals/UserModal';
import ClientModal from '../components/modals/ClientModal';
```

2. **Add State for Modals**:
```jsx
const [showUserModal, setShowUserModal] = useState(false);
const [showClientModal, setShowClientModal] = useState(false);
const [editingUser, setEditingUser] = useState(null);
const [editingClient, setEditingClient] = useState(null);
```

3. **Wire "Add User" Button**:
```jsx
<button
    onClick={() => {
        setEditingUser(null);
        setShowUserModal(true);
    }}
    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
>
    Add User
</button>
```

4. **Wire "Add Client" Button**:
```jsx
<button
    onClick={() => {
        setEditingClient(null);
        setShowClientModal(true);
    }}
    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
>
    Add Client
</button>
```

5. **Render Modals at Bottom of Component**:
```jsx
return (
    <div>
        {/* Existing dashboard content */}

        {/* Modals */}
        <UserModal
            isOpen={showUserModal}
            onClose={() => setShowUserModal(false)}
            onSuccess={() => {
                fetchUsers(); // Refresh users list
            }}
            editingUser={editingUser}
        />

        <ClientModal
            isOpen={showClientModal}
            onClose={() => setShowClientModal(false)}
            onSuccess={() => {
                fetchClients(); // Refresh clients list
            }}
            editingClient={editingClient}
        />
    </div>
);
```

6. **Wire Edit Buttons in Tables** (optional but recommended):
```jsx
{/* In users table row */}
<button
    onClick={() => {
        setEditingUser(user);
        setShowUserModal(true);
    }}
    className="text-blue-600 hover:text-blue-800"
>
    Edit
</button>

{/* In clients table row */}
<button
    onClick={() => {
        setEditingClient(client);
        setShowClientModal(true);
    }}
    className="text-blue-600 hover:text-blue-800"
>
    Edit
</button>
```

---

## Phase 3: Docker Rebuild & Smoke Test

### Task 3.1: Rebuild Frontend

**Commands**:
```bash
# Rebuild Docker image (frontend changes require rebuild)
docker-compose build --no-cache app

# Restart services
docker-compose down
docker-compose up -d

# Verify health
docker-compose ps
docker-compose logs -f app | head -50
```

**Expected Output**:
- Both `lavandaria-app` and `lavandaria-db` show "Up (healthy)"
- No JavaScript build errors in logs

---

### Task 3.2: Smoke Test via Browser

**Manual Testing Checklist**:

1. **Login** (Human-like WebUI interaction):
   - Navigate to http://localhost:3000/ (landing page)
   - Verify login form is visible
   - Fill username field: `master`
   - Fill password field: `master123`
   - Click "Login" button
   - ✅ Should redirect to http://localhost:3000/dashboard
   - ❌ FAIL if login fails or doesn't redirect

2. **Users Table Name Column**:
   - Navigate to "All Users" tab
   - ✅ Name column should show: "Master User", "Admin User", "Test Worker"
   - ❌ FAIL if Name column is empty

3. **Clients Table Name Column**:
   - Navigate to "Clients" tab
   - ✅ Name column should show: "Test Client"
   - ❌ FAIL if Name column is empty

4. **UserModal Open**:
   - Click "Add User" button
   - ✅ UserModal should appear
   - ❌ FAIL if nothing happens

5. **UserModal Fields**:
   - Verify form shows:
     - Username (text)
     - Password (password)
     - Role (dropdown with Master/Admin/Worker/Client)
     - Name (single text field)
     - Email, Phone, DOB, NIF
     - NO first_name, last_name, or address fields
   - ✅ PASS if all V2 fields present
   - ❌ FAIL if V1 fields appear

6. **Create Test Worker**:
   - Fill form:
     - Username: smoketest_worker
     - Password: test123
     - Role: Worker
     - Name: Smoke Test Worker
     - Email: smoke@test.com
   - Submit
   - ✅ User should appear in users list with name "Smoke Test Worker"
   - ❌ FAIL if creation fails or name is empty

7. **ClientModal Open**:
   - Navigate to "Clients" tab
   - Click "Add Client" button
   - ✅ ClientModal should appear
   - ❌ FAIL if nothing happens

8. **ClientModal Fields**:
   - Verify form shows:
     - Enterprise toggle
     - Name (single field)
     - Phone, Email, DOB, NIF, Notes
     - NO address fields (no property management yet - deferred)
   - ✅ PASS if all V2 fields present
   - ❌ FAIL if V1 fields appear

9. **Create Test Client**:
   - Fill form:
     - Name: Smoke Test Client
     - Phone: 919999999
     - Email: smokeclient@test.com
   - Submit
   - ✅ Client should appear in clients list with name "Smoke Test Client"
   - ❌ FAIL if creation fails or name is empty

10. **Console Check**:
    - Open DevTools Console
    - ✅ NO red errors
    - ❌ FAIL if JavaScript errors present

---

### Task 3.3: Document Smoke Test Results

Create file: `handoff/SMOKE-TEST-RESULTS-20251115.md`

**Template**:
```markdown
# Smoke Test Results - WO-20251115-DEV-FRONTEND-V2-FIX

**Date**: 2025-11-15
**Tester**: Developer Agent (self-test)

## Test Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1. Login | PASS/FAIL | |
| 2. Users Table Name Column | PASS/FAIL | |
| 3. Clients Table Name Column | PASS/FAIL | |
| 4. UserModal Opens | PASS/FAIL | |
| 5. UserModal V2 Fields | PASS/FAIL | |
| 6. Create Test Worker | PASS/FAIL | |
| 7. ClientModal Opens | PASS/FAIL | |
| 8. ClientModal V2 Fields | PASS/FAIL | |
| 9. Create Test Client | PASS/FAIL | |
| 10. Console Clean | PASS/FAIL | |

**Overall Status**: PASS/FAIL

**Screenshots**:
- (Attach screenshots of fixed Name columns and modal forms)

**Issues Found**:
- (List any issues discovered during smoke test)

**Next Steps**:
- If PASS: Ready for Tester validation (WO-20251115-TESTER)
- If FAIL: Document issues and fix before handoff
```

---

## Acceptance Criteria

**Phase 1: V1/V2 Field Name Mismatch**:
- [ ] Users table Name column displays correct names from database
- [ ] Clients table Name column displays correct names from database
- [ ] NO references to `first_name`, `last_name`, or `full_name` in frontend code
- [ ] Global search confirms zero V1 field references

**Phase 2: Modal Components**:
- [ ] `client/src/components/modals/UserModal.js` exists and functional
- [ ] `client/src/components/modals/ClientModal.js` exists and functional
- [ ] UserModal shows V2 fields (single name, role dropdown, no addresses)
- [ ] ClientModal shows V2 fields (single name, no addresses)
- [ ] "Add User" button opens UserModal
- [ ] "Add Client" button opens ClientModal
- [ ] Can create new user via modal (test with smoke test worker)
- [ ] Can create new client via modal (test with smoke test client)

**Phase 3: Docker & Smoke Test**:
- [ ] Docker image rebuilt successfully
- [ ] No JavaScript build errors
- [ ] All 10 smoke test cases PASS
- [ ] Smoke test results documented in `handoff/SMOKE-TEST-RESULTS-20251115.md`

---

## Out of Scope (Deferred to Next Work Order)

**The following features from WO-20251114-DEV-PROPERTY-MGMT are DEFERRED**:

❌ Property management backend routes (`routes/properties.js`, `routes/property-types.js`)
❌ PropertyListModal component
❌ PropertyFormModal component
❌ Side-by-side client+property creation layout
❌ CleaningJobModal property selection dropdown
❌ Unlimited properties per client workflow
❌ Primary property auto-promotion logic

**Reason**: These features require a full work order dedicated to property management. This work order focuses ONLY on fixing the immediate P0 blockers (empty name fields + missing basic CRUD modals).

---

## Deliverables Checklist

- [ ] Phase 1 fixes applied (V1/V2 field name mismatch)
- [ ] `client/src/components/modals/UserModal.js` created
- [ ] `client/src/components/modals/ClientModal.js` created
- [ ] Dashboard.js updated to wire modals
- [ ] Docker image rebuilt
- [ ] Smoke test completed (10/10 PASS)
- [ ] Smoke test results documented
- [ ] Code committed with conventional commit message:
  ```
  fix(P0): resolve V2 schema frontend mismatch and add basic CRUD modals

  - Fix empty Name columns (users/clients tables)
  - Create UserModal with V2 fields (single name, role_id dropdown)
  - Create ClientModal with V2 fields (single name, no addresses)
  - Wire modals to Dashboard "Add" buttons
  - All smoke tests PASS (10/10)

  Refs: WO-20251115-DEV-FRONTEND-V2-FIX, PROPERTY-MGMT-TEST-REPORT-20251114
  ```

---

## Notes for Developer Agent

1. **This is a REDUCED SCOPE work order** - Do NOT implement full property management yet
2. **Priority is UNBLOCKING the tester** - Get basic CRUD working first
3. **Property management is next iteration** - Will be separate work order
4. **Smoke test is mandatory** - Must complete 10/10 before handoff to tester
5. **Search thoroughly for V1 field references** - grep is your friend
6. **Docker rebuild is required** - Frontend changes are baked into image
7. **CRITICAL - Login Flow**: Application should start at `http://localhost:3000/` with login page, NOT directly at `/dashboard`. After successful login, redirect to `/dashboard`. All smoke testing must use proper login flow (fill form + click button like a human would)

---

**END OF WORK ORDER**

**Related Documents**:
- Tester Report: `handoff/PROPERTY-MGMT-TEST-REPORT-20251114.md`
- Original Work Order: `handoff/WO-20251114-PROPERTY-MANAGEMENT-DEVELOPER.md` (deferred)
- Next Work Order: WO-20251115-TESTER (tester validation)

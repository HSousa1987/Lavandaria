# Work Order: Property Management System Implementation (V2 Schema)

**Date**: 2025-11-14
**Work Order ID**: WO-20251114-DEV-PROPERTY-MGMT
**Assigned To**: Developer Agent (Claude Haiku)
**Priority**: P0 (Blocking - Frontend forms broken, V2 schema misalignment)
**Estimated Complexity**: High (Full-stack feature with RBAC, transaction logic, multi-modal UI)

---

## Executive Summary

Implement complete property management system to resolve V2 schema frontend-backend misalignment. The V2 database architecture moved ALL address information from `clients` and `users` tables to a new `properties` table, enabling 1:N client-to-properties relationships. Currently, all frontend forms (user creation, client creation, cleaning job creation) still expect V1 schema fields, causing form submission failures and broken workflows.

**Key Business Rules**:
- One client can have **unlimited properties**
- Each client MUST have exactly **one primary property** (`is_primary=true`)
- Deleting primary property auto-promotes another property to primary
- Properties belong exclusively to one client (not shared)
- Cleaning jobs reference `property_id` (not direct addresses)

---

## Architectural Context

### V2 Schema Changes (Relevant to This Work Order)

**clients table** (V2 - NO addresses):
```sql
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,  -- V2: Single field (NO first_name/last_name)
    email VARCHAR(100),
    date_of_birth DATE,
    nif VARCHAR(20),
    notes TEXT,
    is_enterprise BOOLEAN DEFAULT FALSE,
    company_name VARCHAR(200),
    -- REMOVED IN V2: address_line1, address_line2, city, postal_code, district, country
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    must_change_password BOOLEAN DEFAULT TRUE
);
```

**properties table** (V2 - NEW):
```sql
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    property_name VARCHAR(200) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    district VARCHAR(100) NOT NULL,
    property_type_id INTEGER REFERENCES property_types(id),
    is_primary BOOLEAN DEFAULT FALSE,  -- CONSTRAINT: Only one primary per client
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure only one primary property per client
CREATE UNIQUE INDEX idx_properties_primary ON properties (client_id) WHERE is_primary = true;
```

**property_types table** (Lookup):
```sql
CREATE TABLE property_types (
    id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

-- Seed data:
-- 1: 'residential' (house)
-- 2: 'airbnb' (short-term rental)
-- 3: 'commercial' (office)
```

**cleaning_jobs table** (V2 - References property):
```sql
CREATE TABLE cleaning_jobs (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,  -- V2: New FK
    -- REMOVED IN V2: property_name, address_line1, address_line2, city, postal_code, district
    ...
);
```

---

## Phase 1: Backend Implementation

### Task 1.1: Create `/routes/properties.js`

**File**: `routes/properties.js`

**Required Endpoints**:

#### GET `/api/properties?client_id=X`
**Purpose**: List all properties for a specific client
**RBAC**: Master/Admin can view all, clients can view own
**Response**:
```javascript
{
  "success": true,
  "data": [
    {
      "id": 1,
      "client_id": 10,
      "property_name": "Main Residence",
      "address_line1": "Rua das Flores, 25",
      "address_line2": "Apt 3B",
      "city": "Lisboa",
      "postal_code": "1200-001",
      "district": "Lisboa",
      "property_type_id": 1,
      "property_type_name": "residential",
      "is_primary": true,
      "created_at": "2025-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "client_id": 10,
      "property_name": "Airbnb Cascais",
      "address_line1": "Avenida Marginal, 100",
      "city": "Cascais",
      "postal_code": "2750-001",
      "district": "Lisboa",
      "property_type_id": 2,
      "property_type_name": "airbnb",
      "is_primary": false,
      "created_at": "2025-02-20T14:00:00.000Z"
    }
  ],
  "_meta": {
    "timestamp": "2025-11-14T12:00:00.000Z",
    "correlationId": "req_1731585600000_abc123"
  }
}
```

**Query**:
```javascript
const result = await pool.query(`
    SELECT p.*, pt.type_name as property_type_name
    FROM properties p
    LEFT JOIN property_types pt ON p.property_type_id = pt.id
    WHERE p.client_id = $1
    ORDER BY p.is_primary DESC, p.created_at ASC
`, [clientId]);
```

**RBAC Logic**:
```javascript
// Client viewing own properties
if (req.session.userType === 'client') {
    if (parseInt(req.query.client_id) !== req.session.clientId) {
        return errorResponse(res, 403, 'Forbidden - cannot view other clients properties', 'FORBIDDEN', req);
    }
}
// Master/Admin can view any client's properties (no restriction)
```

#### POST `/api/properties`
**Purpose**: Create new property for a client
**RBAC**: Master/Admin only
**Request Body**:
```javascript
{
  "client_id": 10,
  "property_name": "Airbnb Porto",
  "address_line1": "Rua de Santa Catarina, 50",
  "address_line2": "",
  "city": "Porto",
  "postal_code": "4000-001",
  "district": "Porto",
  "property_type_id": 2,
  "is_primary": false  // If true and client already has primary, return error
}
```

**Business Logic**:
1. Validate `client_id` exists
2. If `is_primary=true`, check if client already has primary property:
   ```javascript
   const existingPrimary = await pool.query(
       'SELECT id FROM properties WHERE client_id = $1 AND is_primary = true',
       [client_id]
   );
   if (existingPrimary.rows.length > 0) {
       return errorResponse(res, 400, 'Client already has a primary property', 'PRIMARY_EXISTS', req);
   }
   ```
3. If this is client's FIRST property, force `is_primary=true`
4. Insert property and return with property_type_name joined

**Response**: Same structure as GET (single property object)

#### PUT `/api/properties/:id`
**Purpose**: Update existing property
**RBAC**: Master/Admin only
**Request Body**: Same fields as POST

**Business Logic**:
1. Validate property exists
2. If changing `is_primary` from `false` to `true`:
   - Check if client already has another primary property
   - If yes, return error (must demote other property first)
3. If changing `is_primary` from `true` to `false`:
   - Reject if this is client's ONLY property (client must have one primary)
4. Update property and return

#### DELETE `/api/properties/:id`
**Purpose**: Delete property with auto-promotion logic
**RBAC**: Master/Admin only

**Business Logic (CRITICAL)**:
```javascript
const client = await pool.query('BEGIN');

try {
    // 1. Get property being deleted
    const property = await pool.query('SELECT * FROM properties WHERE id = $1', [propertyId]);
    if (property.rows.length === 0) {
        await pool.query('ROLLBACK');
        return errorResponse(res, 404, 'Property not found', 'NOT_FOUND', req);
    }

    const deletedProperty = property.rows[0];
    const clientId = deletedProperty.client_id;
    const wasPrimary = deletedProperty.is_primary;

    // 2. Check for dependent cleaning jobs
    const jobs = await pool.query('SELECT COUNT(*) FROM cleaning_jobs WHERE property_id = $1', [propertyId]);
    if (parseInt(jobs.rows[0].count) > 0) {
        await pool.query('ROLLBACK');
        return errorResponse(res, 400, 'Cannot delete property with existing cleaning jobs', 'HAS_DEPENDENCIES', req);
    }

    // 3. Delete property
    await pool.query('DELETE FROM properties WHERE id = $1', [propertyId]);

    // 4. If deleted property was primary, auto-promote another property
    if (wasPrimary) {
        const remainingProperties = await pool.query(
            'SELECT id FROM properties WHERE client_id = $1 ORDER BY created_at ASC LIMIT 1',
            [clientId]
        );

        if (remainingProperties.rows.length > 0) {
            const newPrimaryId = remainingProperties.rows[0].id;
            await pool.query('UPDATE properties SET is_primary = true WHERE id = $1', [newPrimaryId]);
            console.log(`[${req.correlationId}] Auto-promoted property ${newPrimaryId} to primary for client ${clientId}`);
        }
    }

    await pool.query('COMMIT');
    return res.json({
        success: true,
        data: { message: 'Property deleted successfully' },
        _meta: {
            timestamp: new Date().toISOString(),
            correlationId: req.correlationId
        }
    });

} catch (error) {
    await pool.query('ROLLBACK');
    console.error(`[${req.correlationId}] Error deleting property:`, error);
    return errorResponse(res, 500, 'Server error', 'SERVER_ERROR', req);
}
```

**Error Handling Requirements**:
- `404` if property not found
- `400` if property has cleaning jobs (cannot delete)
- `500` on transaction failure (with ROLLBACK)

### Task 1.2: Register Routes in `server.js`

Add after existing route registrations:
```javascript
const propertiesRoutes = require('./routes/properties');
app.use('/api/properties', propertiesRoutes);
```

### Task 1.3: Update Existing Backend Routes (V2 Compatibility)

**File**: `routes/users.js`

**Changes Required**:
- Remove ALL address fields from INSERT/UPDATE queries (users table has NO addresses in V2)
- Users table structure in V2:
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES role_types(id),  -- V2: FK not string
    name VARCHAR(100) NOT NULL,  -- V2: Single field
    email VARCHAR(100),
    phone VARCHAR(20),
    date_of_birth DATE,
    nif VARCHAR(20),
    -- REMOVED IN V2: ALL address fields, first_name, last_name, full_name, country, role (string)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id)
);
```

**Current Issue**: UserModal (frontend) likely sending `first_name`, `last_name`, `address_line1`, etc.

**Backend Fix** (routes/users.js POST endpoint):
```javascript
router.post('/', requireMasterOrAdmin, async (req, res) => {
    const { username, password, role_id, name, email, phone, date_of_birth, nif } = req.body;
    // IGNORE any address fields or first_name/last_name sent by frontend

    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `INSERT INTO users (username, password, role_id, name, email, phone, date_of_birth, nif, created_by)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                   RETURNING id, username, role_id, name, email, phone, date_of_birth, nif, created_at`;

    const values = [username, hashedPassword, role_id, name, email, phone, date_of_birth, nif, req.session.userId];

    try {
        const result = await pool.query(query, values);
        // JOIN with role_types to return role_name
        const userWithRole = await pool.query(
            `SELECT u.*, rt.role_name
             FROM users u
             JOIN role_types rt ON u.role_id = rt.id
             WHERE u.id = $1`,
            [result.rows[0].id]
        );
        res.status(201).json(userWithRole.rows[0]);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
```

**Same pattern for PUT endpoint** - remove ALL address fields.

---

## Phase 2: Frontend Form Updates (V2 Schema Compatibility)

### Task 2.1: Update `UserModal.js` (Workers/Admins Creation)

**File**: `client/src/components/modals/UserModal.js`

**Current Issue**: Form expects V1 fields (first_name, last_name, address_line1, etc.)

**Required Changes**:

1. **State Structure** (V2 schema):
```javascript
const [formData, setFormData] = useState({
    username: '',
    password: '',
    role_id: '',  // V2: Integer FK (NOT role string)
    name: '',     // V2: Single field
    email: '',
    phone: '',
    date_of_birth: '',
    nif: ''
    // REMOVED: first_name, last_name, address_line1, address_line2, city, postal_code, district
});
```

2. **Role Dropdown** (fetch from `/api/role-types`):
```jsx
// Add useEffect to fetch role types on mount
const [roleTypes, setRoleTypes] = useState([]);

useEffect(() => {
    const fetchRoleTypes = async () => {
        try {
            const response = await axios.get('/api/role-types');
            // Filter based on current user's permission level
            // Master can create: Admin, Worker, Client
            // Admin can create: Worker, Client
            setRoleTypes(response.data);
        } catch (error) {
            console.error('Error fetching role types:', error);
        }
    };
    fetchRoleTypes();
}, []);

// Render dropdown
<div className="mb-4">
    <label className="block text-gray-700 font-medium mb-2">Role</label>
    <select
        name="role_id"
        value={formData.role_id}
        onChange={handleChange}
        className="w-full px-4 py-2 border rounded-lg"
        required
    >
        <option value="">Select Role</option>
        {roleTypes.map(rt => (
            <option key={rt.id} value={rt.id}>{rt.role_name}</option>
        ))}
    </select>
</div>
```

3. **Single Name Field**:
```jsx
<div className="mb-4">
    <label className="block text-gray-700 font-medium mb-2">Full Name</label>
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
```

4. **Remove ALL address input fields** (address_line1, city, postal_code, district)

5. **Submit Handler**:
```javascript
const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        if (editingUser) {
            await axios.put(`/api/users/${editingUser.id}`, formData);
        } else {
            await axios.post('/api/users', formData);
        }
        onSuccess();
        onClose();
    } catch (error) {
        console.error('Error saving user:', error.response?.data || error);
        alert(error.response?.data?.error || 'Failed to save user');
    }
};
```

### Task 2.2: Create Role Types Endpoint

**File**: `routes/role-types.js` (NEW)

```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireMasterOrAdmin } = require('../middleware/permissions');

// GET /api/role-types - List all role types
router.get('/', requireMasterOrAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM role_types ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching role types:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
```

**Register in server.js**:
```javascript
const roleTypesRoutes = require('./routes/role-types');
app.use('/api/role-types', roleTypesRoutes);
```

### Task 2.3: Update `ClientModal.js` (Side-by-Side Client + Property Creation)

**File**: `client/src/components/modals/ClientModal.js`

**Current Issue**: Form expects V1 client fields with addresses directly on client

**Required Architecture**: Side-by-side layout with client info on left, property info on right

**State Structure**:
```javascript
const [clientData, setClientData] = useState({
    phone: '',
    name: '',          // V2: Single field
    email: '',
    date_of_birth: '',
    nif: '',
    notes: '',
    is_enterprise: false,
    company_name: ''
    // REMOVED: address fields
});

const [propertyData, setPropertyData] = useState({
    property_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    district: '',
    property_type_id: 1,  // Default to 'residential'
    is_primary: true      // First property is always primary
});

const [propertyTypes, setPropertyTypes] = useState([]);
```

**Fetch Property Types**:
```javascript
useEffect(() => {
    const fetchPropertyTypes = async () => {
        try {
            const response = await axios.get('/api/property-types');
            setPropertyTypes(response.data);
        } catch (error) {
            console.error('Error fetching property types:', error);
        }
    };
    fetchPropertyTypes();
}, []);
```

**Layout (Side-by-Side)**:
```jsx
<form onSubmit={handleSubmit}>
    <div className="grid grid-cols-2 gap-6">
        {/* LEFT: Client Information */}
        <div className="border-r pr-6">
            <h3 className="text-lg font-semibold mb-4">Client Information</h3>

            {/* Enterprise Toggle */}
            <div className="mb-4">
                <label className="flex items-center">
                    <input
                        type="checkbox"
                        name="is_enterprise"
                        checked={clientData.is_enterprise}
                        onChange={(e) => setClientData({...clientData, is_enterprise: e.target.checked})}
                        className="mr-2"
                    />
                    <span>Enterprise Client</span>
                </label>
            </div>

            {/* Show company_name if enterprise */}
            {clientData.is_enterprise && (
                <div className="mb-4">
                    <label className="block text-gray-700 font-medium mb-2">Company Name</label>
                    <input
                        type="text"
                        name="company_name"
                        value={clientData.company_name}
                        onChange={(e) => setClientData({...clientData, company_name: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg"
                        required={clientData.is_enterprise}
                    />
                </div>
            )}

            {/* Name field */}
            <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">
                    {clientData.is_enterprise ? 'Contact Name' : 'Full Name'}
                </label>
                <input
                    type="text"
                    name="name"
                    value={clientData.name}
                    onChange={(e) => setClientData({...clientData, name: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder={clientData.is_enterprise ? 'e.g., Maria Silva (Manager)' : 'e.g., João Silva'}
                    required
                />
            </div>

            {/* Phone, Email, DOB, NIF, Notes */}
            {/* ... existing client fields ... */}
        </div>

        {/* RIGHT: Primary Property Information */}
        <div className="pl-6">
            <h3 className="text-lg font-semibold mb-4">Primary Property</h3>

            <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Property Name</label>
                <input
                    type="text"
                    name="property_name"
                    value={propertyData.property_name}
                    onChange={(e) => setPropertyData({...propertyData, property_name: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="e.g., Main Residence, Airbnb Cascais"
                    required
                />
            </div>

            <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Property Type</label>
                <select
                    name="property_type_id"
                    value={propertyData.property_type_id}
                    onChange={(e) => setPropertyData({...propertyData, property_type_id: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                >
                    {propertyTypes.map(pt => (
                        <option key={pt.id} value={pt.id}>{pt.type_name}</option>
                    ))}
                </select>
            </div>

            <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Address Line 1</label>
                <input
                    type="text"
                    name="address_line1"
                    value={propertyData.address_line1}
                    onChange={(e) => setPropertyData({...propertyData, address_line1: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="Rua das Flores, 25"
                    required
                />
            </div>

            <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">Address Line 2 (Optional)</label>
                <input
                    type="text"
                    name="address_line2"
                    value={propertyData.address_line2}
                    onChange={(e) => setPropertyData({...propertyData, address_line2: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="Apt 3B"
                />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-gray-700 font-medium mb-2">City</label>
                    <input
                        type="text"
                        name="city"
                        value={propertyData.city}
                        onChange={(e) => setPropertyData({...propertyData, city: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg"
                        required
                    />
                </div>
                <div>
                    <label className="block text-gray-700 font-medium mb-2">Postal Code</label>
                    <input
                        type="text"
                        name="postal_code"
                        value={propertyData.postal_code}
                        onChange={(e) => setPropertyData({...propertyData, postal_code: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg"
                        required
                    />
                </div>
            </div>

            <div className="mb-4">
                <label className="block text-gray-700 font-medium mb-2">District</label>
                <input
                    type="text"
                    name="district"
                    value={propertyData.district}
                    onChange={(e) => setPropertyData({...propertyData, district: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                />
            </div>
        </div>
    </div>

    {/* Submit Button */}
    <div className="flex justify-end gap-4 mt-6 pt-6 border-t">
        <button type="button" onClick={onClose} className="px-6 py-2 border rounded-lg">
            Cancel
        </button>
        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Create Client & Property
        </button>
    </div>
</form>
```

**Submit Handler (Transaction)**:
```javascript
const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        // Step 1: Create client
        const clientResponse = await axios.post('/api/clients', clientData);
        const newClientId = clientResponse.data.id;

        // Step 2: Create primary property
        await axios.post('/api/properties', {
            client_id: newClientId,
            ...propertyData,
            is_primary: true  // First property is always primary
        });

        onSuccess();
        onClose();
    } catch (error) {
        console.error('Error creating client/property:', error.response?.data || error);
        alert(error.response?.data?.error || 'Failed to create client and property');
    }
};
```

**IMPORTANT**: If editing existing client, hide property form and show "Manage Properties" button that opens PropertyListModal.

### Task 2.4: Create Property Types Endpoint

**File**: `routes/property-types.js` (NEW)

```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireStaff } = require('../middleware/permissions');

// GET /api/property-types - List all property types
router.get('/', requireStaff, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM property_types ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching property types:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
```

**Register in server.js**:
```javascript
const propertyTypesRoutes = require('./routes/property-types');
app.use('/api/property-types', propertyTypesRoutes);
```

---

## Phase 3: Property Management UI Components

### Task 3.1: Create `PropertyListModal.js`

**File**: `client/src/components/modals/PropertyListModal.js` (NEW)

**Purpose**: Display all properties for a client with add/edit/delete actions

**Props**:
```javascript
PropertyListModal({
    isOpen,
    onClose,
    clientId,
    clientName
})
```

**Features**:
- Fetch properties via `GET /api/properties?client_id=X`
- Display table with: property_name, address, city, type, primary badge
- "Add Property" button → opens PropertyFormModal
- Edit icon → opens PropertyFormModal with property data
- Delete icon → confirmation + DELETE request
- Primary badge (green "PRIMARY" badge for `is_primary=true`)

**Component Structure**:
```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PropertyFormModal from './PropertyFormModal';

const PropertyListModal = ({ isOpen, onClose, clientId, clientName }) => {
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showPropertyForm, setShowPropertyForm] = useState(false);
    const [editingProperty, setEditingProperty] = useState(null);

    useEffect(() => {
        if (isOpen && clientId) {
            fetchProperties();
        }
    }, [isOpen, clientId]);

    const fetchProperties = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/api/properties?client_id=${clientId}`);
            setProperties(response.data.data || response.data);
        } catch (error) {
            console.error('Error fetching properties:', error);
            alert('Failed to load properties');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (propertyId) => {
        if (!window.confirm('Are you sure you want to delete this property?')) return;

        try {
            await axios.delete(`/api/properties/${propertyId}`);
            fetchProperties(); // Refresh list
        } catch (error) {
            console.error('Error deleting property:', error);
            alert(error.response?.data?.error || 'Failed to delete property');
        }
    };

    const handleEdit = (property) => {
        setEditingProperty(property);
        setShowPropertyForm(true);
    };

    const handleAdd = () => {
        setEditingProperty(null);
        setShowPropertyForm(true);
    };

    const handlePropertyFormClose = () => {
        setShowPropertyForm(false);
        setEditingProperty(null);
        fetchProperties(); // Refresh list
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Properties - {clientName}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
                        &times;
                    </button>
                </div>

                <div className="mb-4">
                    <button
                        onClick={handleAdd}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                        + Add Property
                    </button>
                </div>

                {loading ? (
                    <p>Loading properties...</p>
                ) : properties.length === 0 ? (
                    <p className="text-gray-500">No properties found. Click "Add Property" to create one.</p>
                ) : (
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border p-2 text-left">Property Name</th>
                                <th className="border p-2 text-left">Address</th>
                                <th className="border p-2 text-left">City</th>
                                <th className="border p-2 text-left">Type</th>
                                <th className="border p-2 text-center">Primary</th>
                                <th className="border p-2 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {properties.map(property => (
                                <tr key={property.id} className="hover:bg-gray-50">
                                    <td className="border p-2">{property.property_name}</td>
                                    <td className="border p-2">
                                        {property.address_line1}
                                        {property.address_line2 && `, ${property.address_line2}`}
                                    </td>
                                    <td className="border p-2">{property.city}</td>
                                    <td className="border p-2 capitalize">{property.property_type_name}</td>
                                    <td className="border p-2 text-center">
                                        {property.is_primary && (
                                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                                                PRIMARY
                                            </span>
                                        )}
                                    </td>
                                    <td className="border p-2 text-center">
                                        <button
                                            onClick={() => handleEdit(property)}
                                            className="text-blue-600 hover:text-blue-800 mr-2"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(property.id)}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* Property Form Modal (nested) */}
                {showPropertyForm && (
                    <PropertyFormModal
                        isOpen={showPropertyForm}
                        onClose={handlePropertyFormClose}
                        clientId={clientId}
                        editingProperty={editingProperty}
                    />
                )}
            </div>
        </div>
    );
};

export default PropertyListModal;
```

### Task 3.2: Create `PropertyFormModal.js`

**File**: `client/src/components/modals/PropertyFormModal.js` (NEW)

**Purpose**: Add or edit a single property

**Props**:
```javascript
PropertyFormModal({
    isOpen,
    onClose,
    clientId,
    editingProperty  // null for new, object for edit
})
```

**Component Structure**:
```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PropertyFormModal = ({ isOpen, onClose, clientId, editingProperty }) => {
    const [formData, setFormData] = useState({
        property_name: '',
        address_line1: '',
        address_line2: '',
        city: '',
        postal_code: '',
        district: '',
        property_type_id: 1,
        is_primary: false
    });
    const [propertyTypes, setPropertyTypes] = useState([]);

    useEffect(() => {
        const fetchPropertyTypes = async () => {
            try {
                const response = await axios.get('/api/property-types');
                setPropertyTypes(response.data);
            } catch (error) {
                console.error('Error fetching property types:', error);
            }
        };
        fetchPropertyTypes();
    }, []);

    useEffect(() => {
        if (editingProperty) {
            setFormData({
                property_name: editingProperty.property_name,
                address_line1: editingProperty.address_line1,
                address_line2: editingProperty.address_line2 || '',
                city: editingProperty.city,
                postal_code: editingProperty.postal_code,
                district: editingProperty.district,
                property_type_id: editingProperty.property_type_id,
                is_primary: editingProperty.is_primary
            });
        } else {
            setFormData({
                property_name: '',
                address_line1: '',
                address_line2: '',
                city: '',
                postal_code: '',
                district: '',
                property_type_id: 1,
                is_primary: false
            });
        }
    }, [editingProperty]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { client_id: clientId, ...formData };

            if (editingProperty) {
                await axios.put(`/api/properties/${editingProperty.id}`, payload);
            } else {
                await axios.post('/api/properties', payload);
            }

            onClose(); // Trigger parent refresh
        } catch (error) {
            console.error('Error saving property:', error.response?.data || error);
            alert(error.response?.data?.error || 'Failed to save property');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">
                        {editingProperty ? 'Edit Property' : 'Add Property'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
                        &times;
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">Property Name</label>
                        <input
                            type="text"
                            name="property_name"
                            value={formData.property_name}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border rounded-lg"
                            placeholder="e.g., Main Residence, Airbnb Cascais"
                            required
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">Property Type</label>
                        <select
                            name="property_type_id"
                            value={formData.property_type_id}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border rounded-lg"
                            required
                        >
                            {propertyTypes.map(pt => (
                                <option key={pt.id} value={pt.id}>{pt.type_name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">Address Line 1</label>
                        <input
                            type="text"
                            name="address_line1"
                            value={formData.address_line1}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border rounded-lg"
                            placeholder="Rua das Flores, 25"
                            required
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">Address Line 2 (Optional)</label>
                        <input
                            type="text"
                            name="address_line2"
                            value={formData.address_line2}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border rounded-lg"
                            placeholder="Apt 3B"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-gray-700 font-medium mb-2">City</label>
                            <input
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 font-medium mb-2">Postal Code</label>
                            <input
                                type="text"
                                name="postal_code"
                                value={formData.postal_code}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                required
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">District</label>
                        <input
                            type="text"
                            name="district"
                            value={formData.district}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border rounded-lg"
                            required
                        />
                    </div>

                    <div className="mb-4">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                name="is_primary"
                                checked={formData.is_primary}
                                onChange={handleChange}
                                className="mr-2"
                            />
                            <span>Set as Primary Property</span>
                        </label>
                        <p className="text-sm text-gray-500 mt-1">
                            Each client must have one primary property
                        </p>
                    </div>

                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-6 py-2 border rounded-lg">
                            Cancel
                        </button>
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            {editingProperty ? 'Update Property' : 'Add Property'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PropertyFormModal;
```

### Task 3.3: Update `CleaningJobModal.js` (Property Selection)

**File**: `client/src/components/modals/CleaningJobModal.js`

**Current Issue**: Form expects V1 fields (property_name, address_line1 directly on cleaning_jobs)

**Required Changes**:

1. **State Structure**:
```javascript
const [formData, setFormData] = useState({
    client_id: '',
    property_id: '',  // V2: FK to properties table
    job_type: 'airbnb',
    status: 'scheduled',
    scheduled_date: '',
    scheduled_time: '',
    assigned_worker_id: '',
    notes: ''
    // REMOVED: property_name, address_line1, address_line2, city, postal_code, district
});
```

2. **Fetch Client Properties** (when client is selected):
```javascript
const [clientProperties, setClientProperties] = useState([]);

const handleClientChange = async (clientId) => {
    setFormData(prev => ({ ...prev, client_id: clientId, property_id: '' }));

    // Fetch properties for selected client
    try {
        const response = await axios.get(`/api/properties?client_id=${clientId}`);
        setClientProperties(response.data.data || response.data);

        // Auto-select primary property if exists
        const primary = response.data.data?.find(p => p.is_primary);
        if (primary) {
            setFormData(prev => ({ ...prev, property_id: primary.id }));
        }
    } catch (error) {
        console.error('Error fetching client properties:', error);
    }
};
```

3. **Property Dropdown**:
```jsx
<div className="mb-4">
    <label className="block text-gray-700 font-medium mb-2">Property</label>
    <select
        name="property_id"
        value={formData.property_id}
        onChange={(e) => setFormData({...formData, property_id: e.target.value})}
        className="w-full px-4 py-2 border rounded-lg"
        required
        disabled={!formData.client_id}
    >
        <option value="">Select Property</option>
        {clientProperties.map(prop => (
            <option key={prop.id} value={prop.id}>
                {prop.property_name} - {prop.city}
                {prop.is_primary && ' (Primary)'}
            </option>
        ))}
    </select>
    {formData.client_id && clientProperties.length === 0 && (
        <p className="text-sm text-red-500 mt-1">
            No properties found for this client. Please add a property first.
        </p>
    )}
</div>
```

4. **Remove ALL property address input fields** (property_name, address_line1, city, etc.)

---

## Phase 4: Testing & Validation

### Task 4.1: Docker Build & Restart

After completing ALL code changes:

```bash
# Rebuild Docker image to include new code
docker-compose build --no-cache app

# Restart services
docker-compose down
docker-compose up -d

# Verify health
docker-compose ps
docker-compose logs -f app | head -50
```

### Task 4.2: Seed Test Data

Ensure seed script creates test properties:

```bash
npm run test:seed
```

**Expected Output**:
- Master, Admin, Worker, Client users created
- Test client with ID (check seed script for FIXED_IDS.client)
- Test property with ID (check seed script for FIXED_IDS.property)

### Task 4.3: Manual API Testing (Terminal)

**Test Property Endpoints**:

```bash
# Login as admin (get session cookie)
COOKIE=$(curl -c - -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' | grep connect.sid | awk '{print $7}')

# List properties for test client (replace CLIENT_ID)
curl -b "connect.sid=$COOKIE" \
    "http://localhost:3000/api/properties?client_id=CLIENT_ID" | jq

# Create new property
curl -b "connect.sid=$COOKIE" -X POST \
    http://localhost:3000/api/properties \
    -H "Content-Type: application/json" \
    -d '{
        "client_id": CLIENT_ID,
        "property_name": "Test Airbnb",
        "address_line1": "Test Street, 123",
        "city": "Lisboa",
        "postal_code": "1200-001",
        "district": "Lisboa",
        "property_type_id": 2,
        "is_primary": false
    }' | jq

# Delete property (replace PROPERTY_ID)
curl -b "connect.sid=$COOKIE" -X DELETE \
    http://localhost:3000/api/properties/PROPERTY_ID | jq
```

### Task 4.4: Frontend UI Testing (Manual via Browser)

**User Creation Test**:
1. Login as Master
2. Navigate to Users section
3. Click "Add User" (Worker or Admin)
4. Verify form shows:
   - Username, Password fields
   - Role dropdown (NOT text input)
   - Single "Name" field (NOT first_name/last_name)
   - Phone, Email, DOB, NIF fields
   - NO address fields
5. Fill form and submit
6. Verify user appears in users list
7. Verify backend logs show `INSERT INTO users (username, password, role_id, name, ...)`

**Client Creation Test**:
1. Login as Master/Admin
2. Navigate to Clients section
3. Click "Add Client"
4. Verify form shows side-by-side layout:
   - LEFT: Client info (name, phone, email, enterprise toggle, etc.)
   - RIGHT: Property info (property_name, address, city, postal_code, district, type)
5. Fill both client and property forms
6. Submit
7. Verify client appears in clients list
8. Click on client row → "Manage Properties" button
9. Verify PropertyListModal opens showing created property with "PRIMARY" badge

**Property Management Test**:
1. From Clients list, click client → "Manage Properties"
2. Click "Add Property"
3. Fill PropertyFormModal
4. Submit → verify property appears in list
5. Click "Edit" on property → verify form pre-fills
6. Update property → verify changes persist
7. Click "Delete" on non-primary property → verify property removed
8. Try to delete primary property → verify auto-promotion (another property becomes primary)

**Cleaning Job Creation Test**:
1. Navigate to Cleaning Jobs section
2. Click "Add Cleaning Job"
3. Select client → verify property dropdown populates with client's properties
4. Verify form does NOT show property address input fields (property_name, address_line1, etc.)
5. Select property from dropdown
6. Fill remaining fields (job_type, scheduled_date, worker, etc.)
7. Submit → verify job created
8. View job details → verify property information displays correctly (joined from properties table)

---

## Acceptance Criteria

**Backend**:
- [ ] `routes/properties.js` implements GET, POST, PUT, DELETE endpoints
- [ ] `routes/role-types.js` provides role lookup endpoint
- [ ] `routes/property-types.js` provides property type lookup endpoint
- [ ] `routes/users.js` updated to accept V2 schema (single name, role_id)
- [ ] `routes/clients.js` accepts V2 schema (no address fields)
- [ ] `routes/cleaning-jobs.js` accepts property_id (not direct addresses)
- [ ] All endpoints registered in `server.js`
- [ ] Primary property deletion triggers auto-promotion
- [ ] Transaction rollback on property creation/deletion failures

**Frontend**:
- [ ] `UserModal.js` shows single name field, role_id dropdown, NO address fields
- [ ] `ClientModal.js` shows side-by-side client+property layout
- [ ] `PropertyListModal.js` displays client properties with PRIMARY badge
- [ ] `PropertyFormModal.js` allows add/edit property
- [ ] `CleaningJobModal.js` shows property dropdown (not address inputs)
- [ ] All forms submit V2-compatible payloads

**Functional**:
- [ ] Can create user (worker/admin) via WebUI with V2 fields
- [ ] Can create client+property via WebUI in one flow
- [ ] Can manage unlimited properties per client
- [ ] Can edit/delete properties via PropertyListModal
- [ ] Primary property auto-promotes on deletion
- [ ] Can create cleaning job selecting from client's properties
- [ ] No console errors on form submissions

**Testing**:
- [ ] `npm run test:seed` creates test users, clients, properties
- [ ] Manual API tests pass (curl commands)
- [ ] Manual WebUI tests pass (all scenarios above)

---

## Error Handling Patterns

**Backend Error Responses**:
```javascript
// NOT_FOUND
return errorResponse(res, 404, 'Property not found', 'NOT_FOUND', req);

// FORBIDDEN
return errorResponse(res, 403, 'Forbidden - cannot view other clients properties', 'FORBIDDEN', req);

// VALIDATION ERROR
return errorResponse(res, 400, 'Client already has a primary property', 'PRIMARY_EXISTS', req);

// SERVER ERROR
return errorResponse(res, 500, 'Server error', 'SERVER_ERROR', req);
```

**Frontend Error Handling**:
```javascript
try {
    await axios.post('/api/properties', formData);
    onSuccess();
} catch (error) {
    console.error('Error saving property:', error.response?.data || error);
    alert(error.response?.data?.error || 'Failed to save property');
}
```

---

## Notes for Developer Agent

1. **Database Schema is V2 (Portugal-only)**:
   - No `country` fields
   - Single `name` field (not first_name/last_name)
   - `role_id` FK (not role string)
   - Addresses in `properties` table (not clients/users)

2. **RBAC Enforcement**:
   - All property endpoints require `requireMasterOrAdmin`
   - Clients can view own properties (query-level filtering)

3. **Transaction Safety**:
   - Use `BEGIN/COMMIT/ROLLBACK` for property deletion with auto-promotion
   - Client+Property creation is sequential (not transactional) - backend creates client first, frontend creates property after

4. **Frontend-Backend Decoupling**:
   - Backend MUST ignore unknown fields sent by frontend (defensive)
   - Frontend MUST NOT send V1 fields (first_name, address_line1 on clients, etc.)

5. **Docker Rebuild Required**:
   - After code changes, run `docker-compose build --no-cache app`
   - Code is baked into image, not mounted

6. **Correlation IDs**:
   - All logs should include `[${req.correlationId}]`
   - All responses should include `_meta.correlationId`

---

## Deliverables Checklist

- [ ] `routes/properties.js` (NEW)
- [ ] `routes/role-types.js` (NEW)
- [ ] `routes/property-types.js` (NEW)
- [ ] `routes/users.js` (UPDATED - V2 schema)
- [ ] `routes/clients.js` (UPDATED - already done, verify)
- [ ] `routes/cleaning-jobs.js` (UPDATED - already done, verify)
- [ ] `server.js` (UPDATED - register new routes)
- [ ] `client/src/components/modals/UserModal.js` (UPDATED - V2 schema)
- [ ] `client/src/components/modals/ClientModal.js` (UPDATED - side-by-side layout)
- [ ] `client/src/components/modals/PropertyListModal.js` (NEW)
- [ ] `client/src/components/modals/PropertyFormModal.js` (NEW)
- [ ] `client/src/components/modals/CleaningJobModal.js` (UPDATED - property dropdown)
- [ ] Manual testing results documented
- [ ] E2E test pass rate improved (target: 80%+)

---

**END OF WORK ORDER**

**Next Step**: Tester Work Order (WO-20251114-TESTER-PROPERTY-MGMT.md)

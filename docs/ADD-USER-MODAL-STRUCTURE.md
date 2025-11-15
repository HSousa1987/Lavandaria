# Add User Modal - HTML Structure & Playwright Selectors

**File Location:** `/Applications/XAMPP/xamppfiles/htdocs/Lavandaria/client/src/pages/Dashboard.js` (lines 1250-1470)

**Modal Container:**
- Fixed overlay: `fixed inset-0 bg-black bg-opacity-50`
- Modal div: `bg-white rounded-lg p-6 max-w-2xl w-full`

---

## Form Fields & Their Actual Structure

### 1. Username Field
**HTML Structure:**
```jsx
<div className="col-span-2">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Username {!editingUser && '*'}
  </label>
  <input
    type="text"
    value={userForm.username}
    onChange={(e) => setUserForm({ ...userForm, username: sanitizeUsername(e.target.value) })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
    required={!editingUser}
    placeholder="Auto-generated from first and last name"
    readOnly={editingUser}
  />
  <p className="text-xs text-gray-500 mt-1">
    {editingUser ? 'Username cannot be changed' : 'Automatically generated from first and last name (you can edit it)'}
  </p>
</div>
```

**Playwright Selectors:**
- **Label:** `text=Username` (contains text "Username")
- **Input:** `input[type="text"][placeholder*="Auto-generated"]`
- **Helper Text:** `text=Automatically generated`

**Key Properties:**
- `type="text"`
- `placeholder="Auto-generated from first and last name"`
- `required` (when not editing)
- `readOnly` (when editing)
- Background: `bg-gray-50`

---

### 2. Password Field
**HTML Structure:**
```jsx
<div className="col-span-2">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Password {!editingUser && '*'} {editingUser && '(leave blank to keep current)'}
  </label>
  <input
    type="password"
    value={userForm.password}
    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    required={!editingUser}
    placeholder={editingUser ? 'Leave blank to keep current password' : ''}
  />
</div>
```

**Playwright Selectors:**
- **Label:** `text=Password`
- **Input:** `input[type="password"]`

**Key Properties:**
- `type="password"`
- `placeholder` varies (empty for create, "Leave blank to keep current password" for edit)
- `required` (when not editing)

---

### 3. Role Dropdown
**HTML Structure:**
```jsx
<div className="col-span-2">
  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
  <select
    value={userForm.role}
    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    disabled={editingUser && editingUser.role === 'master'}
  >
    {isMaster && <option value="master">Master</option>}
    {(isMaster || isAdmin) && <option value="admin">Admin</option>}
    <option value="worker">Worker</option>
  </select>
  {editingUser && editingUser.role === 'master' && (
    <p className="text-sm text-gray-500 mt-1">Master role cannot be changed</p>
  )}
</div>
```

**Playwright Selectors:**
- **Label:** `text=Role`
- **Select:** `select` (first select in form, or use nearby label)
- **Option "Worker":** Use `select_option` with value "worker"
- **Option "Admin":** Use `select_option` with value "admin"
- **Option "Master":** Use `select_option` with value "master" (only visible to Master users)

**Key Properties:**
- `<select>` not `<input>`
- Options: master (optional), admin (optional), worker (always)
- May be disabled when editing a Master user

---

### 4. First Name Field
**HTML Structure:**
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
  <input
    type="text"
    value={userForm.first_name}
    onChange={(e) => {
      const newFirstName = e.target.value;
      const newUsername = generateUsername(newFirstName, userForm.last_name);
      setUserForm({ ...userForm, first_name: newFirstName, username: newUsername });
    }}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    required
  />
</div>
```

**Playwright Selectors:**
- **Label:** `text=First Name`
- **Input:** Look for text input adjacent to "First Name" label

**Key Properties:**
- `type="text"`
- `required`
- **Side Effect:** Changing this value auto-updates the username

---

### 5. Last Name Field
**HTML Structure:**
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
  <input
    type="text"
    value={userForm.last_name}
    onChange={(e) => {
      const newLastName = e.target.value;
      const newUsername = generateUsername(userForm.first_name, newLastName);
      setUserForm({ ...userForm, last_name: newLastName, username: newUsername });
    }}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    required
  />
</div>
```

**Playwright Selectors:**
- **Label:** `text=Last Name`
- **Input:** Look for text input adjacent to "Last Name" label

**Key Properties:**
- `type="text"`
- `required`
- **Side Effect:** Changing this value auto-updates the username

---

### 6. Email Field
**HTML Structure:**
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
  <input
    type="email"
    value={userForm.email}
    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
  />
</div>
```

**Playwright Selectors:**
- **Label:** `text=Email` (and NOT "Email" followed by asterisk)
- **Input:** `input[type="email"]`

**Key Properties:**
- `type="email"`
- **Optional** (no required attribute)

---

### 7. Phone Field
**HTML Structure:**
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
  <input
    type="tel"
    value={userForm.phone}
    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    required
  />
</div>
```

**Playwright Selectors:**
- **Label:** `text=Phone`
- **Input:** `input[type="tel"]`

**Key Properties:**
- `type="tel"`
- `required`

---

### 8. Date of Birth Field
**HTML Structure:**
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
  <input
    type="date"
    value={userForm.date_of_birth}
    onChange={(e) => setUserForm({ ...userForm, date_of_birth: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    required
  />
</div>
```

**Playwright Selectors:**
- **Label:** `text=Date of Birth`
- **Input:** `input[type="date"]`

**Key Properties:**
- `type="date"`
- `required`
- Value format: `yyyy-MM-dd` (handled by `formatDateForInput()` function)

---

### 9. NIF (Tax ID) Field
**HTML Structure:**
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">NIF (Tax ID) *</label>
  <input
    type="text"
    value={userForm.nif}
    onChange={(e) => setUserForm({ ...userForm, nif: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    placeholder="123456789"
    required
  />
</div>
```

**Playwright Selectors:**
- **Label:** `text=NIF (Tax ID)` or `text=NIF` (depending on exact matching)
- **Input:** `input[placeholder="123456789"]` or nearby text input

**Key Properties:**
- `type="text"`
- `placeholder="123456789"`
- `required`

---

### 10. Address Line 1 Field
**HTML Structure:**
```jsx
<div className="col-span-2">
  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
  <input
    type="text"
    value={userForm.address_line1}
    onChange={(e) => setUserForm({ ...userForm, address_line1: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    placeholder="Street name and number"
    required
  />
</div>
```

**Playwright Selectors:**
- **Label:** `text=Address Line 1`
- **Input:** `input[placeholder="Street name and number"]`

**Key Properties:**
- `type="text"`
- `placeholder="Street name and number"`
- `required`
- `col-span-2` (full width)

---

### 11. Address Line 2 Field
**HTML Structure:**
```jsx
<div className="col-span-2">
  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
  <input
    type="text"
    value={userForm.address_line2}
    onChange={(e) => setUserForm({ ...userForm, address_line2: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    placeholder="Apartment, floor, building (optional)"
  />
</div>
```

**Playwright Selectors:**
- **Label:** `text=Address Line 2`
- **Input:** `input[placeholder*="Apartment"]`

**Key Properties:**
- `type="text"`
- `placeholder="Apartment, floor, building (optional)"`
- **Optional** (no required attribute)
- `col-span-2` (full width)

---

### 12. City Field
**HTML Structure:**
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
  <input
    type="text"
    value={userForm.city}
    onChange={(e) => setUserForm({ ...userForm, city: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    placeholder="Lisboa, Porto, etc."
    required
  />
</div>
```

**Playwright Selectors:**
- **Label:** `text=City` (exactly, not "City Name" etc.)
- **Input:** `input[placeholder*="Lisboa"]` or `input[placeholder*="Porto"]`

**Key Properties:**
- `type="text"`
- `placeholder="Lisboa, Porto, etc."`
- `required`

---

### 13. Postal Code Field
**HTML Structure:**
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code *</label>
  <input
    type="text"
    value={userForm.postal_code}
    onChange={(e) => setUserForm({ ...userForm, postal_code: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    placeholder="XXXX-XXX (e.g., 1000-001)"
    required
  />
</div>
```

**Playwright Selectors:**
- **Label:** `text=Postal Code`
- **Input:** `input[placeholder*="XXXX-XXX"]` or `input[placeholder*="1000-001"]`

**Key Properties:**
- `type="text"`
- `placeholder="XXXX-XXX (e.g., 1000-001)"`
- `required`

---

### 14. District Dropdown
**HTML Structure:**
```jsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
  <select
    value={userForm.district}
    onChange={(e) => setUserForm({ ...userForm, district: e.target.value })}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
  >
    <option value="">Select District</option>
    <option value="Aveiro">Aveiro</option>
    <option value="Beja">Beja</option>
    <option value="Braga">Braga</option>
    <option value="Bragança">Bragança</option>
    <option value="Castelo Branco">Castelo Branco</option>
    <option value="Coimbra">Coimbra</option>
    <option value="Évora">Évora</option>
    <option value="Faro">Faro</option>
    <option value="Guarda">Guarda</option>
    <option value="Leiria">Leiria</option>
    <option value="Lisboa">Lisboa</option>
    <option value="Portalegre">Portalegre</option>
    <option value="Porto">Porto</option>
    <option value="Santarém">Santarém</option>
    <option value="Setúbal">Setúbal</option>
    <option value="Viana do Castelo">Viana do Castelo</option>
    <option value="Vila Real">Vila Real</option>
    <option value="Viseu">Viseu</option>
    <option value="Açores">Açores</option>
    <option value="Madeira">Madeira</option>
  </select>
</div>
```

**Playwright Selectors:**
- **Label:** `text=District` (exactly)
- **Select:** Look for `<select>` adjacent to "District" label
- **Option "Lisboa":** Use `select_option` with value "Lisboa"
- **Option "Porto":** Use `select_option` with value "Porto"

**Key Properties:**
- `<select>` not `<input>`
- **Optional** (no required attribute)
- First option: `<option value="">Select District</option>`
- 19 Portuguese districts + Açores + Madeira

---

### 15. Active Checkbox
**HTML Structure:**
```jsx
<div className="col-span-2">
  <label className="flex items-center space-x-2 cursor-pointer">
    <input
      type="checkbox"
      checked={userForm.is_active}
      onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })}
      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
    />
    <span className="text-sm font-medium text-gray-700">Active (user can login)</span>
  </label>
</div>
```

**Playwright Selectors:**
- **Label:** `text=Active (user can login)` or `text=Active`
- **Checkbox:** `input[type="checkbox"]` (look for one with nearby "Active" text)

**Key Properties:**
- `type="checkbox"`
- Label text: "Active (user can login)"
- `col-span-2` (full width)

---

## Form Layout Structure

```
Grid: grid grid-cols-2 gap-3

Full Width (col-span-2):
- Username
- Password
- Role
- Address Line 1
- Address Line 2
- Active Checkbox

Half Width (col-span-1, side-by-side):
- First Name | Last Name
- Email | Phone
- Date of Birth | NIF
- City | Postal Code
- District | (empty)
```

---

## Form Submission & Buttons

**HTML Structure:**
```jsx
<div className="flex gap-3">
  <button
    type="submit"
    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
  >
    {editingUser ? 'Update User' : 'Create User'}
  </button>
  <button
    type="button"
    onClick={() => setShowUserForm(false)}
    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
  >
    Cancel
  </button>
</div>
```

**Playwright Selectors:**
- **Submit Button:** `button:has-text("Create User")` or `button:has-text("Update User")`
- **Cancel Button:** `button:has-text("Cancel")`

---

## Accessibility Notes

**Current Implementation:**
- Uses `<label>` elements with `for` attribute (implied by structure)
- No explicit `aria-label` attributes
- No `aria-describedby` for helper text
- No `aria-invalid` for error states
- Placeholder text used for some UX hints

**Recommendation for Tests:**
Use label text matching for most reliable selection:
```javascript
// Good: label-based selection
await page.locator('text=Username').first().fill('...');

// Also good: type-based with nearby context
await page.locator('input[type="text"][placeholder*="Auto-generated"]').fill('...');

// Avoid: generic selectors without context
await page.locator('input').first(); // Too generic!
```

---

## Testing Helper: Field Order in DOM

When filling the form in a test, this is the order fields appear in the HTML:

1. Username
2. Password
3. Role
4. First Name (left column)
5. Last Name (right column)
6. Email (left column)
7. Phone (right column)
8. Date of Birth (left column)
9. NIF (right column)
10. Address Line 1 (full width)
11. Address Line 2 (full width)
12. City (left column)
13. Postal Code (right column)
14. District (left column)
15. Active Checkbox (full width)
16. Submit Button
17. Cancel Button


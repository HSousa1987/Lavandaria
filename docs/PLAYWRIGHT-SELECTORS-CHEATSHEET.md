# Playwright Selectors - Add User Modal Cheat Sheet

Quick reference for filling the "Add User" modal form in E2E tests.

## Recommended Selector Pattern

Use this pattern for reliable, maintainable selectors:

```javascript
// For inputs near labels
await page.locator('label:has-text("Field Name")').locator('..').fill('value');

// For inputs with specific types
await page.locator('input[type="email"]').fill('user@example.com');

// For selects
await page.selectOption('select:has-text("Role")', 'worker');

// For checkboxes
await page.locator('input[type="checkbox"]:has-text("Active")').check();
```

---

## Field-by-Field Selectors

### Username
```javascript
// Using label
await page.locator('label:has-text("Username")').locator('.. input[type="text"]').fill('john_doe');

// Using placeholder
await page.locator('input[placeholder*="Auto-generated"]').fill('john_doe');
```

### Password
```javascript
// Direct type selector
await page.locator('input[type="password"]').fill('SecurePassword123');
```

### Role Dropdown
```javascript
// Method 1: Using fill with select
const roleSelect = page.locator('label:has-text("Role")').locator('.. select');
await roleSelect.selectOption('worker');

// Method 2: Direct select
await page.selectOption('select', 'admin');

// Available options: 'master', 'admin', 'worker'
```

### First Name
```javascript
// Using label and relative path
await page.locator('label:has-text("First Name")').locator('.. input').fill('John');
```

### Last Name
```javascript
// Using label and relative path
await page.locator('label:has-text("Last Name")').locator('.. input').fill('Doe');
```

### Email
```javascript
// Using type selector
await page.locator('input[type="email"]').fill('john@example.com');
```

### Phone
```javascript
// Using type selector
await page.locator('input[type="tel"]').fill('+351910000000');
```

### Date of Birth
```javascript
// Using type selector - format must be yyyy-MM-dd
await page.locator('input[type="date"]').fill('1990-05-15');
```

### NIF (Tax ID)
```javascript
// Using placeholder
await page.locator('input[placeholder="123456789"]').fill('123456789');

// Or using label
await page.locator('label:has-text("NIF")').locator('.. input').fill('123456789');
```

### Address Line 1
```javascript
// Using placeholder
await page.locator('input[placeholder="Street name and number"]').fill('Rua Principal 123');
```

### Address Line 2
```javascript
// Using placeholder (contains "Apartment")
await page.locator('input[placeholder*="Apartment"]').fill('Apt 5B');
```

### City
```javascript
// Using placeholder
await page.locator('input[placeholder*="Lisboa"]').fill('Lisboa');
```

### Postal Code
```javascript
// Using placeholder
await page.locator('input[placeholder*="1000-001"]').fill('1000-001');
```

### District
```javascript
// Using select option
const districtSelect = page.locator('label:has-text("District")').locator('.. select');
await districtSelect.selectOption('Lisboa');

// Available options: Aveiro, Beja, Braga, Bragança, Castelo Branco, Coimbra, 
// Évora, Faro, Guarda, Leiria, Lisboa, Portalegre, Porto, Santarém, Setúbal,
// Viana do Castelo, Vila Real, Viseu, Açores, Madeira
```

### Active Checkbox
```javascript
// Check the "Active (user can login)" checkbox
await page.locator('input[type="checkbox"]').check();

// Or uncheck it
await page.locator('input[type="checkbox"]').uncheck();

// Using label
await page.locator('text=Active (user can login)').locator('.. input[type="checkbox"]').check();
```

---

## Complete Form Fill Example

```javascript
// Open the Add User form first (click button)
await page.locator('button:has-text("Add User")').click();
await page.waitForSelector('text=Add New User');

// Fill all fields
await page.locator('input[placeholder*="Auto-generated"]').fill('john_doe');
await page.locator('input[type="password"]').fill('TestPassword123');
await page.locator('select').first().selectOption('worker');
await page.locator('label:has-text("First Name")').locator('.. input').fill('John');
await page.locator('label:has-text("Last Name")').locator('.. input').fill('Doe');
await page.locator('input[type="email"]').fill('john.doe@example.com');
await page.locator('input[type="tel"]').fill('+351910000000');
await page.locator('input[type="date"]').fill('1990-05-15');
await page.locator('input[placeholder="123456789"]').fill('123456789');
await page.locator('input[placeholder="Street name and number"]').fill('Rua Principal 123');
await page.locator('input[placeholder*="Apartment"]').fill('Apt 5B');
await page.locator('input[placeholder*="Lisboa"]').fill('Lisboa');
await page.locator('input[placeholder*="1000-001"]').fill('1000-001');

// Select district
const districtSelect = page.locator('label:has-text("District")').locator('.. select');
await districtSelect.selectOption('Lisboa');

// Check active
await page.locator('input[type="checkbox"]').check();

// Submit
await page.locator('button:has-text("Create User")').click();
```

---

## Important Notes

1. **Date Format:** Must be `yyyy-MM-dd` for date inputs
2. **Relative Paths:** Use `.. ` to go up from label to parent container
3. **Multiple Inputs:** Use type selectors when uniqueness is guaranteed (e.g., only one `input[type="tel"]`)
4. **Placeholder Matching:** Use `*=` for partial matches (e.g., `placeholder*="Lisa"`)
5. **Locator Waiting:** Playwright waits by default, but use `waitForSelector` if needed

---

## Troubleshooting Selectors

If a selector isn't working:

1. **Check the modal is visible:**
   ```javascript
   await page.waitForSelector('text=Add New User');
   ```

2. **Use more specific paths:**
   ```javascript
   // Instead of generic "input"
   await page.locator('input[type="text"][placeholder*="specific"]').fill('value');
   ```

3. **Debug with snapshots:**
   ```javascript
   const snapshot = await page.snapshot();
   console.log(snapshot); // Check actual DOM
   ```

4. **Use page.locator with visible option:**
   ```javascript
   await page.locator('input[type="email"]:visible').fill('test@example.com');
   ```

---

## Related Files

- **Source Component:** `/Applications/XAMPP/xamppfiles/htdocs/Lavandaria/client/src/pages/Dashboard.js` (lines 1250-1470)
- **Full Structure Reference:** `/Applications/XAMPP/xamppfiles/htdocs/Lavandaria/docs/ADD-USER-MODAL-STRUCTURE.md`

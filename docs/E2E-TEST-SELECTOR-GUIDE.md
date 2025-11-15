# E2E Test Selector Guide - Quick Start

## Summary: What You Need to Know

The "Add User" modal form in Dashboard.js has **15 form fields** organized in a 2-column grid layout.

**Key Finding:** All fields use standard HTML `<label>` elements paired with inputs - making Playwright selectors reliable and accessible.

---

## Three Ways to Select Fields (in order of preference)

### 1. Label-Based Selection (BEST - Most Readable)
```javascript
// Finds the label with text "Email" then locates the input after it
await page.locator('label:has-text("Email")').locator('.. input').fill('test@example.com');
```

**Pros:**
- Mimics real user interaction with form labels
- Works even if DOM structure changes slightly
- Accessible-friendly
- Self-documenting code

**Cons:**
- Slightly longer syntax

---

### 2. Type-Based Selection (GOOD - When Type is Unique)
```javascript
// Only works when there's just ONE input[type="email"] on the page
await page.locator('input[type="email"]').fill('test@example.com');
```

**Pros:**
- Concise
- Good for type-specific fields (date, tel, email)

**Cons:**
- Breaks if another email input is added
- Not all fields have unique types (many `input[type="text"]`)

---

### 3. Placeholder-Based Selection (OK - Last Resort)
```javascript
// Use placeholder text if label+relative doesn't work
await page.locator('input[placeholder*="1000-001"]').fill('1000-001');
```

**Pros:**
- Useful for fields without clear labels
- Specific enough for most cases

**Cons:**
- Breaks if placeholder changes
- Less semantic

---

## Quick Reference by Field Type

### Text Inputs (Username, First Name, Last Name, etc.)
```javascript
// Recommended approach
await page.locator('label:has-text("Username")').locator('.. input').fill('john_doe');

// Alternative with placeholder
await page.locator('input[placeholder*="Auto-generated"]').fill('john_doe');
```

### Password Input
```javascript
// Only one password field, so this is safe
await page.locator('input[type="password"]').fill('SecurePass123');
```

### Email Input
```javascript
// Only one email field on the modal
await page.locator('input[type="email"]').fill('john@example.com');
```

### Tel Input (Phone)
```javascript
// Only one tel field
await page.locator('input[type="tel"]').fill('+351910000000');
```

### Date Input (Date of Birth)
```javascript
// Only one date field - MUST be yyyy-MM-dd format
await page.locator('input[type="date"]').fill('1990-05-15');
```

### Select Dropdowns (Role, District)
```javascript
// For role dropdown
const roleSelect = page.locator('label:has-text("Role")').locator('.. select');
await roleSelect.selectOption('worker');

// For district dropdown
const districtSelect = page.locator('label:has-text("District")').locator('.. select');
await districtSelect.selectOption('Lisboa');
```

### Checkbox (Active)
```javascript
// Only one checkbox on the modal
await page.locator('input[type="checkbox"]').check();
```

---

## Complete Field List with Best Selectors

| Field | Type | Best Selector | Notes |
|-------|------|---------------|-------|
| Username | text | `label:has-text("Username") .. input` | Auto-readonly when editing |
| Password | password | `input[type="password"]` | Only one on form |
| Role | select | `label:has-text("Role") .. select` | Options: master, admin, worker |
| First Name | text | `label:has-text("First Name") .. input` | Auto-updates username |
| Last Name | text | `label:has-text("Last Name") .. input` | Auto-updates username |
| Email | email | `input[type="email"]` | Only one on form |
| Phone | tel | `input[type="tel"]` | Only one on form |
| Date of Birth | date | `input[type="date"]` | Format: yyyy-MM-dd |
| NIF (Tax ID) | text | `input[placeholder="123456789"]` | Portuguese tax ID |
| Address Line 1 | text | `input[placeholder="Street name..."]` | Full width |
| Address Line 2 | text | `input[placeholder*="Apartment"]` | Optional |
| City | text | `input[placeholder*="Lisboa"]` | Portuguese cities |
| Postal Code | text | `input[placeholder*="1000-001"]` | Format: XXXX-XXX |
| District | select | `label:has-text("District") .. select` | 20 Portuguese districts |
| Active | checkbox | `input[type="checkbox"]` | Only one on form |

---

## Complete Form Fill Template

Use this as a template for E2E tests:

```javascript
test('should create a new user', async ({ page }) => {
  // Navigate to dashboard
  await page.goto('http://localhost:3000/dashboard');
  
  // Open the Add User modal
  await page.locator('button:has-text("Add User")').click();
  await page.waitForSelector('text=Add New User');
  
  // Fill required fields (minimum for form submission)
  await page.locator('label:has-text("Username")').locator('.. input').fill('john_doe');
  await page.locator('input[type="password"]').fill('TestPassword123!');
  
  const roleSelect = page.locator('label:has-text("Role")').locator('.. select');
  await roleSelect.selectOption('worker');
  
  await page.locator('label:has-text("First Name")').locator('.. input').fill('John');
  await page.locator('label:has-text("Last Name")').locator('.. input').fill('Doe');
  await page.locator('input[type="tel"]').fill('+351910000000');
  await page.locator('input[type="date"]').fill('1990-05-15');
  await page.locator('input[placeholder="123456789"]').fill('123456789');
  await page.locator('input[placeholder="Street name and number"]').fill('Rua Principal 123');
  await page.locator('input[placeholder*="Lisboa"]').fill('Lisboa');
  await page.locator('input[placeholder*="1000-001"]').fill('1000-001');
  
  // Fill optional fields
  await page.locator('input[type="email"]').fill('john.doe@example.com');
  await page.locator('input[placeholder*="Apartment"]').fill('Apt 5B');
  
  const districtSelect = page.locator('label:has-text("District")').locator('.. select');
  await districtSelect.selectOption('Lisboa');
  
  await page.locator('input[type="checkbox"]').check();
  
  // Submit
  await page.locator('button:has-text("Create User")').click();
  
  // Verify success
  await page.waitForSelector('text=User created successfully');
});
```

---

## Common Issues & Solutions

### Issue: "Username field is read-only"
**Cause:** Form is in edit mode, not create mode
**Solution:** Check if `editingUser` is truthy in the component state
```javascript
// Create mode: username is editable
// Edit mode: username is read-only
```

### Issue: Can't find District dropdown
**Cause:** Using generic `select` selector when there are 2 selects (Role + District)
**Solution:** Use label-based selector
```javascript
// WRONG: Selects the first <select> (which is Role)
await page.selectOption('select', 'Lisboa');

// RIGHT: Targets the District select specifically
const districtSelect = page.locator('label:has-text("District")').locator('.. select');
await districtSelect.selectOption('Lisboa');
```

### Issue: Date field won't accept value
**Cause:** Date format is wrong
**Solution:** Use `yyyy-MM-dd` format exactly
```javascript
// WRONG formats
await page.locator('input[type="date"]').fill('15/05/1990');  // ❌
await page.locator('input[type="date"]').fill('May 15, 1990'); // ❌

// RIGHT format
await page.locator('input[type="date"]').fill('1990-05-15');   // ✅
```

### Issue: Phone field not accepting value
**Cause:** May need to clear first or handle locale
**Solution:** Use `fill()` which clears automatically
```javascript
// This will clear and type in one operation
await page.locator('input[type="tel"]').fill('+351910000000');
```

---

## File Locations for Reference

1. **Source Code:** `/Applications/XAMPP/xamppfiles/htdocs/Lavandaria/client/src/pages/Dashboard.js` (lines 1250-1470)

2. **Full Structure:** `/Applications/XAMPP/xamppfiles/htdocs/Lavandaria/docs/ADD-USER-MODAL-STRUCTURE.md`
   - Complete HTML for all fields
   - Detailed properties (required, placeholder, type, etc.)
   - Accessibility notes

3. **Selectors Cheatsheet:** `/Applications/XAMPP/xamppfiles/htdocs/Lavandaria/docs/PLAYWRIGHT-SELECTORS-CHEATSHEET.md`
   - Field-by-field selector examples
   - Troubleshooting guide

---

## Testing Workflow

```bash
# 1. Start the app
npm run dev

# 2. Run E2E tests
npm run test:e2e

# 3. If tests fail, debug with UI
npm run test:e2e:ui

# 4. View HTML report
npm run test:e2e:report
```

---

## Pro Tips

1. **Always wait for modal to appear before interacting:**
   ```javascript
   await page.waitForSelector('text=Add New User');
   ```

2. **Use locator chains for clarity:**
   ```javascript
   // Good: Reads like "find label with 'Email', then find input in its container"
   const emailInput = page.locator('label:has-text("Email")').locator('.. input');
   await emailInput.fill('test@example.com');
   ```

3. **Test both create and edit flows:**
   ```javascript
   // Create mode: all fields editable
   // Edit mode: username is read-only, password optional
   ```

4. **Validate after submission:**
   ```javascript
   await page.locator('button:has-text("Create User")').click();
   await page.waitForSelector('text=User created'); // Wait for confirmation
   ```

---

Last Updated: 2025-11-09

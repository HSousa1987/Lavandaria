/**
 * Smoke Test: Frontend V2 Schema Critical Fix
 *
 * Tests 10 smoke test cases covering:
 * 1. Login
 * 2. Users Table Name Column
 * 3. Clients Table Name Column
 * 4. UserModal Opens
 * 5. UserModal V2 Fields
 * 6. Create Test Worker
 * 7. ClientModal Opens
 * 8. ClientModal V2 Fields
 * 9. Create Test Client
 * 10. Console Clean
 */

const { test, expect } = require('@playwright/test');

const MASTER_CREDENTIALS = {
  username: 'master',
  password: 'master123'
};

test.describe('Smoke Test: Frontend V2 Schema Fix', () => {
  test.setTimeout(60000);

  test('1. Login as Master', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Fill login
    await page.fill('input[name="username"]', MASTER_CREDENTIALS.username);
    await page.fill('input[name="password"]', MASTER_CREDENTIALS.password);
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('2. Users Table Name Column displays correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Click Users tab
    const usersTab = page.locator('button:has-text("All Users")').first();
    await usersTab.waitFor({ state: 'visible', timeout: 10000 });
    await usersTab.click();
    await page.waitForLoadState('networkidle');

    // Verify Name column shows content (not empty)
    const nameCell = page.locator('table tbody tr:first-child td:nth-child(2)');
    await nameCell.waitFor({ state: 'visible', timeout: 10000 });
    const nameText = await nameCell.textContent();

    expect(nameText).toBeTruthy();
    expect(nameText).not.toBe('');
    expect(nameText).toContain('Master User');
  });

  test('3. Clients Table Name Column displays correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Click Clients tab
    const clientsTab = page.locator('button:has-text("Clients")').first();
    await clientsTab.waitFor({ state: 'visible', timeout: 10000 });
    await clientsTab.click();
    await page.waitForLoadState('networkidle');

    // Verify Name column shows content (not empty)
    const nameCell = page.locator('table tbody tr:first-child td:first-child');
    await nameCell.waitFor({ state: 'visible', timeout: 5000 });
    const nameText = await nameCell.textContent();

    expect(nameText).toBeTruthy();
    expect(nameText).not.toBe('');
  });

  test('4. UserModal Opens when Add User clicked', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Click Users tab
    const usersTab = page.locator('button:has-text("All Users")').first();
    await usersTab.waitFor({ state: 'visible', timeout: 10000 });
    await usersTab.click();
    await page.waitForLoadState('networkidle');

    // Click Add User button
    const addUserBtn = page.locator('button:has-text("Add User")').first();
    await addUserBtn.waitFor({ state: 'visible', timeout: 10000 });
    await addUserBtn.click();
    await page.waitForTimeout(500); // Wait for modal animation

    // Verify modal appears
    const modalTitle = page.locator('h2:has-text("Add User")');
    await modalTitle.waitFor({ state: 'visible', timeout: 5000 });
  });

  test('5. UserModal shows V2 schema fields', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Click Users tab
    const usersTab = page.locator('button:has-text("All Users")').first();
    await usersTab.waitFor({ state: 'visible', timeout: 10000 });
    await usersTab.click();
    await page.waitForLoadState('networkidle');

    // Click Add User button
    const addUserBtn = page.locator('button:has-text("Add User")').first();
    await addUserBtn.waitFor({ state: 'visible', timeout: 10000 });
    await addUserBtn.click();
    await page.waitForTimeout(500);

    // Verify V2 fields present
    const usernameField = page.locator('input[name="username"]');
    const passwordField = page.locator('input[name="password"]');
    const roleSelect = page.locator('select[name="role_id"]');
    const nameField = page.locator('input[name="name"]');
    const emailField = page.locator('input[name="email"]');
    const phoneField = page.locator('input[name="phone"]');

    await expect(usernameField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(roleSelect).toBeVisible();
    await expect(nameField).toBeVisible();
    await expect(emailField).toBeVisible();
    await expect(phoneField).toBeVisible();

    // Verify NO V1 fields present (first_name, last_name)
    const firstNameField = page.locator('input[name="first_name"]');
    const lastNameField = page.locator('input[name="last_name"]');

    await expect(firstNameField).not.toBeVisible();
    await expect(lastNameField).not.toBeVisible();
  });

  test('6. Can create test worker via UserModal', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Click Users tab
    const usersTab = page.locator('button:has-text("All Users")').first();
    await usersTab.waitFor({ state: 'visible', timeout: 10000 });
    await usersTab.click();
    await page.waitForLoadState('networkidle');

    // Click Add User button
    const addUserBtn = page.locator('button:has-text("Add User")').first();
    await addUserBtn.waitFor({ state: 'visible', timeout: 10000 });
    await addUserBtn.click();
    await page.waitForTimeout(500);

    // Fill form
    await page.fill('input[name="username"]', 'smoke_test_worker');
    await page.fill('input[name="password"]', 'test12345');
    await page.selectOption('select[name="role_id"]', { label: 'Worker' });
    await page.fill('input[name="name"]', 'Smoke Test Worker');
    await page.fill('input[name="email"]', 'smoke@test.com');
    await page.fill('input[name="phone"]', '919999999');

    // Submit
    const submitBtn = page.locator('button:has-text("Create User")');
    await submitBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify worker appears in table
    const newWorkerRow = page.locator('text=Smoke Test Worker');
    await expect(newWorkerRow).toBeVisible({ timeout: 10000 });
  });

  test('7. ClientModal Opens when Add Client clicked', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Click Clients tab
    const clientsTab = page.locator('button:has-text("Clients")').first();
    await clientsTab.waitFor({ state: 'visible', timeout: 10000 });
    await clientsTab.click();
    await page.waitForLoadState('networkidle');

    // Click Add Client button
    const addClientBtn = page.locator('button:has-text("Add Client")').first();
    await addClientBtn.waitFor({ state: 'visible', timeout: 10000 });
    await addClientBtn.click();
    await page.waitForTimeout(500);

    // Verify modal appears
    const modalTitle = page.locator('h2:has-text("Add Client")');
    await modalTitle.waitFor({ state: 'visible', timeout: 5000 });
  });

  test('8. ClientModal shows V2 schema fields', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Click Clients tab
    const clientsTab = page.locator('button:has-text("Clients")').first();
    await clientsTab.waitFor({ state: 'visible', timeout: 10000 });
    await clientsTab.click();
    await page.waitForLoadState('networkidle');

    // Click Add Client button
    const addClientBtn = page.locator('button:has-text("Add Client")').first();
    await addClientBtn.waitFor({ state: 'visible', timeout: 10000 });
    await addClientBtn.click();
    await page.waitForTimeout(500);

    // Verify V2 fields present
    const nameField = page.locator('input[name="name"]');
    const phoneField = page.locator('input[name="phone"]');
    const emailField = page.locator('input[name="email"]');
    const enterpriseCheckbox = page.locator('input[name="is_enterprise"]');

    await expect(nameField).toBeVisible();
    await expect(phoneField).toBeVisible();
    await expect(emailField).toBeVisible();
    await expect(enterpriseCheckbox).toBeVisible();

    // Verify NO V1 address fields present
    const addressField = page.locator('input[name="address_line1"]');
    await expect(addressField).not.toBeVisible();
  });

  test('9. Can create test client via ClientModal', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Click Clients tab
    const clientsTab = page.locator('button:has-text("Clients")').first();
    await clientsTab.waitFor({ state: 'visible', timeout: 10000 });
    await clientsTab.click();
    await page.waitForLoadState('networkidle');

    // Click Add Client button
    const addClientBtn = page.locator('button:has-text("Add Client")').first();
    await addClientBtn.waitFor({ state: 'visible', timeout: 10000 });
    await addClientBtn.click();
    await page.waitForTimeout(500);

    // Fill form
    await page.fill('input[name="name"]', 'Smoke Test Client');
    await page.fill('input[name="phone"]', '919888888');
    await page.fill('input[name="email"]', 'smokeclient@test.com');

    // Submit
    const submitBtn = page.locator('button:has-text("Create Client")');
    await submitBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify client appears in table
    const newClientRow = page.locator('text=Smoke Test Client');
    await expect(newClientRow).toBeVisible({ timeout: 10000 });
  });

  test('10. Console is clean (no JavaScript errors)', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Click Users tab
    const usersTab = page.locator('button:has-text("All Users")').first();
    await usersTab.waitFor({ state: 'visible', timeout: 10000 });
    await usersTab.click();
    await page.waitForLoadState('networkidle');

    // Click Clients tab
    const clientsTab = page.locator('button:has-text("Clients")').first();
    await clientsTab.waitFor({ state: 'visible', timeout: 10000 });
    await clientsTab.click();
    await page.waitForLoadState('networkidle');

    // Open UserModal
    const addUserBtn = page.locator('button:has-text("Add User")').first();
    if (await addUserBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addUserBtn.click();
      await page.waitForTimeout(500);
    }

    // Verify no errors
    expect(errors.length).toBe(0);
  });
});

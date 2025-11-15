/**
 * 🎯 Maestro Full CRUD Validation Suite
 *
 * Tests EVERYTHING through the UI like a real user would:
 * - Login all roles
 * - Create entities (Admin, Worker, Client, Jobs, Orders)
 * - Edit every field
 * - Delete entities
 * - Upload photos
 * - Update statuses
 * - Record payments
 *
 * This is the comprehensive system validation requested by the user.
 * All tests use UI interactions (clicks, fills, selects) NOT API calls.
 */

const { test, expect } = require('@playwright/test');

// Test credentials from seeded data
const CREDENTIALS = {
  master: { username: 'master', password: 'master123', type: 'Staff' },
  admin: { username: 'admin', password: 'admin123', type: 'Staff' },
  worker: { username: 'worker', password: 'worker123', type: 'Staff' }
};

/**
 * Helper: Login through UI
 */
async function loginViaUI(page, role) {
  const creds = CREDENTIALS[role];

  // First, go to dashboard and logout to clear session
  await page.goto('http://localhost:3000/dashboard');
  const logoutButton = page.getByRole('button', { name: /logout/i });
  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click();
    await page.waitForURL(/\/$/, { timeout: 5000 });
  }

  // Now navigate to login
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // Click Staff or Client button (NOT tab role - these are plain buttons)
  if (creds.type === 'Staff') {
    await page.getByRole('button', { name: 'Staff' }).click();
  }

  // Fill credentials
  await page.getByPlaceholder(/username/i).fill(creds.username);
  await page.getByPlaceholder(/password/i).fill(creds.password);

  // Submit
  await page.getByRole('button', { name: /login/i }).click();

  // Wait for dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });

  console.log(`✅ Logged in as ${role}`);
}

/**
 * Helper: Wait for success message with correlation ID
 */
async function waitForSuccess(page, action) {
  const successMessage = page.locator('.bg-green-100, .text-green-700, [role="alert"]').filter({ hasText: /success|created|updated|deleted/i });
  await expect(successMessage).toBeVisible({ timeout: 5000 });

  // Extract correlation ID if present
  const text = await successMessage.textContent();
  const correlationMatch = text.match(/req_\w+/);
  if (correlationMatch) {
    console.log(`✅ ${action} successful with correlation ID: ${correlationMatch[0]}`);
  }
}

test.describe('🎯 Maestro Full CRUD Validation - User Management', () => {

  test('Master creates Admin user via UI', async ({ page }) => {
    await loginViaUI(page, 'master');

    // Navigate to Users tab
    await page.getByRole('tab', { name: /users/i }).click();

    // Click Add User button
    await page.getByRole('button', { name: /add user/i }).click();

    // Modal should open
    await expect(page.getByRole('heading', { name: /create new user/i })).toBeVisible();

    // Fill form
    const timestamp = Date.now();
    await page.getByLabel(/username/i).fill(`testadmin${timestamp}`);
    await page.getByLabel(/^password/i).fill('testpass123');
    await page.getByLabel(/role/i).selectOption('admin');
    await page.getByLabel(/phone/i).fill('912345678');

    // Submit
    await page.getByRole('button', { name: /create user/i }).click();

    // Wait for success
    await waitForSuccess(page, 'User creation');

    // Verify user appears in list
    await expect(page.getByText(`testadmin${timestamp}`)).toBeVisible();
  });

  test('Master edits Admin user via UI', async ({ page }) => {
    await loginViaUI(page, 'master');

    // Navigate to Users tab
    await page.getByRole('tab', { name: /users/i }).click();

    // Find first admin in list and click Edit
    const firstAdminRow = page.locator('tr', { hasText: /admin/i }).first();
    await firstAdminRow.getByRole('button', { name: /edit/i }).click();

    // Modal should open with pre-filled data
    await expect(page.getByRole('heading', { name: /edit user|update user/i })).toBeVisible();

    // Change phone
    await page.getByLabel(/phone/i).fill('919999999');

    // Submit
    await page.getByRole('button', { name: /update|save/i }).click();

    // Wait for success
    await waitForSuccess(page, 'User update');

    // Verify updated phone appears
    await expect(page.getByText('919999999')).toBeVisible();
  });

  test('Master deletes Worker user via UI', async ({ page }) => {
    await loginViaUI(page, 'master');

    // First create a worker to delete
    await page.getByRole('tab', { name: /users/i }).click();
    await page.getByRole('button', { name: /add user/i }).click();

    const timestamp = Date.now();
    await page.getByLabel(/username/i).fill(`deleteme${timestamp}`);
    await page.getByLabel(/^password/i).fill('testpass123');
    await page.getByLabel(/role/i).selectOption('worker');
    await page.getByLabel(/phone/i).fill('911111111');
    await page.getByRole('button', { name: /create user/i }).click();

    await waitForSuccess(page, 'Worker creation');

    // Now delete it
    const workerRow = page.locator('tr', { hasText: `deleteme${timestamp}` });
    await workerRow.getByRole('button', { name: /delete/i }).click();

    // Confirm deletion dialog
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('delete');
      dialog.accept();
    });

    // Wait for success
    await waitForSuccess(page, 'User deletion');

    // Verify user removed from list
    await expect(page.getByText(`deleteme${timestamp}`)).not.toBeVisible();
  });
});

test.describe('🎯 Maestro Full CRUD Validation - Client Management', () => {

  test('Admin creates Client via UI', async ({ page }) => {
    await loginViaUI(page, 'admin');

    // Navigate to Clients tab
    await page.getByRole('tab', { name: /clients/i }).click();

    // Click Add Client button
    await page.getByRole('button', { name: /add client/i }).click();

    // Modal should open
    await expect(page.getByRole('heading', { name: /create new client/i })).toBeVisible();

    // Fill form
    const timestamp = Date.now();
    await page.getByLabel(/^name/i).fill(`Test Client ${timestamp}`);
    await page.getByLabel(/phone/i).fill('922222222');
    await page.getByLabel(/email/i).fill(`testclient${timestamp}@test.com`);
    await page.getByLabel(/address/i).fill('123 Test Street, Porto');
    await page.getByLabel(/notes/i).fill('Created by Maestro E2E test');

    // Submit
    await page.getByRole('button', { name: /create client/i }).click();

    // Wait for success
    await waitForSuccess(page, 'Client creation');

    // Verify client appears in list
    await expect(page.getByText(`Test Client ${timestamp}`)).toBeVisible();
  });

  test('Admin edits Client via UI - change every field', async ({ page }) => {
    await loginViaUI(page, 'admin');

    // Navigate to Clients tab
    await page.getByRole('tab', { name: /clients/i }).click();

    // Find first client and click Edit
    const firstClientRow = page.locator('tr').filter({ hasText: /922222222|911111111/ }).first();
    await firstClientRow.getByRole('button', { name: /edit/i }).click();

    // Modal should open
    await expect(page.getByRole('heading', { name: /edit client|update client/i })).toBeVisible();

    // Change ALL fields
    await page.getByLabel(/^name/i).fill('EDITED Client Name');
    await page.getByLabel(/phone/i).fill('933333333');
    await page.getByLabel(/email/i).fill('edited@test.com');
    await page.getByLabel(/address/i).fill('456 EDITED Street');
    await page.getByLabel(/notes/i).fill('All fields edited by Maestro');

    // Submit
    await page.getByRole('button', { name: /update|save/i }).click();

    // Wait for success
    await waitForSuccess(page, 'Client update');

    // Verify all changes visible
    await expect(page.getByText('EDITED Client Name')).toBeVisible();
    await expect(page.getByText('933333333')).toBeVisible();
  });

  test('Admin deletes Client via UI', async ({ page }) => {
    await loginViaUI(page, 'admin');

    // Create a client to delete
    await page.getByRole('tab', { name: /clients/i }).click();
    await page.getByRole('button', { name: /add client/i }).click();

    const timestamp = Date.now();
    await page.getByLabel(/^name/i).fill(`Delete Me ${timestamp}`);
    await page.getByLabel(/phone/i).fill('944444444');
    await page.getByRole('button', { name: /create client/i }).click();
    await waitForSuccess(page, 'Client creation');

    // Delete it
    const clientRow = page.locator('tr', { hasText: `Delete Me ${timestamp}` });
    await clientRow.getByRole('button', { name: /delete/i }).click();

    // Confirm
    page.once('dialog', dialog => {
      expect(dialog.message()).toMatch(/delete|sure/i);
      dialog.accept();
    });

    // Wait for success
    await waitForSuccess(page, 'Client deletion');

    // Verify removed
    await expect(page.getByText(`Delete Me ${timestamp}`)).not.toBeVisible();
  });
});

test.describe('🎯 Maestro Full CRUD Validation - Cleaning Job Management', () => {

  test('Admin creates Cleaning Job via UI', async ({ page }) => {
    await loginViaUI(page, 'admin');

    // Navigate to Cleaning Jobs tab
    await page.getByRole('tab', { name: /cleaning jobs/i }).click();

    // Click Create Job button
    await page.getByRole('button', { name: /create job|add job/i }).click();

    // Modal should open
    await expect(page.getByRole('heading', { name: /create.*job/i })).toBeVisible();

    // Fill form
    await page.getByLabel(/client/i).first().click(); // Click client dropdown
    await page.keyboard.type('Test Client'); // Search for client
    await page.keyboard.press('Enter'); // Select first match

    await page.getByLabel(/job type/i).selectOption('airbnb');
    await page.getByLabel(/address/i).fill('Rua da Limpeza, 42, Lisboa');

    // Date/Time pickers
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.getByLabel(/date/i).fill(dateStr);
    await page.getByLabel(/time/i).fill('14:00');

    // Assign worker
    await page.getByLabel(/worker/i).selectOption({ index: 1 }); // Select first worker

    // Submit
    await page.getByRole('button', { name: /create job|save/i }).click();

    // Wait for success
    await waitForSuccess(page, 'Job creation');

    // Verify job appears in list
    await expect(page.getByText(/Rua da Limpeza/i)).toBeVisible();
  });

  test('Admin edits Cleaning Job via UI - change all fields', async ({ page }) => {
    await loginViaUI(page, 'admin');

    // Navigate to Cleaning Jobs tab
    await page.getByRole('tab', { name: /cleaning jobs/i }).click();

    // Find first job and click Edit
    const firstJobRow = page.locator('tr').filter({ hasText: /scheduled|in_progress/ }).first();
    await firstJobRow.getByRole('button', { name: /edit/i }).click();

    // Modal should open
    await expect(page.getByRole('heading', { name: /edit.*job/i })).toBeVisible();

    // Change fields
    await page.getByLabel(/job type/i).selectOption('house');
    await page.getByLabel(/address/i).fill('EDITED ADDRESS 999');

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    await page.getByLabel(/date/i).fill(nextWeek.toISOString().split('T')[0]);
    await page.getByLabel(/time/i).fill('16:30');

    // Submit
    await page.getByRole('button', { name: /update|save/i }).click();

    // Wait for success
    await waitForSuccess(page, 'Job update');

    // Verify changes
    await expect(page.getByText('EDITED ADDRESS 999')).toBeVisible();
  });

  test('Admin updates Cleaning Job status via UI', async ({ page }) => {
    await loginViaUI(page, 'admin');

    // Navigate to Cleaning Jobs tab
    await page.getByRole('tab', { name: /cleaning jobs/i }).click();

    // Find a scheduled job
    const jobRow = page.locator('tr').filter({ hasText: /scheduled/i }).first();

    // Click status dropdown or button
    const statusDropdown = jobRow.locator('select').filter({ hasText: /status|scheduled/i });
    await statusDropdown.selectOption('in_progress');

    // Wait for success (status update should auto-save)
    await waitForSuccess(page, 'Job status update');

    // Verify status changed
    await expect(jobRow).toContainText(/in progress|in_progress/i);

    // Change to completed
    await statusDropdown.selectOption('completed');
    await waitForSuccess(page, 'Job completion');
    await expect(jobRow).toContainText(/completed/i);
  });

  test('Admin deletes Cleaning Job via UI', async ({ page }) => {
    await loginViaUI(page, 'admin');

    // Create a job to delete
    await page.getByRole('tab', { name: /cleaning jobs/i }).click();
    await page.getByRole('button', { name: /create job|add job/i }).click();

    await page.getByLabel(/client/i).first().click();
    await page.keyboard.type('Test');
    await page.keyboard.press('Enter');
    await page.getByLabel(/job type/i).selectOption('house');
    await page.getByLabel(/address/i).fill('DELETE ME JOB');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.getByLabel(/date/i).fill(tomorrow.toISOString().split('T')[0]);
    await page.getByLabel(/time/i).fill('10:00');
    await page.getByRole('button', { name: /create job|save/i }).click();
    await waitForSuccess(page, 'Job creation');

    // Delete it
    const jobRow = page.locator('tr', { hasText: 'DELETE ME JOB' });
    await jobRow.getByRole('button', { name: /delete/i }).click();

    // Confirm
    page.once('dialog', dialog => {
      expect(dialog.message()).toMatch(/delete|sure/i);
      dialog.accept();
    });

    // Wait for success
    await waitForSuccess(page, 'Job deletion');

    // Verify removed
    await expect(page.getByText('DELETE ME JOB')).not.toBeVisible();
  });
});

test.describe('🎯 Maestro Full CRUD Validation - Laundry Order Management', () => {

  test('Admin creates Laundry Order via UI', async ({ page }) => {
    await loginViaUI(page, 'admin');

    // Navigate to Laundry Orders tab
    await page.getByRole('tab', { name: /laundry orders/i }).click();

    // Click Create Order button
    await page.getByRole('button', { name: /create order|add order/i }).click();

    // Modal should open
    await expect(page.getByRole('heading', { name: /create.*order/i })).toBeVisible();

    // Fill form
    await page.getByLabel(/client/i).first().click();
    await page.keyboard.type('Test Client');
    await page.keyboard.press('Enter');

    // Select laundry services (checkboxes or multi-select)
    // Assuming services are checkboxes
    await page.getByLabel(/wash.*fold|dry cleaning/i).first().check();
    await page.getByLabel(/wash.*fold|dry cleaning/i).nth(1).check();

    // If bulk_kg type, enter weight
    const weightField = page.getByLabel(/weight|kg/i);
    if (await weightField.isVisible()) {
      await weightField.fill('5.5');
    }

    // Pickup date
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    await page.getByLabel(/pickup date|date/i).fill(nextDay.toISOString().split('T')[0]);

    // Total price should be calculated automatically
    await expect(page.getByText(/total|€/i)).toBeVisible();

    // Submit
    await page.getByRole('button', { name: /create order|save/i }).click();

    // Wait for success
    await waitForSuccess(page, 'Laundry order creation');

    // Verify order appears in list
    await expect(page.locator('table')).toContainText(/received|5\.5/i);
  });

  test('Admin edits Laundry Order via UI', async ({ page }) => {
    await loginViaUI(page, 'admin');

    // Navigate to Laundry Orders tab
    await page.getByRole('tab', { name: /laundry orders/i }).click();

    // Find first order and click Edit
    const firstOrderRow = page.locator('tr').filter({ hasText: /received|in_progress/ }).first();
    await firstOrderRow.getByRole('button', { name: /edit/i }).click();

    // Modal should open
    await expect(page.getByRole('heading', { name: /edit.*order/i })).toBeVisible();

    // Change fields
    const weightField = page.getByLabel(/weight|kg/i);
    if (await weightField.isVisible()) {
      await weightField.fill('8.0');
    }

    // Change pickup date
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 3);
    await page.getByLabel(/pickup date|date/i).fill(newDate.toISOString().split('T')[0]);

    // Submit
    await page.getByRole('button', { name: /update|save/i }).click();

    // Wait for success
    await waitForSuccess(page, 'Laundry order update');

    // Verify changes (total price should update)
    await expect(page.getByText(/8\.0|8 kg/i)).toBeVisible();
  });

  test('Admin updates Laundry Order status via UI', async ({ page }) => {
    await loginViaUI(page, 'admin');

    // Navigate to Laundry Orders tab
    await page.getByRole('tab', { name: /laundry orders/i }).click();

    // Find a received order
    const orderRow = page.locator('tr').filter({ hasText: /received/i }).first();

    // Update status to "in_progress"
    const statusDropdown = orderRow.locator('select').filter({ hasText: /status|received/i });
    await statusDropdown.selectOption('in_progress');
    await waitForSuccess(page, 'Order status update');
    await expect(orderRow).toContainText(/in progress|in_progress/i);

    // Update to "ready" (should trigger client notification)
    await statusDropdown.selectOption('ready');
    await waitForSuccess(page, 'Order ready notification');
    await expect(orderRow).toContainText(/ready/i);

    // Update to "collected"
    await statusDropdown.selectOption('collected');
    await waitForSuccess(page, 'Order collection');
    await expect(orderRow).toContainText(/collected/i);
  });

  test('Admin deletes Laundry Order via UI', async ({ page }) => {
    await loginViaUI(page, 'admin');

    // Create an order to delete
    await page.getByRole('tab', { name: /laundry orders/i }).click();
    await page.getByRole('button', { name: /create order|add order/i }).click();

    await page.getByLabel(/client/i).first().click();
    await page.keyboard.type('Test');
    await page.keyboard.press('Enter');
    await page.getByLabel(/wash.*fold|dry cleaning/i).first().check();

    const weightField = page.getByLabel(/weight|kg/i);
    if (await weightField.isVisible()) {
      await weightField.fill('2.0');
    }

    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    await page.getByLabel(/pickup date|date/i).fill(nextDay.toISOString().split('T')[0]);
    await page.getByRole('button', { name: /create order|save/i }).click();
    await waitForSuccess(page, 'Order creation');

    // Delete it
    const orderRow = page.locator('tr').filter({ hasText: /2\.0|2 kg/ }).first();
    await orderRow.getByRole('button', { name: /delete/i }).click();

    // Confirm
    page.once('dialog', dialog => {
      expect(dialog.message()).toMatch(/delete|sure/i);
      dialog.accept();
    });

    // Wait for success
    await waitForSuccess(page, 'Order deletion');
  });
});

test.describe('🎯 Maestro Full CRUD Validation - Photo Upload Workflows', () => {

  test('Worker uploads photos to assigned job via UI', async ({ page }) => {
    await loginViaUI(page, 'worker');

    // Navigate to My Jobs tab
    await page.getByRole('tab', { name: /my jobs/i }).click();

    // Find first assigned job
    const jobRow = page.locator('tr').filter({ hasText: /scheduled|in_progress/ }).first();

    // Click "View Details" or "Upload Photos"
    await jobRow.getByRole('button', { name: /view details|upload photos/i }).click();

    // Modal should open with photo upload section
    await expect(page.getByRole('heading', { name: /job details|upload photos/i })).toBeVisible();

    // Create test photo files
    const photoPath1 = 'tests/fixtures/test-photo-1.jpg';
    const photoPath2 = 'tests/fixtures/test-photo-2.jpg';

    // Upload photos
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([photoPath1, photoPath2]);

    // Click Upload button
    await page.getByRole('button', { name: /upload|submit photos/i }).click();

    // Wait for success
    await waitForSuccess(page, 'Photo upload');

    // Verify photos appear in photo list
    await expect(page.getByText(/2 photos uploaded|uploaded successfully/i)).toBeVisible();
  });

  test('Worker uploads multiple batches (20+ photos) via UI', async ({ page }) => {
    await loginViaUI(page, 'worker');

    // Navigate to My Jobs
    await page.getByRole('tab', { name: /my jobs/i }).click();

    // Open job details
    const jobRow = page.locator('tr').first();
    await jobRow.getByRole('button', { name: /view details|upload photos/i }).click();

    // Upload Batch 1 (10 photos)
    const batch1Files = Array.from({ length: 10 }, (_, i) =>
      `tests/fixtures/batch1-photo-${i + 1}.jpg`
    );
    await page.locator('input[type="file"]').setInputFiles(batch1Files);
    await page.getByRole('button', { name: /upload/i }).click();
    await waitForSuccess(page, 'Batch 1 upload');

    // Upload Batch 2 (10 more photos)
    const batch2Files = Array.from({ length: 10 }, (_, i) =>
      `tests/fixtures/batch2-photo-${i + 1}.jpg`
    );
    await page.locator('input[type="file"]').setInputFiles(batch2Files);
    await page.getByRole('button', { name: /upload/i }).click();
    await waitForSuccess(page, 'Batch 2 upload');

    // Verify total photo count
    await expect(page.getByText(/20 photos|20 files/i)).toBeVisible();
  });

  test('Client views photos for their job via UI', async ({ page }) => {
    // Login as client (using phone number)
    await page.goto('http://localhost:3000');
    await page.getByRole('tab', { name: 'Client' }).click();
    await page.getByPlaceholder(/phone/i).fill('911111111');
    await page.getByPlaceholder(/password/i).fill('lavandaria2025');
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    console.log('✅ Logged in as client');

    // Navigate to My Jobs
    await page.getByRole('tab', { name: /my jobs|orders/i }).click();

    // Find job with photos
    const jobRow = page.locator('tr').filter({ hasText: /\d+ photos?/i }).first();

    // Click "View Photos"
    await jobRow.getByRole('button', { name: /view photos|details/i }).click();

    // Photo gallery should open
    await expect(page.locator('img[alt*="photo"], img[src*="uploads"]')).toBeVisible();

    // Verify viewing tracked (API should mark photos as viewed)
    // This is passive - just viewing the page should trigger the tracking
  });
});

test.describe('🎯 Maestro Full CRUD Validation - Payment Recording', () => {

  test('Admin records payment for completed job via UI', async ({ page }) => {
    await loginViaUI(page, 'admin');

    // Navigate to Cleaning Jobs
    await page.getByRole('tab', { name: /cleaning jobs/i }).click();

    // Find completed job
    const completedJobRow = page.locator('tr').filter({ hasText: /completed/i }).first();

    // Click "Record Payment" or "Add Payment"
    await completedJobRow.getByRole('button', { name: /record payment|add payment/i }).click();

    // Modal should open
    await expect(page.getByRole('heading', { name: /payment|record/i })).toBeVisible();

    // Fill payment details
    await page.getByLabel(/amount/i).fill('85.50');
    await page.getByLabel(/payment method/i).selectOption('cash');
    await page.getByLabel(/payment date/i).fill(new Date().toISOString().split('T')[0]);
    await page.getByLabel(/notes/i).fill('Paid in full by Maestro test');

    // Submit
    await page.getByRole('button', { name: /save payment|record/i }).click();

    // Wait for success
    await waitForSuccess(page, 'Payment recording');

    // Verify payment appears in job details
    await expect(page.getByText(/€85\.50|paid/i)).toBeVisible();
  });
});

test.describe('🎯 Maestro Full CRUD Validation - Service Management', () => {

  test('Master creates Laundry Service via UI', async ({ page }) => {
    await loginViaUI(page, 'master');

    // Navigate to Services tab (if exists) or Settings
    const servicesTab = page.getByRole('tab', { name: /services|settings/i });
    if (await servicesTab.isVisible()) {
      await servicesTab.click();
    }

    // Click Add Service
    await page.getByRole('button', { name: /add service|create service/i }).click();

    // Modal should open
    await expect(page.getByRole('heading', { name: /create.*service/i })).toBeVisible();

    // Fill form
    const timestamp = Date.now();
    await page.getByLabel(/^name/i).fill(`Test Service ${timestamp}`);
    await page.getByLabel(/service type/i).selectOption('wash_and_fold');
    await page.getByLabel(/base price/i).fill('12.50');
    await page.getByLabel(/unit/i).selectOption('kg');
    await page.getByLabel(/duration|minutes/i).fill('60');
    await page.getByLabel(/description/i).fill('Created by Maestro E2E test');

    // Submit
    await page.getByRole('button', { name: /create service|save/i }).click();

    // Wait for success
    await waitForSuccess(page, 'Service creation');

    // Verify service appears
    await expect(page.getByText(`Test Service ${timestamp}`)).toBeVisible();
  });

  test('Master edits Laundry Service pricing via UI', async ({ page }) => {
    await loginViaUI(page, 'master');

    // Navigate to Services
    const servicesTab = page.getByRole('tab', { name: /services|settings/i });
    if (await servicesTab.isVisible()) {
      await servicesTab.click();
    }

    // Find first service and click Edit
    const firstServiceRow = page.locator('tr').first();
    await firstServiceRow.getByRole('button', { name: /edit/i }).click();

    // Modal should open
    await expect(page.getByRole('heading', { name: /edit.*service/i })).toBeVisible();

    // Change price
    await page.getByLabel(/base price/i).fill('15.00');

    // Submit
    await page.getByRole('button', { name: /update|save/i }).click();

    // Wait for success
    await waitForSuccess(page, 'Service price update');

    // Verify new price
    await expect(page.getByText(/€15\.00|15,00/i)).toBeVisible();
  });

  test('Master deactivates Laundry Service via UI', async ({ page }) => {
    await loginViaUI(page, 'master');

    // Navigate to Services
    const servicesTab = page.getByRole('tab', { name: /services|settings/i });
    if (await servicesTab.isVisible()) {
      await servicesTab.click();
    }

    // Find active service
    const serviceRow = page.locator('tr').filter({ hasText: /active|✓/i }).first();

    // Click "Deactivate" or toggle switch
    const deactivateButton = serviceRow.getByRole('button', { name: /deactivate|disable/i });
    if (await deactivateButton.isVisible()) {
      await deactivateButton.click();
    } else {
      // Try toggle switch
      await serviceRow.locator('input[type="checkbox"]').uncheck();
    }

    // Wait for success
    await waitForSuccess(page, 'Service deactivation');

    // Verify service marked as inactive
    await expect(serviceRow).toContainText(/inactive|disabled/i);
  });
});

test.describe('🎯 Maestro Full CRUD Validation - Complete Workflows', () => {

  test('Complete workflow: Create client → Create job → Assign worker → Upload photos → Mark complete → Record payment', async ({ page }) => {
    // Step 1: Login as Admin
    await loginViaUI(page, 'admin');

    // Step 2: Create client
    await page.getByRole('tab', { name: /clients/i }).click();
    await page.getByRole('button', { name: /add client/i }).click();

    const clientName = `Workflow Client ${Date.now()}`;
    await page.getByLabel(/^name/i).fill(clientName);
    await page.getByLabel(/phone/i).fill('955555555');
    await page.getByRole('button', { name: /create client/i }).click();
    await waitForSuccess(page, 'Client creation');

    console.log('✅ Step 1: Client created');

    // Step 3: Create cleaning job for this client
    await page.getByRole('tab', { name: /cleaning jobs/i }).click();
    await page.getByRole('button', { name: /create job|add job/i }).click();

    await page.getByLabel(/client/i).first().click();
    await page.keyboard.type(clientName);
    await page.keyboard.press('Enter');
    await page.getByLabel(/job type/i).selectOption('airbnb');
    await page.getByLabel(/address/i).fill('Complete Workflow Test Address');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.getByLabel(/date/i).fill(tomorrow.toISOString().split('T')[0]);
    await page.getByLabel(/time/i).fill('10:00');

    // Assign first available worker
    await page.getByLabel(/worker/i).selectOption({ index: 1 });

    await page.getByRole('button', { name: /create job|save/i }).click();
    await waitForSuccess(page, 'Job creation');

    console.log('✅ Step 2: Job created and assigned to worker');

    // Step 4: Logout and login as worker to upload photos
    await page.getByRole('button', { name: /logout/i }).click();
    await loginViaUI(page, 'worker');

    await page.getByRole('tab', { name: /my jobs/i }).click();
    const workflowJobRow = page.locator('tr', { hasText: 'Complete Workflow Test Address' });
    await workflowJobRow.getByRole('button', { name: /view details|upload photos/i }).click();

    // Upload photos
    const photoFiles = ['tests/fixtures/workflow-photo-1.jpg', 'tests/fixtures/workflow-photo-2.jpg'];
    await page.locator('input[type="file"]').setInputFiles(photoFiles);
    await page.getByRole('button', { name: /upload/i }).click();
    await waitForSuccess(page, 'Photo upload');

    console.log('✅ Step 3: Worker uploaded photos');

    // Step 5: Logout and login as admin to mark complete
    await page.getByRole('button', { name: /logout/i }).click();
    await loginViaUI(page, 'admin');

    await page.getByRole('tab', { name: /cleaning jobs/i }).click();
    const jobRow = page.locator('tr', { hasText: 'Complete Workflow Test Address' });

    // Mark as completed
    await jobRow.locator('select').filter({ hasText: /status/i }).selectOption('completed');
    await waitForSuccess(page, 'Job completion');

    console.log('✅ Step 4: Job marked as completed');

    // Step 6: Record payment
    await jobRow.getByRole('button', { name: /record payment|add payment/i }).click();

    await page.getByLabel(/amount/i).fill('150.00');
    await page.getByLabel(/payment method/i).selectOption('card');
    await page.getByLabel(/payment date/i).fill(new Date().toISOString().split('T')[0]);
    await page.getByRole('button', { name: /save payment|record/i }).click();
    await waitForSuccess(page, 'Payment recording');

    console.log('✅ Step 5: Payment recorded');
    console.log('✅ COMPLETE WORKFLOW PASSED: Client → Job → Worker Upload → Complete → Payment');
  });
});

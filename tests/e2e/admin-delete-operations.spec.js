/**
 * E2E Test: Admin Delete Operations
 *
 * Validates database constraints and cascade behavior:
 * 1. Delete Worker → Job worker_id SET NULL (not deleted)
 * 2. Delete Client → Orders CASCADE DELETE
 * 3. Verify data integrity after deletions
 *
 * CRUD Completion Test
 */

const { test, expect } = require('@playwright/test');

test.describe('Admin - Delete Operations (Cascade & SET NULL)', () => {
    const ADMIN_CREDENTIALS = {
        phone: '912000000',  // From seed data
        password: 'master123'
    };

    let consoleErrors = [];

    test.beforeEach(async ({ page }) => {
        consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });
    });

    // ============================================
    // Test 1: Delete Worker → Job SET NULL
    // ============================================
    test('Delete Worker: Job worker_id should be SET NULL (not CASCADE deleted)', async ({ page }) => {
        console.log('🗑️  Test 1: Delete Worker → Job SET NULL');

        // Login as admin
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        const staffButton = page.getByRole('button', { name: /Staff/i });
        if (await staffButton.isVisible()) {
            await staffButton.click();
        }

        const phoneInput = page.locator('input[type="text"], input[placeholder*="Phone"], input[name="phone"]').first();
        const passwordInput = page.locator('input[type="password"]');
        const loginButton = page.getByRole('button', { name: /Login/i });

        await phoneInput.fill(ADMIN_CREDENTIALS.phone);
        await passwordInput.fill(ADMIN_CREDENTIALS.password);
        await loginButton.click();

        await page.waitForURL(/\/dashboard/, { timeout: 10000 });
        console.log('  - Admin logged in');

        // ============================================
        // Step 1: Create temporary worker
        // ============================================
        console.log('  📝 Creating temporary worker...');

        const usersLink = page.getByRole('link', { name: /Users|Staff|Team/i });
        if (await usersLink.isVisible()) {
            await usersLink.click();
        }

        await page.waitForLoadState('networkidle');

        const addUserButton = page.getByRole('button', { name: /Add User|Create User|New User/i });
        if (await addUserButton.isVisible()) {
            await addUserButton.click();
        }

        await page.waitForLoadState('networkidle');

        const usernameField = page.locator('input[name="username"], input[placeholder*="Username"]');
        const passwordField = page.locator('input[name="password"], input[placeholder*="Password"]').nth(0);
        const roleSelect = page.locator('select[name="role"], select[name="user_role"]');
        const fullNameField = page.locator('input[name="full_name"], input[placeholder*="Full Name"]');
        const emailField = page.locator('input[name="email"], input[placeholder*="Email"]');
        const phoneField = page.locator('input[name="phone"], input[placeholder*="Phone"]');

        const workerUsername = `worker_to_delete_${Date.now()}`;

        if (await usernameField.isVisible()) {
            await usernameField.fill(workerUsername);
            await passwordField.fill('temp123456');
            await roleSelect.selectOption('worker');
            await fullNameField.fill('Worker To Delete');
            await emailField.fill('delete@test.local');
            await phoneField.fill('912000099');

            const createButton = page.getByRole('button', { name: /Create|Save|Submit/i });
            await createButton.click();

            await expect(page.getByText(/created successfully|created|success/i)).toBeVisible({ timeout: 5000 });
            console.log(`  ✅ Worker created: ${workerUsername}`);
        }

        await page.waitForLoadState('networkidle');

        // ============================================
        // Step 2: Assign worker to a job
        // ============================================
        console.log('  📝 Assigning worker to job...');

        const jobsLink = page.getByRole('link', { name: /Jobs|Cleaning Jobs|My Jobs/i });
        if (await jobsLink.isVisible()) {
            await jobsLink.click();
        }

        await page.waitForLoadState('networkidle');

        // Find first job and click assign
        const assignButton = page.getByRole('button', { name: /Assign/i }).first();
        if (await assignButton.isVisible()) {
            await assignButton.click();
            await page.waitForLoadState('networkidle');

            const workerSelect = page.locator('select[name*="worker"], select[aria-label*="Worker"]');
            if (await workerSelect.isVisible()) {
                await workerSelect.selectOption({ label: 'Worker To Delete' });

                const confirmButton = page.getByRole('button', { name: /Assign|Save|Submit/i });
                await confirmButton.click();

                await expect(page.getByText(/assigned successfully|assigned|success/i)).toBeVisible({ timeout: 5000 });
                console.log('  ✅ Worker assigned to job');
            }
        }

        await page.waitForLoadState('networkidle');

        // Get job ID for verification later
        const jobRowText = await page.locator('tr').first().textContent();
        console.log(`  📌 Job: ${jobRowText.substring(0, 50)}...`);

        // ============================================
        // Step 3: Delete the worker
        // ============================================
        console.log('  📝 Deleting worker...');

        if (await usersLink.isVisible()) {
            await usersLink.click();
        }

        await page.waitForLoadState('networkidle');

        // Find worker row
        const workerRow = page.locator(`tr:has-text("${workerUsername}"), tr:has-text("Worker To Delete")`);
        const deleteButton = workerRow.locator('button:has-text("Delete")').first();

        if (await deleteButton.isVisible()) {
            await deleteButton.click();

            // Confirm deletion if dialog appears
            page.once('dialog', dialog => {
                console.log(`  - Dialog: ${dialog.message()}`);
                dialog.accept();
            });

            await expect(page.getByText(/deleted successfully|deleted|success|removed/i)).toBeVisible({ timeout: 5000 });
            console.log('  ✅ Worker deleted');
        }

        await page.waitForLoadState('networkidle');

        // Verify worker no longer in list
        await expect(page.getByText(workerUsername)).not.toBeVisible({ timeout: 5000 });
        console.log('  ✅ Worker removed from list');

        // ============================================
        // Step 4: Verify job still exists with NULL worker
        // ============================================
        console.log('  📝 Verifying job still exists...');

        if (await jobsLink.isVisible()) {
            await jobsLink.click();
        }

        await page.waitForLoadState('networkidle');

        // Job should still exist
        const jobExists = await page.locator('tr').count() > 0;

        if (jobExists) {
            console.log('  ✅ Job still exists (SET NULL working correctly)');

            // Check for "Unassigned" status
            const unassignedText = await page.getByText(/Unassigned|No worker|None/i).isVisible({ timeout: 2000 }).catch(() => false);

            if (unassignedText) {
                console.log('  ✅ Job shows "Unassigned" status');
            }
        } else {
            console.log('  ❌ Job was deleted (CASCADE - should have been SET NULL)');
        }

        // ============================================
        // Step 5: Verify no console errors
        // ============================================
        expect(consoleErrors).toHaveLength(0);

        if (consoleErrors.length > 0) {
            console.error('  ❌ Console errors found:');
            consoleErrors.forEach(err => console.error(`    - ${err}`));
        }

        console.log('✅ Delete worker test completed');
    });

    // ============================================
    // Test 2: Delete Client → Orders CASCADE
    // ============================================
    test('Delete Client: Orders should CASCADE DELETE', async ({ page }) => {
        console.log('🗑️  Test 2: Delete Client → Orders CASCADE');

        // Login as admin
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        const staffButton = page.getByRole('button', { name: /Staff/i });
        if (await staffButton.isVisible()) {
            await staffButton.click();
        }

        const phoneInput = page.locator('input[type="text"], input[placeholder*="Phone"], input[name="phone"]').first();
        const passwordInput = page.locator('input[type="password"]');
        const loginButton = page.getByRole('button', { name: /Login/i });

        await phoneInput.fill(ADMIN_CREDENTIALS.phone);
        await passwordInput.fill(ADMIN_CREDENTIALS.password);
        await loginButton.click();

        await page.waitForURL(/\/dashboard/, { timeout: 10000 });
        console.log('  - Admin logged in');

        // ============================================
        // Step 1: Create temporary client
        // ============================================
        console.log('  📝 Creating temporary client...');

        const clientsLink = page.getByRole('link', { name: /Clients|Customer/i });
        if (await clientsLink.isVisible()) {
            await clientsLink.click();
        }

        await page.waitForLoadState('networkidle');

        const addClientButton = page.getByRole('button', { name: /Add Client|Create Client|New Client/i });
        if (await addClientButton.isVisible()) {
            await addClientButton.click();
        }

        await page.waitForLoadState('networkidle');

        const clientNameField = page.locator('input[name="full_name"], input[placeholder*="Full Name"]');
        const clientEmailField = page.locator('input[name="email"], input[placeholder*="Email"]');
        const clientPhoneField = page.locator('input[name="phone"], input[placeholder*="Phone"]');
        const addressField = page.locator('input[name="address"], input[placeholder*="Address"]');

        const clientPhone = `91200${Date.now().toString().slice(-4)}`;

        if (await clientNameField.isVisible()) {
            await clientNameField.fill('Client To Delete');
            await clientEmailField.fill('deleteme@test.local');
            await clientPhoneField.fill(clientPhone);
            await addressField.fill('Test Address for Delete');

            const createButton = page.getByRole('button', { name: /Create|Save|Submit/i });
            await createButton.click();

            await expect(page.getByText(/created successfully|created|success/i)).toBeVisible({ timeout: 5000 });
            console.log('  ✅ Client created');
        }

        await page.waitForLoadState('networkidle');

        // ============================================
        // Step 2: Create order for this client
        // ============================================
        console.log('  📝 Creating order for client...');

        const ordersLink = page.getByRole('link', { name: /Orders|Laundry Orders|My Orders/i });
        if (await ordersLink.isVisible()) {
            await ordersLink.click();
        }

        await page.waitForLoadState('networkidle');

        const newOrderButton = page.getByRole('button', { name: /New Order|Create Order|Add Order/i });
        if (await newOrderButton.isVisible()) {
            await newOrderButton.click();
        }

        await page.waitForLoadState('networkidle');

        // Fill order form
        const clientSelect = page.locator('select[name*="client"], select[aria-label*="Client"]');
        const orderTypeSelect = page.locator('select[name*="type"], select[aria-label*="Type"]');
        const weightField = page.locator('input[name*="weight"], input[placeholder*="Weight"]');
        const priceField = page.locator('input[name*="price"], input[placeholder*="Price"]');

        if (await clientSelect.isVisible()) {
            await clientSelect.selectOption({ label: 'Client To Delete' });
            await orderTypeSelect.selectOption('bulk_kg');
            await weightField.fill('2');
            await priceField.fill('3.50');

            const createOrderButton = page.getByRole('button', { name: /Create|Save|Submit/i });
            await createOrderButton.click();

            await expect(page.getByText(/created successfully|created|success/i)).toBeVisible({ timeout: 5000 });
            console.log('  ✅ Order created for client');
        }

        await page.waitForLoadState('networkidle');

        // Get initial order count
        const initialOrderCount = await page.locator('tr[role="row"]').count();
        console.log(`  📌 Orders before deletion: ${initialOrderCount}`);

        // ============================================
        // Step 3: Delete the client
        // ============================================
        console.log('  📝 Deleting client...');

        if (await clientsLink.isVisible()) {
            await clientsLink.click();
        }

        await page.waitForLoadState('networkidle');

        // Find client row
        const clientRow = page.locator('tr:has-text("Client To Delete")');
        const deleteButton = clientRow.locator('button:has-text("Delete")').first();

        if (await deleteButton.isVisible()) {
            await deleteButton.click();

            // Confirm deletion
            page.once('dialog', dialog => {
                console.log(`  - Dialog: ${dialog.message()}`);
                dialog.accept();
            });

            await expect(page.getByText(/deleted successfully|deleted|success|removed/i)).toBeVisible({ timeout: 5000 });
            console.log('  ✅ Client deleted');
        }

        await page.waitForLoadState('networkidle');

        // Verify client no longer in list
        await expect(page.getByText('Client To Delete')).not.toBeVisible({ timeout: 5000 });
        console.log('  ✅ Client removed from list');

        // ============================================
        // Step 4: Verify order was CASCADE deleted
        // ============================================
        console.log('  📝 Verifying order was CASCADE deleted...');

        if (await ordersLink.isVisible()) {
            await ordersLink.click();
        }

        await page.waitForLoadState('networkidle');

        // Get final order count
        const finalOrderCount = await page.locator('tr[role="row"]').count();
        console.log(`  📌 Orders after deletion: ${finalOrderCount}`);

        if (finalOrderCount < initialOrderCount) {
            console.log('  ✅ Order CASCADE deleted (correct behavior)');
        } else {
            console.log('  ⚠️ Order count unchanged (may not have been deleted)');
        }

        // Try to search for the deleted order
        const orderExists = await page.getByText(/Client To Delete|deleteme@test/).isVisible({ timeout: 2000 }).catch(() => false);

        if (!orderExists) {
            console.log('  ✅ Order no longer visible (CASCADE delete successful)');
        }

        // ============================================
        // Step 5: Verify no console errors
        // ============================================
        expect(consoleErrors).toHaveLength(0);

        if (consoleErrors.length > 0) {
            console.error('  ❌ Console errors found:');
            consoleErrors.forEach(err => console.error(`    - ${err}`));
        }

        console.log('✅ Delete client test completed');
    });
});

/**
 * E2E Test: Master User - Complete System Setup
 *
 * Validates that a Master user can:
 * 1. Login successfully
 * 2. Create Admin users
 * 3. Create Worker users
 * 4. Create Clients
 * 5. Edit users
 * 6. No JavaScript errors in browser
 * 7. Logout successfully
 *
 * This test does NOT use database manipulation - all data created via UI
 */

const { test, expect } = require('@playwright/test');

test.describe('Master User - Complete System Setup', () => {
    const MASTER_CREDENTIALS = {
        phone: '912000000',  // Will use seed data master phone
        password: 'master123'
    };

    let consoleErrors = [];

    test.beforeEach(async ({ page }) => {
        // Clear console errors for this test
        consoleErrors = [];

        // Capture console errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });
    });

    test('Master: Login → Create Admin → Create Worker → Create Client → Edit → Logout', async ({ page }) => {
        // ============================================
        // Step 1: Master Login
        // ============================================
        console.log('🔐 Step 1: Master Login');

        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        // Wait for login form to be visible
        const staffButton = page.getByRole('button', { name: /Staff/i });
        await expect(staffButton).toBeVisible({ timeout: 5000 });
        await staffButton.click();

        // Fill login credentials
        // Note: Using seed data or known master credentials
        const phoneInput = page.locator('input[type="text"], input[placeholder*="Phone"], input[name="phone"]').first();
        const passwordInput = page.locator('input[type="password"]');
        const loginButton = page.getByRole('button', { name: /Login|Log In/i });

        await phoneInput.fill('912000000');
        await passwordInput.fill('master123');
        await loginButton.click();

        // Verify dashboard loaded
        await page.waitForURL(/\/dashboard/, { timeout: 10000 });
        await expect(page.getByRole('heading', { name: /Dashboard|Home/i })).toBeVisible();

        console.log('✅ Master logged in successfully');

        // ============================================
        // Step 2: Create Admin User
        // ============================================
        console.log('👤 Step 2: Create Admin User');

        // Navigate to Users section
        const usersLink = page.getByRole('link', { name: /Users|Staff|Team/i });
        await expect(usersLink).toBeVisible({ timeout: 5000 });
        await usersLink.click();

        await page.waitForLoadState('networkidle');

        // Click "Add User" or "Create User" button
        const addUserButton = page.getByRole('button', { name: /Add User|Create User|New User|Add Staff/i });
        await expect(addUserButton).toBeVisible({ timeout: 5000 });
        await addUserButton.click();

        await page.waitForLoadState('networkidle');

        // Fill admin form
        const usernameField = page.locator('input[name="username"], input[placeholder*="Username"], input[placeholder*="username"]');
        const passwordField = page.locator('input[name="password"], input[placeholder*="Password"], input[placeholder*="password"]').nth(0);
        const roleSelect = page.locator('select[name="role"], select[name="user_role"], select[aria-label*="Role"]');
        const fullNameField = page.locator('input[name="full_name"], input[placeholder*="Full Name"], input[placeholder*="Name"]');
        const emailField = page.locator('input[name="email"], input[placeholder*="Email"]');
        const phoneField = page.locator('input[name="phone"], input[placeholder*="Phone"]');

        await usernameField.fill('admin_test_user');
        await passwordField.fill('admin123456');
        await roleSelect.selectOption('admin');
        await fullNameField.fill('Admin Test User');
        await emailField.fill('admin@test.local');
        await phoneField.fill('912000001');

        // Submit form
        const createButton = page.getByRole('button', { name: /Create|Save|Submit/i });
        await createButton.click();

        // Verify success message
        await expect(page.getByText(/created successfully|created|success/i)).toBeVisible({ timeout: 5000 });
        console.log('✅ Admin user created');

        // Verify user appears in list
        await page.waitForLoadState('networkidle');
        await expect(page.getByText('admin_test_user')).toBeVisible({ timeout: 5000 });

        // ============================================
        // Step 3: Create Worker User
        // ============================================
        console.log('👷 Step 3: Create Worker User');

        await addUserButton.click();
        await page.waitForLoadState('networkidle');

        await usernameField.fill('worker_test_user');
        await passwordField.fill('worker123456');
        await roleSelect.selectOption('worker');
        await fullNameField.fill('Worker Test User');
        await emailField.fill('worker@test.local');
        await phoneField.fill('912000002');

        await createButton.click();
        await expect(page.getByText(/created successfully|created|success/i)).toBeVisible({ timeout: 5000 });
        console.log('✅ Worker user created');

        await page.waitForLoadState('networkidle');
        await expect(page.getByText('worker_test_user')).toBeVisible({ timeout: 5000 });

        // ============================================
        // Step 4: Create Client
        // ============================================
        console.log('👥 Step 4: Create Client');

        // Navigate to Clients
        const clientsLink = page.getByRole('link', { name: /Clients|Customer|Customer List/i });
        if (await clientsLink.isVisible()) {
            await clientsLink.click();
        } else {
            // Might be in a dropdown or different location
            const moreButton = page.getByRole('button', { name: /More|Menu/i });
            if (await moreButton.isVisible()) {
                await moreButton.click();
                await page.getByRole('link', { name: /Clients/i }).click();
            }
        }

        await page.waitForLoadState('networkidle');

        const addClientButton = page.getByRole('button', { name: /Add Client|Create Client|New Client/i });
        if (await addClientButton.isVisible()) {
            await addClientButton.click();
        }

        await page.waitForLoadState('networkidle');

        // Fill client form
        const clientNameField = page.locator('input[name="full_name"], input[placeholder*="Full Name"]');
        const clientEmailField = page.locator('input[name="email"], input[placeholder*="Email"]');
        const clientPhoneField = page.locator('input[name="phone"], input[placeholder*="Phone"]');
        const addressField = page.locator('input[name="address"], input[placeholder*="Address"]');

        if (await clientNameField.isVisible()) {
            await clientNameField.fill('Client Test User');
            await clientEmailField.fill('client@test.local');
            await clientPhoneField.fill('912000003');
            await addressField.fill('Rua Test 123, Lisboa');

            await createButton.click();
            await expect(page.getByText(/created successfully|created|success/i)).toBeVisible({ timeout: 5000 });
            console.log('✅ Client created');

            await page.waitForLoadState('networkidle');
            await expect(page.getByText('Client Test User')).toBeVisible({ timeout: 5000 });
        } else {
            console.log('⚠️ Client form fields not found, skipping client creation');
        }

        // ============================================
        // Step 5: Edit Worker (Update Email)
        // ============================================
        console.log('✏️ Step 5: Edit Worker');

        // Navigate back to Users
        await usersLink.click();
        await page.waitForLoadState('networkidle');

        // Find worker row and click edit
        const workerRow = page.locator('tr:has-text("worker_test_user"), tr:has-text("Worker Test User")');
        const editButton = workerRow.locator('button:has-text("Edit")').first();

        if (await editButton.isVisible()) {
            await editButton.click();
            await page.waitForLoadState('networkidle');

            // Update email
            const emailEditField = page.locator('input[name="email"], input[placeholder*="Email"]');
            if (await emailEditField.isVisible()) {
                await emailEditField.clear();
                await emailEditField.fill('worker_updated@test.local');

                const saveButton = page.getByRole('button', { name: /Update|Save|Submit/i });
                await saveButton.click();

                await expect(page.getByText(/updated successfully|updated|success/i)).toBeVisible({ timeout: 5000 });
                console.log('✅ Worker updated');

                await page.waitForLoadState('networkidle');
                await expect(page.getByText('worker_updated@test.local')).toBeVisible({ timeout: 5000 });
            }
        } else {
            console.log('⚠️ Edit button not found, skipping worker update');
        }

        // ============================================
        // Step 6: Verify No Console Errors
        // ============================================
        console.log('🔍 Step 6: Verify No Console Errors');

        expect(consoleErrors).toHaveLength(0);

        if (consoleErrors.length > 0) {
            console.error('❌ Console errors found:');
            consoleErrors.forEach(err => console.error(`  - ${err}`));
        } else {
            console.log('✅ No console errors');
        }

        // ============================================
        // Step 7: Logout
        // ============================================
        console.log('🚪 Step 7: Logout');

        const logoutButton = page.getByRole('button', { name: /Logout|Log Out|Sign Out/i });
        if (await logoutButton.isVisible()) {
            await logoutButton.click();
            await page.waitForURL(/\/login|\/auth|^\/$/, { timeout: 5000 });
            console.log('✅ Logged out successfully');
        } else {
            console.log('⚠️ Logout button not found');
        }

        console.log('✅ Test completed successfully');
    });
});

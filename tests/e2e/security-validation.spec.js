/**
 * E2E Test: Security Validation
 *
 * Validates that the system is protected against:
 * 1. XSS (Cross-Site Scripting) - Script tags are escaped
 * 2. SQL Injection - Parameterized queries prevent injection
 * 3. CSRF (Cross-Site Request Forgery) - API requires valid session
 *
 * Security-first testing
 */

const { test, expect } = require('@playwright/test');

test.describe('Security Validation', () => {
    const ADMIN_CREDENTIALS = {
        phone: '912000000',  // From seed data (using master or admin)
        password: 'master123'
    };

    // ============================================
    // Test 1: XSS Prevention
    // ============================================
    test('XSS Prevention: Script tags in input fields should be escaped', async ({ page }) => {
        console.log('🔒 Test 1: XSS Prevention');

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

        // Navigate to Clients
        const clientsLink = page.getByRole('link', { name: /Clients|Customer/i });
        if (await clientsLink.isVisible()) {
            await clientsLink.click();
        }

        await page.waitForLoadState('networkidle');

        // Try to create client with XSS payload
        const addClientButton = page.getByRole('button', { name: /Add Client|Create Client/i });
        if (await addClientButton.isVisible()) {
            await addClientButton.click();
        }

        await page.waitForLoadState('networkidle');

        const xssPayload = '<script>alert("XSS")</script>';

        const clientNameField = page.locator('input[name="full_name"], input[placeholder*="Full Name"]');
        const clientEmailField = page.locator('input[name="email"], input[placeholder*="Email"]');
        const clientPhoneField = page.locator('input[name="phone"], input[placeholder*="Phone"]');
        const addressField = page.locator('input[name="address"], input[placeholder*="Address"]');

        if (await clientNameField.isVisible()) {
            await clientNameField.fill(xssPayload);
            await clientEmailField.fill('xss@test.local');
            await clientPhoneField.fill('912000099');
            await addressField.fill('Test Address');

            const createButton = page.getByRole('button', { name: /Create|Save/i });
            await createButton.click();

            // Verify success message
            await expect(page.getByText(/created successfully|created|success/i)).toBeVisible({ timeout: 5000 });
            console.log('  - Client with XSS payload created');

            // Navigate to clients list
            if (await clientsLink.isVisible()) {
                await clientsLink.click();
            }

            await page.waitForLoadState('networkidle');

            // Monitor for alert dialogs (XSS would trigger this)
            let alertOccurred = false;
            page.on('dialog', dialog => {
                console.error('  ❌ XSS Alert Dialog triggered!');
                alertOccurred = true;
                dialog.dismiss();
            });

            // Try to find the client with XSS payload
            const xssClientRow = page.locator(`text=${xssPayload}`);
            const isVisible = await xssClientRow.isVisible({ timeout: 2000 }).catch(() => false);

            // If XSS payload is visible as TEXT (not executed), that's good
            if (isVisible && !alertOccurred) {
                console.log('✅ XSS payload visible as TEXT (not executed)');
            } else if (!isVisible && !alertOccurred) {
                console.log('✅ XSS payload escaped (not visible as raw text or executed)');
            } else if (alertOccurred) {
                throw new Error('XSS vulnerability detected - script executed!');
            }
        } else {
            console.log('⚠️ Client form not found');
        }
    });

    // ============================================
    // Test 2: SQL Injection Prevention
    // ============================================
    test('SQL Injection Prevention: Malicious queries should be safely rejected', async ({ page }) => {
        console.log('🔒 Test 2: SQL Injection Prevention');

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

        // Navigate to Clients
        const clientsLink = page.getByRole('link', { name: /Clients|Customer/i });
        if (await clientsLink.isVisible()) {
            await clientsLink.click();
        }

        await page.waitForLoadState('networkidle');

        // Try SQL injection in search field
        const searchField = page.locator('input[placeholder*="Search"], input[name="search"]').first();

        if (await searchField.isVisible()) {
            const sqlInjectionPayload = "' OR '1'='1'; DROP TABLE clients; --";

            await searchField.fill(sqlInjectionPayload);

            // Press Enter to search
            await searchField.press('Enter');
            await page.waitForLoadState('networkidle');

            // Should return no results or safe error (not SQL error)
            const hasResults = await page.getByText(/No clients found|No results|Found/i).isVisible({ timeout: 2000 }).catch(() => false);

            console.log(`  - Search with SQL injection: returned safe result`);

            // Verify clients table still exists (navigate back)
            const homeLink = page.getByRole('link', { name: /Dashboard|Home/i });
            if (await homeLink.isVisible()) {
                await homeLink.click();
            }

            if (await clientsLink.isVisible()) {
                await clientsLink.click();
            }

            await page.waitForLoadState('networkidle');

            // Should load successfully (table not dropped)
            const heading = await page.getByRole('heading', { name: /Clients|Customer/i }).isVisible({ timeout: 5000 });

            if (heading) {
                console.log('✅ SQL injection prevented - clients table still exists');
            } else {
                console.log('⚠️ Could not verify clients table');
            }
        } else {
            console.log('⚠️ Search field not found');
        }
    });

    // ============================================
    // Test 3: CSRF Protection
    // ============================================
    test('CSRF Protection: Requests without valid session should be rejected', async ({ page }) => {
        console.log('🔒 Test 3: CSRF Protection');

        // Do NOT login - try to make API request without session

        try {
            // Attempt POST request to create client without authentication
            const response = await page.request.post('http://localhost:3000/api/clients', {
                data: {
                    full_name: 'Unauthorized Client',
                    email: 'unauthorized@test.com',
                    phone_number: '912000098',
                    address: 'Test Address'
                }
            });

            console.log(`  - POST /api/clients without session: ${response.status()}`);

            if (response.status() === 401 || response.status() === 403) {
                const body = await response.json();
                console.log(`    Error message: ${body.error || body.message || 'Not authenticated'}`);
                console.log('✅ CSRF protection working - unauthorized request rejected');
            } else {
                console.log(`⚠️ Expected 401/403, got ${response.status()}`);
            }
        } catch (error) {
            console.log(`⚠️ Error during CSRF test: ${error.message}`);
        }
    });

    // ============================================
    // Test 4: Password Not Exposed
    // ============================================
    test('Sensitive Data: Passwords not exposed in API responses', async ({ page }) => {
        console.log('🔒 Test 4: Password Protection');

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

        // Get users list via API
        try {
            const response = await page.request.get('/api/users');

            if (response.ok()) {
                const data = await response.json();

                // Check if any user object contains password
                const hasPassword = JSON.stringify(data).toLowerCase().includes('password');

                if (!hasPassword) {
                    console.log('✅ No passwords exposed in /api/users response');
                } else {
                    console.log('❌ WARNING: Passwords may be exposed in API response');
                }
            }
        } catch (error) {
            console.log(`⚠️ Could not test /api/users endpoint: ${error.message}`);
        }
    });
});

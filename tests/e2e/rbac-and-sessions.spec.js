/**
 * E2E Tests: RBAC & Session Behavior
 *
 * Scenarios covered:
 * 1. Worker cannot access finance-restricted routes
 * 2. Client cannot access staff routes
 * 3. Sessions persist across page reloads
 * 4. Logout properly clears access
 * 5. Health and readiness endpoints work as documented
 */

const { test, expect } = require('@playwright/test');

// Test credentials
const CREDENTIALS = {
    master: { username: 'master', password: 'master123' },
    admin: { username: 'admin', password: 'admin123' },
    worker: { username: 'worker1', password: 'worker123' },
    client: { phone: '911111111', password: 'lavandaria2025' }
};

// Finance-restricted routes (master/admin only)
const FINANCE_ROUTES = [
    '/api/payments',
    '/api/dashboard'
];

// Staff-only routes
const STAFF_ROUTES = [
    '/api/cleaning-jobs',
    '/api/users',
    '/api/clients'
];

test.describe('RBAC - Finance Access Restrictions', () => {
    test('worker cannot access finance routes', async ({ page, request }) => {
        // Login as worker
        await page.goto('/');
        // Login form is visible by default - select Staff tab
        await page.click('button:has-text("Staff")');
        await page.fill('input[name="username"]', CREDENTIALS.worker.username);
        await page.fill('input[name="password"]', CREDENTIALS.worker.password);
        await page.click('button[type="submit"]');
        // All users navigate to /dashboard after login
        await page.waitForURL('/dashboard', { timeout: 10000 });

        // Test each finance route
        for (const route of FINANCE_ROUTES) {
            const response = await request.get(route);

            expect(response.status()).toBe(403);
            const result = await response.json();

            expect(result).toHaveProperty('error');
            expect(result.error.toLowerCase()).toContain('finance');
            expect(result._meta).toBeDefined();
            expect(result._meta.correlationId).toBeDefined();

            console.log(`✅ Worker blocked from ${route} with correlation ID: ${result._meta.correlationId}`);
        }
    });

    test('admin can access finance routes', async ({ page, request }) => {
        // Login as admin
        await page.goto('/');
        // Login form is visible by default - select Staff tab
        await page.click('button:has-text("Staff")');
        await page.fill('input[name="username"]', CREDENTIALS.admin.username);
        await page.fill('input[name="password"]', CREDENTIALS.admin.password);
        await page.click('button[type="submit"]');
        // All users navigate to /dashboard after login
        await page.waitForURL('/dashboard', { timeout: 10000 });

        // Test dashboard route (admin should have access)
        const response = await request.get('/api/dashboard');

        // Should succeed (200) or return data (not 403)
        expect(response.status()).not.toBe(403);
    });

    test('master can access all routes', async ({ page, request }) => {
        // Login as master
        await page.goto('/');
        // Login form is visible by default - select Staff tab
        await page.click('button:has-text("Staff")');
        await page.fill('input[name="username"]', CREDENTIALS.master.username);
        await page.fill('input[name="password"]', CREDENTIALS.master.password);
        await page.click('button[type="submit"]');
        // All users navigate to /dashboard after login
        await page.waitForURL('/dashboard', { timeout: 10000 });

        // Master should have access to all routes
        for (const route of FINANCE_ROUTES) {
            const response = await request.get(route);
            expect(response.status()).not.toBe(403);
        }
    });
});

test.describe('RBAC - Staff Route Restrictions', () => {
    test('client cannot access staff routes', async ({ page, request }) => {
        // Login as client
        await page.goto('/');
        // Login form is visible by default - Client tab is default
        await page.click('button:has-text("Client")').catch(() => {
            console.log('Client tab already selected');
        });
        await page.fill('input[name="phone"]', CREDENTIALS.client.phone);
        await page.fill('input[name="password"]', CREDENTIALS.client.password);
        await page.click('button[type="submit"]');
        // All users navigate to /dashboard after login
        await page.waitForURL('/dashboard', { timeout: 10000 });

        // Test staff routes that require staff access
        const staffOnlyRoutes = [
            '/api/users',
            '/api/clients'
        ];

        for (const route of staffOnlyRoutes) {
            const response = await request.get(route);

            // Should be forbidden or require staff access
            expect([401, 403]).toContain(response.status());
            const result = await response.json();

            expect(result).toHaveProperty('error');
            console.log(`✅ Client blocked from ${route} with status ${response.status()}`);
        }
    });

    test('unauthenticated user cannot access protected routes', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        // Don't login - test unauthenticated access
        const allProtectedRoutes = [
            ...FINANCE_ROUTES,
            ...STAFF_ROUTES
        ];

        for (const route of allProtectedRoutes) {
            const response = await page.request.get(route);

            expect(response.status()).toBe(401);
            const result = await response.json();

            expect(result).toHaveProperty('error');
            expect(result.error.toLowerCase()).toContain('auth');
        }

        await context.close();
    });
});

test.describe('Session Behavior', () => {
    test('session persists across page reloads', async ({ page }) => {
        // Login as worker
        await page.goto('/');
        // Login form is visible by default - select Staff tab
        await page.click('button:has-text("Staff")');
        await page.fill('input[name="username"]', CREDENTIALS.worker.username);
        await page.fill('input[name="password"]', CREDENTIALS.worker.password);
        await page.click('button[type="submit"]');
        // All users navigate to /dashboard after login
        await page.waitForURL('/dashboard', { timeout: 10000 });

        // Verify session works
        const response1 = await page.request.get('/api/cleaning-jobs');
        expect(response1.ok()).toBeTruthy();

        // Reload page
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Session should still be valid
        const response2 = await page.request.get('/api/cleaning-jobs');
        expect(response2.ok()).toBeTruthy();
    });

    test('session check endpoint returns user info', async ({ page, request }) => {
        // Login as admin
        await page.goto('/');
        // Login form is visible by default - select Staff tab
        await page.click('button:has-text("Staff")');
        await page.fill('input[name="username"]', CREDENTIALS.admin.username);
        await page.fill('input[name="password"]', CREDENTIALS.admin.password);
        await page.click('button[type="submit"]');
        // All users navigate to /dashboard after login
        await page.waitForURL('/dashboard', { timeout: 10000 });

        // Check session endpoint
        const response = await request.get('/api/auth/check');
        expect(response.ok()).toBeTruthy();

        const result = await response.json();
        expect(result).toHaveProperty('user');
        expect(result.user).toHaveProperty('username', CREDENTIALS.admin.username);
        expect(result.user).toHaveProperty('userType', 'admin');
    });

    test('logout clears session and denies access', async ({ page, request }) => {
        // Login
        await page.goto('/');
        // Login form is visible by default - select Staff tab
        await page.click('button:has-text("Staff")');
        await page.fill('input[name="username"]', CREDENTIALS.worker.username);
        await page.fill('input[name="password"]', CREDENTIALS.worker.password);
        await page.click('button[type="submit"]');
        // All users navigate to /dashboard after login
        await page.waitForURL('/dashboard', { timeout: 10000 });

        // Verify authenticated
        const beforeLogout = await request.get('/api/cleaning-jobs');
        expect(beforeLogout.ok()).toBeTruthy();

        // Logout
        const logoutResponse = await request.post('/api/auth/logout');
        expect(logoutResponse.ok()).toBeTruthy();

        // Verify session cleared
        const afterLogout = await request.get('/api/cleaning-jobs');
        expect(afterLogout.status()).toBe(401);
    });

    test('concurrent sessions from different users work independently', async ({ browser }) => {
        // Create two separate contexts (like two different browsers)
        const workerContext = await browser.newContext();
        const clientContext = await browser.newContext();

        const workerPage = await workerContext.newPage();
        const clientPage = await clientContext.newPage();

        try {
            // Login as worker
            await workerPage.goto('/');
            // Login form is visible by default - select Staff tab
            await workerPage.click('button:has-text("Staff")');
            await workerPage.fill('input[name="username"]', CREDENTIALS.worker.username);
            await workerPage.fill('input[name="password"]', CREDENTIALS.worker.password);
            await workerPage.click('button[type="submit"]');
            // All users navigate to /dashboard after login
            await workerPage.waitForURL('/dashboard', { timeout: 10000 });

            // Login as client
            await clientPage.goto('/');
            // Login form is visible by default - Client tab is default
            await clientPage.click('button:has-text("Client")').catch(() => {
                console.log('Client tab already selected');
            });
            await clientPage.fill('input[name="phone"]', CREDENTIALS.client.phone);
            await clientPage.fill('input[name="password"]', CREDENTIALS.client.password);
            await clientPage.click('button[type="submit"]');
            // All users navigate to /dashboard after login
            await clientPage.waitForURL('/dashboard', { timeout: 10000 });

            // Verify both sessions work independently
            const workerResponse = await workerPage.request.get('/api/cleaning-jobs');
            const clientResponse = await clientPage.request.get('/api/cleaning-jobs');

            expect(workerResponse.ok()).toBeTruthy();
            expect(clientResponse.ok()).toBeTruthy();

            // Verify different data returned based on role
            const workerData = await workerResponse.json();
            const clientData = await clientResponse.json();

            expect(workerData._meta).toBeDefined();
            expect(clientData._meta).toBeDefined();
            // Correlation IDs should be different
            expect(workerData._meta.correlationId).not.toBe(clientData._meta.correlationId);

        } finally {
            await workerContext.close();
            await clientContext.close();
        }
    });
});

test.describe('Health and Readiness Endpoints', () => {
    test('health endpoint returns 200 without authentication', async ({ request }) => {
        const response = await request.get('/api/healthz');

        expect(response.ok()).toBeTruthy();
        const result = await response.json();

        expect(result).toHaveProperty('status', 'healthy');
        expect(result).toHaveProperty('timestamp');
    });

    test('readiness endpoint returns database status', async ({ request }) => {
        const response = await request.get('/api/readyz');

        expect(response.ok()).toBeTruthy();
        const result = await response.json();

        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('database');
        expect(result.database).toHaveProperty('connected');

        if (result.database.connected) {
            expect(result.database).toHaveProperty('latency');
            expect(typeof result.database.latency).toBe('number');
        }
    });

    test('health and readiness are public (no auth required)', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        // Don't login - test unauthenticated access
        const healthResponse = await page.request.get('/api/healthz');
        const readyResponse = await page.request.get('/api/readyz');

        expect(healthResponse.ok()).toBeTruthy();
        expect(readyResponse.ok()).toBeTruthy();

        await context.close();
    });
});

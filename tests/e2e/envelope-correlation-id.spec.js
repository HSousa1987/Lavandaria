/**
 * Interaction Test: Standardized Envelopes & Correlation IDs
 *
 * This lightweight test ensures all API responses include:
 * - Standardized envelope structure (success/error field)
 * - Correlation ID in both response body (_meta.correlationId) and header (X-Correlation-Id)
 * - Proper timestamp in ISO 8601 format
 *
 * If this test fails, it indicates a regression in the response standardization contract.
 */

const { test, expect } = require('@playwright/test');

const MASTER_CREDENTIALS = {
    username: 'master',
    password: 'master123'
};

async function loginAsMaster(page) {
    await page.goto('http://localhost:3000');
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if already logged in by trying to access dashboard
    const currentUrl = page.url();
    if (currentUrl.includes('dashboard')) {
        // Already logged in, logout first
        const logoutBtn = page.getByRole('button', { name: /logout/i });
        if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await logoutBtn.click();
            await page.waitForURL(/\/$/, { timeout: 5000 });
        }
    }

    // Now navigate to login
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // Select Staff button (plain button, not tab role)
    await page.getByRole('button', { name: 'Staff' }).click();

    // Fill credentials using placeholders
    await page.getByPlaceholder(/username/i).fill(MASTER_CREDENTIALS.username);
    await page.getByPlaceholder(/password/i).fill(MASTER_CREDENTIALS.password);

    // Submit login form
    await page.getByRole('button', { name: /login/i }).click();

    // Wait for dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

test.describe('Envelope & Correlation ID Contract', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsMaster(page);
    });

    test('successful GET request includes envelope and correlation ID', async ({ page }) => {
        const response = await page.request.get('/api/cleaning-jobs?limit=1');

        expect(response.ok()).toBeTruthy();
        const result = await response.json();

        // Verify envelope structure
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('_meta');

        // Verify correlation ID in body
        expect(result._meta).toHaveProperty('correlationId');
        expect(result._meta.correlationId).toMatch(/^req_/);

        // Verify correlation ID in header
        const correlationIdHeader = response.headers()['x-correlation-id'];
        expect(correlationIdHeader).toBeDefined();
        expect(correlationIdHeader).toMatch(/^req_/);

        // Verify timestamp
        expect(result._meta).toHaveProperty('timestamp');
        expect(new Date(result._meta.timestamp).toISOString()).toBe(result._meta.timestamp);
    });

    test('error response includes envelope and correlation ID', async ({ page }) => {
        // Request non-existent resource
        const response = await page.request.get('/api/cleaning-jobs/99999');

        expect(response.status()).toBe(404);
        const result = await response.json();

        // Verify error envelope structure
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('error');
        expect(result).toHaveProperty('code');
        expect(result).toHaveProperty('_meta');

        // Verify correlation ID in body
        expect(result._meta).toHaveProperty('correlationId');
        expect(result._meta.correlationId).toMatch(/^req_/);

        // Verify correlation ID in header
        const correlationIdHeader = response.headers()['x-correlation-id'];
        expect(correlationIdHeader).toBeDefined();
        expect(correlationIdHeader).toMatch(/^req_/);

        // Verify timestamp
        expect(result._meta).toHaveProperty('timestamp');
        expect(new Date(result._meta.timestamp).toISOString()).toBe(result._meta.timestamp);
    });

    test('POST request includes envelope and correlation ID', async ({ page }) => {
        // Create a test job (will fail validation but still return envelope)
        const response = await page.request.post('/api/cleaning-jobs', {
            data: { client_id: 999 } // Invalid - will fail
        });

        const result = await response.json();

        // Should have envelope even on error
        expect(result).toHaveProperty('_meta');
        expect(result._meta).toHaveProperty('correlationId');
        expect(result._meta.correlationId).toMatch(/^req_/);

        // Verify correlation ID in header
        expect(response.headers()['x-correlation-id']).toBeDefined();
    });
});

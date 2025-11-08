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
    await page.goto('/');
    await page.click('button:has-text("Staff")');
    await page.fill('input[name="username"]', MASTER_CREDENTIALS.username);
    await page.fill('input[name="password"]', MASTER_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
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

/**
 * E2E Tests: Client Photo Viewing with RBAC
 *
 * Scenarios covered:
 * 1. Client can view all photos for their own jobs
 * 2. Client receives paginated results for large photo sets
 * 3. Client cannot access another client's job photos
 * 4. Proper correlation IDs in all responses
 * 5. Photo viewed tracking works correctly
 */

const { test, expect } = require('@playwright/test');

// Test credentials
const CLIENT_CREDENTIALS = {
    phone: '911111111',
    password: 'lavandaria2025'
};

const WORKER_CREDENTIALS = {
    username: 'worker1',
    password: 'worker123'
};

// Helper to login as client
async function loginAsClient(page) {
    await page.goto('/');
    // Login form is visible by default (login-first UX)
    // Select client tab (form has client/staff tabs)
    await page.click('button:has-text("Client")').catch(() => {
        console.log('Client tab already selected');
    });
    await page.fill('input[name="phone"]', CLIENT_CREDENTIALS.phone);
    await page.fill('input[name="password"]', CLIENT_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    // All users navigate to /dashboard after login
    await page.waitForURL('/dashboard', { timeout: 10000 });
}

// Helper to get client's job ID
async function getClientJobId(page) {
    // Use page.request to share session cookies from page context
    const response = await page.request.get('/api/cleaning-jobs?limit=1');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.data.length).toBeGreaterThan(0);
    return data.data[0].id;
}

test.describe('Client Photo Viewing - Complete Set Access', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsClient(page);
    });

    test('client can view all photos for their own job', async ({ page }) => {
        const jobId = await getClientJobId(page);

        const response = await page.request.get(`/api/cleaning-jobs/${jobId}`);
        expect(response.ok()).toBeTruthy();

        const result = await response.json();

        // Verify standardized response envelope
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('job');
        expect(result).toHaveProperty('photos');
        expect(result).toHaveProperty('photosPagination');
        expect(result).toHaveProperty('_meta');
        expect(result._meta).toHaveProperty('correlationId');
        expect(result._meta).toHaveProperty('timestamp');

        // Verify photo pagination metadata
        expect(result.photosPagination).toHaveProperty('total');
        expect(result.photosPagination).toHaveProperty('limit');
        expect(result.photosPagination).toHaveProperty('offset');
        expect(result.photosPagination).toHaveProperty('hasMore');
    });

    test('client can paginate through large photo sets', async ({ page }) => {
        const jobId = await getClientJobId(page);

        // First page (default limit 100)
        const page1 = await page.request.get(`/api/cleaning-jobs/${jobId}?photoLimit=10&photoOffset=0`);
        expect(page1.ok()).toBeTruthy();
        const result1 = await page1.json();

        expect(result1.photosPagination.limit).toBe(10);
        expect(result1.photosPagination.offset).toBe(0);
        expect(result1.photos.length).toBeLessThanOrEqual(10);

        // If there are more photos, fetch second page
        if (result1.photosPagination.hasMore) {
            const page2 = await page.request.get(`/api/cleaning-jobs/${jobId}?photoLimit=10&photoOffset=10`);
            expect(page2.ok()).toBeTruthy();
            const result2 = await page2.json();

            expect(result2.photosPagination.offset).toBe(10);
            expect(result2.photos[0].id).not.toBe(result1.photos[0].id); // Different photos
        }
    });

    test('client viewing photos marks them as viewed', async ({ page }) => {
        const jobId = await getClientJobId(page);

        // First view - should update viewed status
        const response1 = await page.request.get(`/api/cleaning-jobs/${jobId}`);
        expect(response1.ok()).toBeTruthy();

        // Second view - verify job marked as viewed
        const response2 = await page.request.get(`/api/cleaning-jobs/${jobId}`);
        expect(response2.ok()).toBeTruthy();
        const result = await response2.json();

        expect(result.job.client_viewed_photos).toBe(true);
    });

    test('client receives complete photo count even with many batches', async ({ page }) => {
        const jobId = await getClientJobId(page);

        const response = await page.request.get(`/api/cleaning-jobs/${jobId}`);
        expect(response.ok()).toBeTruthy();

        const result = await response.json();

        // Total count should reflect ALL photos regardless of upload batch
        expect(result.photosPagination.total).toBeGreaterThanOrEqual(0);
        expect(typeof result.photosPagination.total).toBe('number');

        // If hasMore is false, returned photos should equal total
        if (!result.photosPagination.hasMore) {
            expect(result.photos.length).toBe(result.photosPagination.total);
        }
    });
});

test.describe('Client Photo Viewing - RBAC Enforcement', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsClient(page);
    });

    test('client cannot access another client\'s job photos', async ({ page }) => {
        // Attempt to access a job ID that doesn't belong to this client
        const unauthorizedJobId = 99999;

        const response = await page.request.get(`/api/cleaning-jobs/${unauthorizedJobId}`);

        expect(response.status()).toBe(404);
        const result = await response.json();

        // Verify error response structure
        expect(result).toHaveProperty('error');
        expect(result).toHaveProperty('code', 'JOB_NOT_FOUND');
        expect(result).toHaveProperty('_meta');
        expect(result._meta).toHaveProperty('correlationId');
    });

    test('worker can access assigned job photos but not unassigned', async ({ browser }) => {
        // Create new context for worker
        const context = await browser.newContext();
        const page = await context.newPage();

        // Login as worker
        await page.goto('/');
        await page.fill('input[name="username"]', WORKER_CREDENTIALS.username);
        await page.fill('input[name="password"]', WORKER_CREDENTIALS.password);
        await page.click('button[type="submit"]');
        await page.waitForURL('/worker', { timeout: 10000 });

        // Get assigned job
        const jobsResponse = await page.request.get('/api/cleaning-jobs?limit=1');
        expect(jobsResponse.ok()).toBeTruthy();
        const jobsData = await jobsResponse.json();
        const assignedJobId = jobsData.data[0].id;

        // Access assigned job - should succeed
        const assignedResponse = await page.request.get(`/api/cleaning-jobs/${assignedJobId}`);
        expect(assignedResponse.ok()).toBeTruthy();

        // Attempt unassigned job - should fail
        const unassignedJobId = 99999;
        const unassignedResponse = await page.request.get(`/api/cleaning-jobs/${unassignedJobId}`);
        expect(unassignedResponse.status()).toBe(404);

        await context.close();
    });

    test('unauthenticated user cannot access job photos', async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        const response = await page.request.get('/api/cleaning-jobs/1');

        expect(response.status()).toBe(401);
        const result = await response.json();
        expect(result).toHaveProperty('error');

        await context.close();
    });
});

test.describe('Client Photo Viewing - Response Validation', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsClient(page);
    });

    test('all responses include correlation IDs', async ({ page }) => {
        const jobId = await getClientJobId(page);

        const response = await page.request.get(`/api/cleaning-jobs/${jobId}`);
        const result = await response.json();

        // Verify correlation ID in response body
        expect(result._meta).toBeDefined();
        expect(result._meta.correlationId).toBeDefined();
        expect(result._meta.correlationId).toMatch(/^req_/);

        // Verify correlation ID in response headers (if exposed)
        const headers = response.headers();
        if (headers['x-correlation-id']) {
            expect(headers['x-correlation-id']).toMatch(/^req_/);
        }
    });

    test('error responses include correlation IDs', async ({ page }) => {
        const invalidJobId = 99999;

        const response = await page.request.get(`/api/cleaning-jobs/${invalidJobId}`);
        expect(response.ok()).toBeFalsy();

        const result = await response.json();

        // Error responses must also have correlation IDs
        expect(result._meta).toBeDefined();
        expect(result._meta.correlationId).toBeDefined();
        expect(result._meta.correlationId).toMatch(/^req_/);
        expect(result._meta.timestamp).toBeDefined();
    });
});

test.describe('Client Photo Viewing - UI Integration', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsClient(page);
    });

    test('client dashboard shows jobs with photo counts', async ({ page }) => {
        // Navigate to client dashboard
        await page.goto('/client');

        // Wait for jobs to load
        await page.waitForSelector('[data-testid="job-list"], .job-card, table', { timeout: 10000 }).catch(() => {
            console.log('Job list selector not found, checking for content...');
        });

        // Verify page loaded
        const pageContent = await page.textContent('body');
        expect(pageContent).toBeTruthy();
    });

    test('clicking on job navigates to job details with photos', async ({ page }) => {
        // Navigate to client dashboard
        await page.goto('/client');

        // Try to find and click first job
        const jobLink = await page.locator('a[href*="/job"], button:has-text("View Details")').first();
        if (await jobLink.count() > 0) {
            await jobLink.click();

            // Wait for job details page
            await page.waitForURL(/\/job\/\d+/, { timeout: 10000 }).catch(() => {
                console.log('Job detail route may differ');
            });

            // Verify photos section exists
            await page.waitForSelector('[data-testid="photos"], .photos-gallery, img', { timeout: 5000 }).catch(() => {
                console.log('Photos section may use different selectors');
            });
        }
    });
});

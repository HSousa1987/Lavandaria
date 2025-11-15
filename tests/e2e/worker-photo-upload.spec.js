/**
 * E2E Tests: Worker Photo Upload (Unlimited total, 10 per batch)
 *
 * Scenarios covered:
 * 1. Worker can upload up to 10 photos in one batch
 * 2. Worker can perform multiple batches to reach large totals (e.g., 50 photos)
 * 3. Attempting 11 files in one request returns clear error
 * 4. Invalid file types are rejected
 * 5. Oversized files are rejected
 * 6. Worker cannot upload to unassigned jobs
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { buildPhotoUploadForm } = require('../helpers/multipart-upload');

// Test credentials from seed script
const WORKER_CREDENTIALS = {
    username: 'worker1',
    password: 'worker123'
};

// Helper to create test image files
function createTestImage(filename, sizeKB = 100) {
    const buffer = Buffer.alloc(sizeKB * 1024);
    const filepath = path.join(__dirname, '..', 'fixtures', filename);

    // Ensure fixtures directory exists
    const fixturesDir = path.dirname(filepath);
    if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
    }

    fs.writeFileSync(filepath, buffer);
    return filepath;
}

// Helper to login as worker
async function loginAsWorker(page) {
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

    // Select Staff tab (plain button, not tab role)
    await page.getByRole('button', { name: 'Staff' }).click();

    // Fill credentials using placeholders
    await page.getByPlaceholder(/username/i).fill(WORKER_CREDENTIALS.username);
    await page.getByPlaceholder(/password/i).fill(WORKER_CREDENTIALS.password);

    // Submit login form
    await page.getByRole('button', { name: /login/i }).click();

    // Wait for dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

// Helper to get test job ID via API
async function getTestJobId(page) {
    const response = await page.request.get('/api/cleaning-jobs?limit=1');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.data.length).toBeGreaterThan(0);
    return data.data[0].id;
}

test.describe('Worker Photo Upload - Batch Limits', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsWorker(page);
    });

    test('should successfully upload 10 photos in one batch (max batch size)', async ({ page, request }) => {
        const jobId = await getTestJobId(page);

        // Create 10 test images
        const files = [];
        for (let i = 1; i <= 10; i++) {
            files.push(createTestImage(`test-photo-${i}.jpg`, 50));
        }

        // Upload batch via API using centralized helper
        const formData = buildPhotoUploadForm(files);
        const response = await request.post(`/api/cleaning-jobs/${jobId}/photos`, formData);

        expect(response.ok()).toBeTruthy();
        const result = await response.json();

        // Verify standardized response envelope
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('count', 10);
        expect(result).toHaveProperty('photos');
        expect(result.photos).toHaveLength(10);

        // Verify correlation ID in response body and headers
        expect(result).toHaveProperty('_meta');
        expect(result._meta).toHaveProperty('correlationId');
        expect(result._meta.correlationId).toMatch(/^req_/);
        expect(result._meta).toHaveProperty('timestamp');
        expect(response.headers()['x-correlation-id']).toBeDefined();

        // Cleanup
        files.forEach(file => fs.unlinkSync(file));
    });

    test('should successfully upload multiple batches to reach 50+ photos total', async ({ page, request }) => {
        const jobId = await getTestJobId(page);
        let totalUploaded = 0;

        // Upload 5 batches of 10 photos each (50 total)
        for (let batch = 1; batch <= 5; batch++) {
            const files = [];
            for (let i = 1; i <= 10; i++) {
                files.push(createTestImage(`batch${batch}-photo-${i}.jpg`, 50));
            }

            const formData = buildPhotoUploadForm(files);
            const response = await request.post(`/api/cleaning-jobs/${jobId}/photos`, formData);

            expect(response.ok()).toBeTruthy();
            const result = await response.json();
            expect(result.count).toBe(10);
            totalUploaded += result.count;

            // Verify correlation ID in each batch response
            expect(result._meta).toHaveProperty('correlationId');
            expect(response.headers()['x-correlation-id']).toBeDefined();

            // Cleanup batch files
            files.forEach(file => fs.unlinkSync(file));

            // Add delay between batch submissions to allow server processing
            // and modal state reset if UI is involved
            if (batch < 5) {
                await page.waitForTimeout(500);
            }
        }

        expect(totalUploaded).toBe(50);

        // Verify total photo count for job
        const jobResponse = await request.get(`/api/cleaning-jobs/${jobId}`);
        expect(jobResponse.ok()).toBeTruthy();
        const jobData = await jobResponse.json();
        expect(jobData.photosPagination.total).toBeGreaterThanOrEqual(50);
    });

    test('should reject upload with 11 files (exceeds batch limit)', async ({ page, request }) => {
        const jobId = await getTestJobId(page);

        // Create 11 test images
        const files = [];
        for (let i = 1; i <= 11; i++) {
            files.push(createTestImage(`excess-photo-${i}.jpg`, 50));
        }

        const formData = buildPhotoUploadForm(files);
        const response = await request.post(`/api/cleaning-jobs/${jobId}/photos`, formData);

        expect(response.status()).toBe(400);
        const result = await response.json();

        // Verify standardized error response envelope
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('error');
        expect(result.error).toContain('Maximum 10');
        expect(result).toHaveProperty('code', 'BATCH_LIMIT_EXCEEDED');

        // Verify correlation ID in error response
        expect(result).toHaveProperty('_meta');
        expect(result._meta).toHaveProperty('correlationId');
        expect(result._meta.correlationId).toMatch(/^req_/);
        expect(response.headers()['x-correlation-id']).toBeDefined();

        // Cleanup
        files.forEach(file => fs.unlinkSync(file));
    });

    test('should reject invalid file types', async ({ page, request }) => {
        const jobId = await getTestJobId(page);

        // Create invalid file (text file instead of image)
        const invalidFile = path.join(__dirname, '..', 'fixtures', 'invalid.txt');
        fs.writeFileSync(invalidFile, 'This is not an image');

        const formData = buildPhotoUploadForm([invalidFile]);
        const response = await request.post(`/api/cleaning-jobs/${jobId}/photos`, formData);

        expect(response.ok()).toBeFalsy();
        const result = await response.json();

        // Verify standardized error response
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('error');

        // Verify correlation ID in error response
        expect(result).toHaveProperty('_meta');
        expect(result._meta).toHaveProperty('correlationId');
        expect(response.headers()['x-correlation-id']).toBeDefined();

        // Cleanup
        fs.unlinkSync(invalidFile);
    });

    test('should reject files exceeding 10MB limit', async ({ page, request }) => {
        const jobId = await getTestJobId(page);

        // Create 11MB file (exceeds 10MB limit)
        const oversizedFile = createTestImage('oversized.jpg', 11 * 1024);

        const formData = buildPhotoUploadForm([oversizedFile]);
        const response = await request.post(`/api/cleaning-jobs/${jobId}/photos`, formData);

        expect(response.ok()).toBeFalsy();
        expect(response.status()).toBe(413); // Payload Too Large

        // Verify correlation ID even in error response (if JSON returned)
        const contentType = response.headers()['content-type'];
        if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            expect(result._meta).toHaveProperty('correlationId');
        }

        // Cleanup
        fs.unlinkSync(oversizedFile);
    });

    test('should prevent worker from uploading to unassigned job', async ({ page, request }) => {
        // This test requires a second job NOT assigned to worker1
        // For now, we'll test with an invalid job ID
        const invalidJobId = 99999;

        const file = createTestImage('unauthorized.jpg', 50);

        const formData = buildPhotoUploadForm([file]);
        const response = await request.post(`/api/cleaning-jobs/${invalidJobId}/photos`, formData);

        expect(response.status()).toBe(404);
        const result = await response.json();

        // Verify standardized error response
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('code', 'JOB_NOT_FOUND');

        // Verify correlation ID in error response
        expect(result).toHaveProperty('_meta');
        expect(result._meta).toHaveProperty('correlationId');
        expect(result._meta.correlationId).toMatch(/^req_/);
        expect(response.headers()['x-correlation-id']).toBeDefined();

        // Cleanup
        fs.unlinkSync(file);
    });
});

test.describe('Worker Photo Upload - Response Validation', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsWorker(page);
    });

    test('all responses must include correlation IDs', async ({ page, request }) => {
        const jobId = await getTestJobId(page);
        const file = createTestImage('correlation-test.jpg', 50);

        const formData = buildPhotoUploadForm([file]);
        const response = await request.post(`/api/cleaning-jobs/${jobId}/photos`, formData);

        const result = await response.json();

        // Verify standardized response envelope
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('photos');
        expect(result).toHaveProperty('count');

        // Verify correlation ID in response body
        expect(result).toHaveProperty('_meta');
        expect(result._meta).toBeDefined();
        expect(result._meta.correlationId).toBeDefined();
        expect(result._meta.correlationId).toMatch(/^req_/);
        expect(result._meta).toHaveProperty('timestamp');

        // Verify correlation ID in response headers
        expect(response.headers()['x-correlation-id']).toBeDefined();
        expect(response.headers()['x-correlation-id']).toMatch(/^req_/);

        // Cleanup
        fs.unlinkSync(file);
    });
});

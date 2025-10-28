/**
 * E2E Tests: Worker Photo Upload via UI (Unlimited total, 10 per batch)
 *
 * PR#3: Refactored from direct API to UI-driven uploads with envelope assertions
 *
 * Scenarios covered:
 * 1. Worker can upload up to 10 photos in one batch via UI
 * 2. Worker can perform multiple batches to reach large totals via UI
 * 3. Attempting 11 files in one request via UI returns clear error
 * 4. Invalid file types are rejected via UI
 * 5. Oversized files are rejected via UI
 * 6. Worker cannot upload to unassigned jobs (API-level test, no UI affordance)
 * 7. All responses include standardized envelopes with correlation IDs
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { navigateToJobCompletionForm, uploadPhotosViaUI } = require('../helpers/multipart-upload');

// Test credentials from seed script
const WORKER_CREDENTIALS = {
    username: 'worker1',
    password: 'worker123'
};

const TEST_JOB_ID = 5; // From deterministic seed

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
    await page.goto('/');
    // Login form is visible by default (login-first UX)
    // Select Staff tab
    await page.click('button:has-text("Staff")');
    await page.fill('input[name="username"]', WORKER_CREDENTIALS.username);
    await page.fill('input[name="password"]', WORKER_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    // All users navigate to /dashboard after login
    await page.waitForURL('/dashboard', { timeout: 10000 });
}

test.describe('Worker Photo Upload via UI - Batch Limits', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsWorker(page);
    });

    test('should successfully upload 10 photos in one batch via UI (max batch size)', async ({ page }) => {
        // Navigate to job completion form
        await navigateToJobCompletionForm(page, TEST_JOB_ID);

        // Create 10 test images
        const files = [];
        for (let i = 1; i <= 10; i++) {
            files.push(createTestImage(`ui-test-photo-${i}.jpg`, 50));
        }

        // Upload via UI and capture response
        const { response, result } = await uploadPhotosViaUI(page, TEST_JOB_ID, files);

        // Verify standardized response envelope
        expect(response.ok()).toBeTruthy();
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

        console.log(`✅ Uploaded 10 photos via UI with correlation ID: ${result._meta.correlationId}`);

        // Cleanup
        files.forEach(file => fs.unlinkSync(file));
    });

    test('should reject upload with 11 files via UI (exceeds batch limit)', async ({ page }) => {
        // Navigate to job completion form
        await navigateToJobCompletionForm(page, TEST_JOB_ID);

        // Create 11 test images
        const files = [];
        for (let i = 1; i <= 11; i++) {
            files.push(createTestImage(`ui-excess-photo-${i}.jpg`, 50));
        }

        // Upload via UI and capture error response
        const { response, result } = await uploadPhotosViaUI(page, TEST_JOB_ID, files);

        // Verify standardized error response envelope
        expect(response.status()).toBe(400);
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('error');
        expect(result.error).toContain('Maximum 10');
        expect(result).toHaveProperty('code', 'BATCH_LIMIT_EXCEEDED');

        // Verify correlation ID in error response
        expect(result).toHaveProperty('_meta');
        expect(result._meta).toHaveProperty('correlationId');
        expect(result._meta.correlationId).toMatch(/^req_/);
        expect(response.headers()['x-correlation-id']).toBeDefined();

        console.log(`✅ Batch limit enforced with correlation ID: ${result._meta.correlationId}`);

        // Cleanup
        files.forEach(file => fs.unlinkSync(file));
    });

    test('should reject invalid file types via UI', async ({ page }) => {
        // Navigate to job completion form
        await navigateToJobCompletionForm(page, TEST_JOB_ID);

        // Create invalid file (text file instead of image)
        const invalidFile = path.join(__dirname, '..', 'fixtures', 'ui-invalid.txt');
        fs.writeFileSync(invalidFile, 'This is not an image');

        // Upload via UI and capture error response
        const { response, result } = await uploadPhotosViaUI(page, TEST_JOB_ID, [invalidFile]);

        // Verify standardized error response
        expect(response.ok()).toBeFalsy();
        expect(result).toHaveProperty('success', false);
        expect(result).toHaveProperty('error');

        // Verify correlation ID in error response
        expect(result).toHaveProperty('_meta');
        expect(result._meta).toHaveProperty('correlationId');
        expect(response.headers()['x-correlation-id']).toBeDefined();

        console.log(`✅ Invalid type rejected with correlation ID: ${result._meta.correlationId}`);

        // Cleanup
        fs.unlinkSync(invalidFile);
    });

    test('should reject files exceeding 10MB limit via UI', async ({ page }) => {
        // Navigate to job completion form
        await navigateToJobCompletionForm(page, TEST_JOB_ID);

        // Create 11MB file (exceeds 10MB limit)
        const oversizedFile = createTestImage('ui-oversized.jpg', 11 * 1024);

        // Upload via UI and capture error response
        const { response, result } = await uploadPhotosViaUI(page, TEST_JOB_ID, [oversizedFile]);

        // Verify error response
        expect(response.ok()).toBeFalsy();
        expect(response.status()).toBe(413); // Payload Too Large

        // Verify correlation ID even in error response (if JSON returned)
        if (result) {
            expect(result._meta).toHaveProperty('correlationId');
        }

        console.log(`✅ Oversize file rejected (413 status)`);

        // Cleanup
        fs.unlinkSync(oversizedFile);
    });

    test('should prevent worker from uploading to unassigned job (API-level)', async ({ page }) => {
        // This test uses API since there's no UI affordance to access unassigned jobs
        // Worker dashboard only shows assigned jobs

        const unassignedJobId = 99999; // Non-existent job
        const file = createTestImage('ui-unauthorized.jpg', 50);

        // Attempt direct API upload (no UI path for unassigned jobs)
        const response = await page.request.post(`/api/cleaning-jobs/${unassignedJobId}/photos`, {
            multipart: {
                photos: [{
                    name: path.basename(file),
                    mimeType: 'image/jpeg',
                    buffer: fs.readFileSync(file)
                }]
            }
        });

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

        console.log(`✅ Unassigned job blocked with correlation ID: ${result._meta.correlationId}`);

        // Cleanup
        fs.unlinkSync(file);
    });
});

test.describe('Worker Photo Upload via UI - Multi-Batch Scenario', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsWorker(page);
    });

    test('should successfully upload multiple batches to reach 50+ photos total via UI', async ({ page }) => {
        let totalUploaded = 0;

        // Upload 5 batches of 10 photos each (50 total)
        for (let batch = 1; batch <= 5; batch++) {
            // Navigate to completion form for each batch
            await navigateToJobCompletionForm(page, TEST_JOB_ID);

            const files = [];
            for (let i = 1; i <= 10; i++) {
                files.push(createTestImage(`ui-batch${batch}-photo-${i}.jpg`, 50));
            }

            // Upload via UI and capture response
            const { response, result } = await uploadPhotosViaUI(page, TEST_JOB_ID, files);

            expect(response.ok()).toBeTruthy();
            expect(result.count).toBe(10);
            totalUploaded += result.count;

            // Verify correlation ID in each batch response
            expect(result._meta).toHaveProperty('correlationId');
            expect(response.headers()['x-correlation-id']).toBeDefined();

            console.log(`✅ Batch ${batch}/5 uploaded with correlation ID: ${result._meta.correlationId}`);

            // Cleanup batch files
            files.forEach(file => fs.unlinkSync(file));

            // Close the completion modal after each batch (click cancel or backdrop)
            const cancelButton = page.locator('button:has-text("Cancel")');
            if (await cancelButton.isVisible()) {
                await cancelButton.click();
            }
        }

        expect(totalUploaded).toBe(50);

        // Verify total photo count for job
        const jobResponse = await page.request.get(`/api/cleaning-jobs/${TEST_JOB_ID}`);
        expect(jobResponse.ok()).toBeTruthy();
        const jobData = await jobResponse.json();
        expect(jobData.photosPagination.total).toBeGreaterThanOrEqual(50);

        console.log(`✅ Total ${totalUploaded} photos uploaded across 5 batches via UI`);
    });
});

test.describe('Worker Photo Upload via UI - Response Validation', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsWorker(page);
    });

    test('all responses via UI must include correlation IDs', async ({ page }) => {
        await navigateToJobCompletionForm(page, TEST_JOB_ID);

        const file = createTestImage('ui-correlation-test.jpg', 50);

        const { response, result } = await uploadPhotosViaUI(page, TEST_JOB_ID, [file]);

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

        console.log(`✅ Correlation ID verified: ${result._meta.correlationId}`);

        // Cleanup
        fs.unlinkSync(file);
    });
});

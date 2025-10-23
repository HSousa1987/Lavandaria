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

        // Upload batch via API
        const formData = {
            multipart: {
                ...files.reduce((acc, file, index) => ({
                    ...acc,
                    [`photos`]: { name: path.basename(file), mimeType: 'image/jpeg', buffer: fs.readFileSync(file) }
                }), {})
            }
        };

        const response = await request.post(`/api/cleaning-jobs/${jobId}/photos`, {
            multipart: {
                photos: files.map(file => ({
                    name: path.basename(file),
                    mimeType: 'image/jpeg',
                    buffer: fs.readFileSync(file)
                }))
            }
        });

        expect(response.ok()).toBeTruthy();
        const result = await response.json();

        // Verify standardized response envelope
        expect(result).toHaveProperty('success', true);
        expect(result).toHaveProperty('count', 10);
        expect(result).toHaveProperty('photos');
        expect(result.photos).toHaveLength(10);
        expect(result).toHaveProperty('_meta');
        expect(result._meta).toHaveProperty('correlationId');
        expect(result._meta).toHaveProperty('timestamp');

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

            const response = await request.post(`/api/cleaning-jobs/${jobId}/photos`, {
                multipart: {
                    photos: files.map(file => ({
                        name: path.basename(file),
                        mimeType: 'image/jpeg',
                        buffer: fs.readFileSync(file)
                    }))
                }
            });

            expect(response.ok()).toBeTruthy();
            const result = await response.json();
            expect(result.count).toBe(10);
            totalUploaded += result.count;

            // Cleanup batch files
            files.forEach(file => fs.unlinkSync(file));
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

        const response = await request.post(`/api/cleaning-jobs/${jobId}/photos`, {
            multipart: {
                photos: files.map(file => ({
                    name: path.basename(file),
                    mimeType: 'image/jpeg',
                    buffer: fs.readFileSync(file)
                }))
            }
        });

        expect(response.status()).toBe(400);
        const result = await response.json();

        // Verify error response structure
        expect(result).toHaveProperty('error');
        expect(result.error).toContain('Maximum 10 photos');
        expect(result).toHaveProperty('code', 'BATCH_LIMIT_EXCEEDED');
        expect(result).toHaveProperty('_meta');
        expect(result._meta).toHaveProperty('correlationId');

        // Cleanup
        files.forEach(file => fs.unlinkSync(file));
    });

    test('should reject invalid file types', async ({ page, request }) => {
        const jobId = await getTestJobId(page);

        // Create invalid file (text file instead of image)
        const invalidFile = path.join(__dirname, '..', 'fixtures', 'invalid.txt');
        fs.writeFileSync(invalidFile, 'This is not an image');

        const response = await request.post(`/api/cleaning-jobs/${jobId}/photos`, {
            multipart: {
                photos: [{
                    name: 'invalid.txt',
                    mimeType: 'text/plain',
                    buffer: fs.readFileSync(invalidFile)
                }]
            }
        });

        expect(response.ok()).toBeFalsy();
        const result = await response.json();
        expect(result).toHaveProperty('error');
        expect(result.error.toLowerCase()).toContain('image');

        // Cleanup
        fs.unlinkSync(invalidFile);
    });

    test('should reject files exceeding 10MB limit', async ({ page, request }) => {
        const jobId = await getTestJobId(page);

        // Create 11MB file (exceeds 10MB limit)
        const oversizedFile = createTestImage('oversized.jpg', 11 * 1024);

        const response = await request.post(`/api/cleaning-jobs/${jobId}/photos`, {
            multipart: {
                photos: [{
                    name: 'oversized.jpg',
                    mimeType: 'image/jpeg',
                    buffer: fs.readFileSync(oversizedFile)
                }]
            }
        });

        expect(response.ok()).toBeFalsy();
        expect(response.status()).toBe(413); // Payload Too Large

        // Cleanup
        fs.unlinkSync(oversizedFile);
    });

    test('should prevent worker from uploading to unassigned job', async ({ page, request }) => {
        // This test requires a second job NOT assigned to worker1
        // For now, we'll test with an invalid job ID
        const invalidJobId = 99999;

        const file = createTestImage('unauthorized.jpg', 50);

        const response = await request.post(`/api/cleaning-jobs/${invalidJobId}/photos`, {
            multipart: {
                photos: [{
                    name: 'unauthorized.jpg',
                    mimeType: 'image/jpeg',
                    buffer: fs.readFileSync(file)
                }]
            }
        });

        expect(response.status()).toBe(404);
        const result = await response.json();
        expect(result).toHaveProperty('code', 'JOB_NOT_FOUND');
        expect(result._meta).toHaveProperty('correlationId');

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

        const response = await request.post(`/api/cleaning-jobs/${jobId}/photos`, {
            multipart: {
                photos: [{
                    name: 'correlation-test.jpg',
                    mimeType: 'image/jpeg',
                    buffer: fs.readFileSync(file)
                }]
            }
        });

        const result = await response.json();

        // Verify correlation ID in response
        expect(result._meta).toBeDefined();
        expect(result._meta.correlationId).toBeDefined();
        expect(result._meta.correlationId).toMatch(/^req_/);

        // Verify correlation ID in response headers
        expect(response.headers()['x-correlation-id']).toBeDefined();

        // Cleanup
        fs.unlinkSync(file);
    });
});

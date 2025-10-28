/**
 * Helper for constructing multipart file uploads in E2E tests
 *
 * Ensures proper binary encoding, file naming, and MIME type declaration
 * for Playwright's request API with Multer endpoints.
 */

const fs = require('fs');
const path = require('path');

/**
 * Build multipart form data for photo uploads
 *
 * @param {string[]} filePaths - Array of absolute file paths to upload
 * @returns {Object} Multipart form data object for Playwright request API
 *
 * Example:
 *   const formData = buildPhotoUploadForm(['/path/to/photo1.jpg', '/path/to/photo2.jpg']);
 *   await request.post('/api/cleaning-jobs/123/photos', formData);
 */
function buildPhotoUploadForm(filePaths) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
        throw new Error('buildPhotoUploadForm requires a non-empty array of file paths');
    }

    // Validate all files exist
    filePaths.forEach(filePath => {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
    });

    // For Playwright's request API with multiple files to same field,
    // we need to use the 'multipart' option with file paths.
    // Playwright expects: multipart: { fieldName: [file1, file2, ...] }
    // where each file is { name, mimeType, buffer }

    const files = filePaths.map(filePath => {
        const filename = path.basename(filePath);
        const ext = path.extname(filename).toLowerCase();

        // Map extensions to MIME types
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.txt': 'text/plain'
        };

        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        // Read file as buffer and return proper format
        const buffer = fs.readFileSync(filePath);

        return {
            name: filename,
            mimeType: mimeType,
            buffer: buffer
        };
    });

    // Return in Playwright's expected format
    return {
        multipart: {
            photos: files
        }
    };
}

/**
 * Build multipart form data with additional metadata fields
 *
 * @param {string[]} filePaths - Array of absolute file paths to upload
 * @param {Object} metadata - Additional form fields (e.g., { photo_type: 'before', room_area: 'Kitchen' })
 * @returns {Object} Multipart form data object for Playwright request API
 */
function buildPhotoUploadFormWithMetadata(filePaths, metadata = {}) {
    const formData = buildPhotoUploadForm(filePaths);

    // Add metadata fields to the multipart form
    Object.keys(metadata).forEach(key => {
        formData.multipart[key] = String(metadata[key]);
    });

    return formData;
}

/**
 * Navigate to a job's completion form (UI flow to reach photo upload)
 *
 * @param {import('@playwright/test').Page} page - Playwright page object (must be at /dashboard)
 * @param {number} jobId - Cleaning job ID to complete
 * @returns {Promise<void>}
 *
 * This helper:
 * 1. Finds the job card on the dashboard
 * 2. Clicks "Start Job" if needed
 * 3. Clicks "Complete Job" or "End Job" to open the completion form modal
 */
async function navigateToJobCompletionForm(page, jobId) {
    // Wait for dashboard to load
    await page.waitForSelector('text=Assigned Cleaning Jobs', { timeout: 10000 });

    // Find the job card by ID
    const jobCard = page.locator(`div:has-text("Job #${jobId}")`).first();
    await jobCard.waitFor({ state: 'visible', timeout: 5000 });

    // Check if we need to start the job first
    const startButton = jobCard.locator('button:has-text("Start Job")');
    const completeButton = jobCard.locator('button:has-text("Complete Job")');
    const endButton = jobCard.locator('button:has-text("End Job")');

    if (await startButton.isVisible()) {
        await startButton.click();
        // Wait a moment for state to update
        await page.waitForTimeout(500);
    }

    // Now click the complete/end button
    if (await completeButton.isVisible()) {
        await completeButton.click();
    } else if (await endButton.isVisible()) {
        await endButton.click();
    } else {
        throw new Error(`No completion button found for job #${jobId}`);
    }

    // Wait for completion form modal to appear
    await page.waitForSelector('text=Complete Job', { timeout: 5000 });
    await page.waitForSelector('input[type="file"][accept="image/*"]', { timeout: 5000 });
}

/**
 * Upload photos via UI and capture the network response for envelope assertions
 *
 * @param {import('@playwright/test').Page} page - Playwright page object (must be logged in as worker)
 * @param {number} jobId - Cleaning job ID to upload photos to
 * @param {string[]} filePaths - Array of absolute file paths to upload
 * @param {Object} options - Optional configuration
 * @param {boolean} options.waitForResponse - Whether to wait for and return the upload response (default: true)
 * @param {boolean} options.submitForm - Whether to submit the completion form after selecting files (default: true)
 * @param {number} options.timeout - Timeout for response wait in ms (default: 30000)
 * @returns {Promise<{response: Response|null, result: Object|null}>} Upload response and parsed JSON
 *
 * Example:
 *   await loginAsWorker(page);
 *   await page.goto('/dashboard');
 *   await navigateToJobCompletionForm(page, 5);
 *   const files = ['/path/to/photo1.jpg', '/path/to/photo2.jpg'];
 *   const { response, result } = await uploadPhotosViaUI(page, 5, files);
 *
 *   // Assert standardized envelope
 *   expect(result.success).toBe(true);
 *   expect(result._meta.correlationId).toMatch(/^req_/);
 */
async function uploadPhotosViaUI(page, jobId, filePaths, options = {}) {
    const { waitForResponse = true, submitForm = true, timeout = 30000 } = options;

    // Validate inputs
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
        throw new Error('uploadPhotosViaUI requires a non-empty array of file paths');
    }

    filePaths.forEach(filePath => {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
    });

    // Set up response capture if requested
    let responsePromise = null;
    if (waitForResponse) {
        responsePromise = page.waitForResponse(
            response => response.url().includes(`/api/cleaning-jobs/${jobId}/photos`) && response.request().method() === 'POST',
            { timeout }
        );
    }

    // Locate the file input (Worker completion form)
    // Using robust selector: input with type=file and accept=image/*
    const fileInput = page.locator('input[type="file"][accept="image/*"]');

    // Verify file input is present
    await fileInput.waitFor({ state: 'attached', timeout: 5000 });

    // Set files to the input (Playwright handles multiple files)
    await fileInput.setInputFiles(filePaths);

    // Submit the form (look for submit button in the completion form)
    // The completion form has a button with text "Submit Completion"
    const submitButton = page.locator('button[type="submit"]:has-text("Submit Completion")');
    await submitButton.click();

    // Wait for and capture the response
    let response = null;
    let result = null;

    if (waitForResponse && responsePromise) {
        try {
            response = await responsePromise;

            // Parse JSON response
            const contentType = response.headers()['content-type'];
            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            }
        } catch (error) {
            console.error('Failed to capture upload response:', error);
            throw new Error(`Failed to capture upload response: ${error.message}`);
        }
    }

    return { response, result };
}

module.exports = {
    buildPhotoUploadForm,
    buildPhotoUploadFormWithMetadata,
    navigateToJobCompletionForm,
    uploadPhotosViaUI
};

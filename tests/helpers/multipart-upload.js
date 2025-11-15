/**
 * Helper for constructing multipart file uploads in E2E tests
 *
 * Ensures proper binary encoding, file naming, and MIME type declaration
 * for Playwright's request API with Multer endpoints.
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

/**
 * Build multipart form data for photo uploads
 *
 * @param {string[]} filePaths - Array of absolute file paths to upload
 * @returns {FormData} FormData object for Playwright request API
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

    // Create FormData instance - this is what Playwright's request API expects
    const formData = new FormData();

    // Add each file to the multipart form with proper stream handling
    filePaths.forEach(filePath => {
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

        // Create a readable stream from the file and append to FormData
        // FormData handles stream creation and event handlers properly
        const fileStream = fs.createReadStream(filePath);
        formData.append('photos', fileStream, {
            filename: filename,
            contentType: mimeType
        });
    });

    return formData;
}

/**
 * Build multipart form data with additional metadata fields
 *
 * @param {string[]} filePaths - Array of absolute file paths to upload
 * @param {Object} metadata - Additional form fields (e.g., { photo_type: 'before', room_area: 'Kitchen' })
 * @returns {FormData} FormData object for Playwright request API
 */
function buildPhotoUploadFormWithMetadata(filePaths, metadata = {}) {
    const formData = buildPhotoUploadForm(filePaths);

    // Add metadata fields to the multipart form
    Object.keys(metadata).forEach(key => {
        formData.append(key, String(metadata[key]));
    });

    return formData;
}

module.exports = {
    buildPhotoUploadForm,
    buildPhotoUploadFormWithMetadata
};

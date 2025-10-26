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

    // Read all files as binary buffers
    const files = filePaths.map(filePath => {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const buffer = fs.readFileSync(filePath);
        const filename = path.basename(filePath);
        const ext = path.extname(filename).toLowerCase();

        // Map extensions to MIME types
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif'
        };

        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        return {
            name: filename,
            mimeType: mimeType,
            buffer: buffer
        };
    });

    // Return multipart structure for Playwright
    // Multer's upload.array('photos', 10) expects multiple files under the 'photos' field
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

module.exports = {
    buildPhotoUploadForm,
    buildPhotoUploadFormWithMetadata
};

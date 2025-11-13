const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { pool } = require('../config/database');
const { requireStaff, requireMasterOrAdmin } = require('../middleware/permissions');
const { listResponse, validatePagination, errorResponse, successResponse } = require('../middleware/validation');

// Configure multer for photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/cleaning_photos/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'cleaning-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.userType) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

// ==============================================
// GET ALL CLEANING JOBS
// ==============================================
router.get('/', requireAuth, async (req, res) => {
    console.log(`🔵 GET /api/cleaning-jobs [${req.correlationId}] - User: ${req.session.userType}`);

    try {
        const { limit, offset, sort, order } = validatePagination(req);
        let query, params, countQuery, countParams;

        if (req.session.userType === 'master' || req.session.userType === 'admin') {
            // Master/Admin see all jobs
            countQuery = 'SELECT COUNT(*) FROM cleaning_jobs';
            countParams = [];
            query = `
                SELECT cj.*,
                       c.name as client_name, c.phone as client_phone,
                       u.name as worker_name,
                       p.property_name, p.address_line1, p.city, p.postal_code
                FROM cleaning_jobs cj
                JOIN clients c ON cj.client_id = c.id
                JOIN properties p ON cj.property_id = p.id
                LEFT JOIN users u ON cj.assigned_worker_id = u.id
                ORDER BY cj.scheduled_date ${order}, cj.scheduled_time ${order}
                LIMIT $1 OFFSET $2
            `;
            params = [limit, offset];
        } else if (req.session.userType === 'worker') {
            // Workers see only assigned jobs
            countQuery = 'SELECT COUNT(*) FROM cleaning_jobs WHERE assigned_worker_id = $1';
            countParams = [req.session.userId];
            query = `
                SELECT cj.*,
                       c.name as client_name, c.phone as client_phone,
                       p.property_name, p.address_line1, p.city, p.postal_code
                FROM cleaning_jobs cj
                JOIN clients c ON cj.client_id = c.id
                JOIN properties p ON cj.property_id = p.id
                WHERE cj.assigned_worker_id = $1
                ORDER BY cj.scheduled_date ${order}, cj.scheduled_time ${order}
                LIMIT $2 OFFSET $3
            `;
            params = [req.session.userId, limit, offset];
        } else if (req.session.userType === 'client') {
            // Clients see only their jobs
            countQuery = 'SELECT COUNT(*) FROM cleaning_jobs WHERE client_id = $1';
            countParams = [req.session.clientId];
            query = `
                SELECT cj.*,
                       u.name as worker_name,
                       p.property_name, p.address_line1, p.city, p.postal_code
                FROM cleaning_jobs cj
                JOIN properties p ON cj.property_id = p.id
                LEFT JOIN users u ON cj.assigned_worker_id = u.id
                WHERE cj.client_id = $1
                ORDER BY cj.scheduled_date ${order}, cj.scheduled_time ${order}
                LIMIT $2 OFFSET $3
            `;
            params = [req.session.clientId, limit, offset];
        } else {
            return errorResponse(res, 403, 'Access denied', 'FORBIDDEN', req);
        }

        const [result, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        console.log(`✅ Cleaning jobs fetched [${req.correlationId}]: ${result.rows.length} of ${countResult.rows[0].count}`);

        return listResponse(res, result.rows, {
            total: parseInt(countResult.rows[0].count),
            limit,
            offset
        }, req);
    } catch (error) {
        console.error(`❌ Error fetching cleaning jobs [${req.correlationId}]:`, error.message);
        return errorResponse(res, 500, 'Server error', 'SERVER_ERROR', req);
    }
});

// ==============================================
// GET SINGLE CLEANING JOB WITH PHOTOS (with pagination support)
// ==============================================
router.get('/:id', requireAuth, async (req, res) => {
    console.log(`🔵 GET /api/cleaning-jobs/${req.params.id} [${req.correlationId}] - User: ${req.session.userType}`);

    try {
        const jobResult = await pool.query(
            `SELECT cj.*,
                    c.name as client_name, c.phone as client_phone, c.email as client_email,
                    u.name as worker_name,
                    p.property_name, p.address_line1, p.address_line2, p.city, p.postal_code, p.district,
                    pt.type_name as property_type
             FROM cleaning_jobs cj
             JOIN clients c ON cj.client_id = c.id
             JOIN properties p ON cj.property_id = p.id
             LEFT JOIN property_types pt ON p.property_type_id = pt.id
             LEFT JOIN users u ON cj.assigned_worker_id = u.id
             WHERE cj.id = $1`,
            [req.params.id]
        );

        if (jobResult.rows.length === 0) {
            console.log(`❌ Job not found: ${req.params.id} [${req.correlationId}]`);
            return errorResponse(res, 404, 'Job not found', 'JOB_NOT_FOUND', req);
        }

        const job = jobResult.rows[0];

        // Check permissions
        if (req.session.userType === 'worker' && job.assigned_worker_id !== req.session.userId) {
            console.log(`🚫 Worker ${req.session.userId} attempted to access unassigned job ${req.params.id} [${req.correlationId}]`);
            return errorResponse(res, 403, 'You can only view your assigned jobs', 'NOT_ASSIGNED', req);
        }
        if (req.session.userType === 'client' && job.client_id !== req.session.clientId) {
            console.log(`🚫 Client ${req.session.clientId} attempted to access another client's job ${req.params.id} [${req.correlationId}]`);
            return errorResponse(res, 403, 'You can only view your own jobs', 'NOT_YOUR_JOB', req);
        }

        // Get photos with pagination support for large sets
        const photoLimit = parseInt(req.query.photoLimit) || 100; // Default 100 photos per request
        const photoOffset = parseInt(req.query.photoOffset) || 0;

        const [photosResult, photoCountResult] = await Promise.all([
            pool.query(
                `SELECT p.*, u.name as uploaded_by_name
                 FROM cleaning_job_photos p
                 LEFT JOIN users u ON p.worker_id = u.id
                 WHERE p.cleaning_job_id = $1
                 ORDER BY p.uploaded_at DESC
                 LIMIT $2 OFFSET $3`,
                [req.params.id, photoLimit, photoOffset]
            ),
            pool.query(
                `SELECT COUNT(*) FROM cleaning_job_photos WHERE cleaning_job_id = $1`,
                [req.params.id]
            )
        ]);

        // Get time logs
        const timeLogsResult = await pool.query(
            `SELECT tl.*, u.name as worker_name
             FROM cleaning_time_logs tl
             JOIN users u ON tl.worker_id = u.id
             WHERE tl.cleaning_job_id = $1
             ORDER BY tl.start_time DESC`,
            [req.params.id]
        );

        // If client is viewing, mark photos as viewed
        if (req.session.userType === 'client') {
            await pool.query(
                `UPDATE cleaning_job_photos
                 SET viewed_by_client = TRUE, viewed_at = CURRENT_TIMESTAMP
                 WHERE cleaning_job_id = $1 AND viewed_by_client = FALSE`,
                [req.params.id]
            );
            await pool.query(
                `UPDATE cleaning_jobs SET client_viewed_photos = TRUE WHERE id = $1`,
                [req.params.id]
            );
            console.log(`📸 Client viewed ${photosResult.rows.length} photos for job ${req.params.id} [${req.correlationId}]`);
        }

        const totalPhotos = parseInt(photoCountResult.rows[0].count);
        console.log(`✅ Fetched job ${req.params.id} with ${photosResult.rows.length} of ${totalPhotos} photos [${req.correlationId}]`);

        return successResponse(res, {
            job: job,
            photos: photosResult.rows,
            timeLogs: timeLogsResult.rows,
            photosPagination: {
                total: totalPhotos,
                limit: photoLimit,
                offset: photoOffset,
                hasMore: (photoOffset + photoLimit) < totalPhotos
            }
        }, 200, req);
    } catch (error) {
        console.error(`❌ Error fetching job [${req.correlationId}]:`, error.message);
        return errorResponse(res, 500, 'Server error', 'SERVER_ERROR', req);
    }
});

// ==============================================
// GET CLEANING JOB WITH FULL DETAILS (photos + time logs + payments)
// ==============================================
router.get('/:id/full', requireAuth, async (req, res) => {
    try {
        const jobResult = await pool.query(
            `SELECT cj.*,
                    c.name as client_name, c.phone as client_phone, c.email as client_email,
                    u.name as worker_name,
                    creator.name as created_by_name,
                    p.property_name, p.address_line1, p.address_line2, p.city, p.postal_code, p.district,
                    pt.type_name as property_type
             FROM cleaning_jobs cj
             JOIN clients c ON cj.client_id = c.id
             JOIN properties p ON cj.property_id = p.id
             LEFT JOIN property_types pt ON p.property_type_id = pt.id
             LEFT JOIN users u ON cj.assigned_worker_id = u.id
             LEFT JOIN users creator ON cj.created_by = creator.id
             WHERE cj.id = $1`,
            [req.params.id]
        );

        if (jobResult.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const job = jobResult.rows[0];

        // Check permissions
        if (req.session.userType === 'worker' && job.assigned_worker_id !== req.session.userId) {
            return res.status(403).json({ error: 'Not your assigned job' });
        }
        if (req.session.userType === 'client' && job.client_id !== req.session.clientId) {
            return res.status(403).json({ error: 'Not your job' });
        }

        // Get photos
        const photosResult = await pool.query(
            `SELECT p.*, u.name as uploaded_by_name
             FROM cleaning_job_photos p
             LEFT JOIN users u ON p.worker_id = u.id
             WHERE p.cleaning_job_id = $1
             ORDER BY p.uploaded_at DESC`,
            [req.params.id]
        );

        // Get time logs
        const timeLogsResult = await pool.query(
            `SELECT tl.*, u.name as worker_name
             FROM cleaning_time_logs tl
             JOIN users u ON tl.worker_id = u.id
             WHERE tl.cleaning_job_id = $1
             ORDER BY tl.start_time DESC`,
            [req.params.id]
        );

        // Get payments for this job
        const paymentsResult = await pool.query(
            `SELECT p.*, u.name as recorded_by_name
             FROM payments p
             LEFT JOIN users u ON u.id = (p.notes::jsonb->>'recorded_by_user_id')::integer
             WHERE p.order_type = 'airbnb' AND p.order_id = $1
             ORDER BY p.payment_date DESC`,
            [req.params.id]
        );

        // If client is viewing, mark photos as viewed
        if (req.session.userType === 'client') {
            await pool.query(
                `UPDATE cleaning_job_photos
                 SET viewed_by_client = TRUE, viewed_at = CURRENT_TIMESTAMP
                 WHERE cleaning_job_id = $1 AND viewed_by_client = FALSE`,
                [req.params.id]
            );
            await pool.query(
                `UPDATE cleaning_jobs SET client_viewed_photos = TRUE WHERE id = $1`,
                [req.params.id]
            );
        }

        res.json({
            job: job,
            photos: photosResult.rows,
            timeLogs: timeLogsResult.rows,
            payments: paymentsResult.rows
        });
    } catch (error) {
        console.error('Error fetching full job details:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// CREATE CLEANING JOB (Master/Admin only) - V2 with property_id
// ==============================================
router.post('/', requireMasterOrAdmin, async (req, res) => {
    const {
        client_id, property_id, job_type, scheduled_date, scheduled_time,
        assigned_worker_ids, estimated_hours, hourly_rate, special_instructions, notes
    } = req.body;

    console.log('🧹 [CLEANING JOB] Creating new cleaning job (V2)...');
    console.log('📋 [CLEANING JOB] Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 [CLEANING JOB] User session:', { userId: req.session.userId, userType: req.session.userType });

    try {
        // Validate required fields
        if (!client_id || !property_id || !job_type || !scheduled_date || !scheduled_time) {
            return res.status(400).json({
                error: 'Missing required fields: client_id, property_id, job_type, scheduled_date, scheduled_time'
            });
        }

        // Verify property belongs to client
        const propertyCheck = await pool.query(
            'SELECT id FROM properties WHERE id = $1 AND client_id = $2',
            [property_id, client_id]
        );

        if (propertyCheck.rows.length === 0) {
            console.log(`❌ [CLEANING JOB] Property ${property_id} does not belong to client ${client_id}`);
            return res.status(400).json({ error: 'Property does not belong to client' });
        }

        // Parse worker IDs (can be array or single value)
        let workerIds = [];
        if (assigned_worker_ids) {
            if (Array.isArray(assigned_worker_ids)) {
                workerIds = assigned_worker_ids;
            } else if (typeof assigned_worker_ids === 'string') {
                workerIds = assigned_worker_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            } else {
                workerIds = [parseInt(assigned_worker_ids)];
            }
        }

        console.log('👥 [CLEANING JOB] Parsed worker IDs:', workerIds);

        // Use first worker as primary assigned worker (backward compatibility)
        const primary_worker_id = workerIds.length > 0 ? workerIds[0] : null;

        const result = await pool.query(
            `INSERT INTO cleaning_jobs (
                client_id, property_id, job_type, scheduled_date, scheduled_time,
                assigned_worker_id, estimated_hours, hourly_rate,
                special_instructions, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                client_id, property_id, job_type, scheduled_date, scheduled_time,
                primary_worker_id, estimated_hours, hourly_rate || 15.00,
                special_instructions, notes, req.session.userId
            ]
        );

        const jobId = result.rows[0].id;
        console.log('✅ [CLEANING JOB] Job created successfully:', result.rows[0]);

        // Insert all workers into cleaning_job_workers table
        if (workerIds.length > 0) {
            for (let i = 0; i < workerIds.length; i++) {
                const workerId = workerIds[i];
                const isPrimary = i === 0; // First worker is primary
                await pool.query(
                    `INSERT INTO cleaning_job_workers (cleaning_job_id, worker_id, is_primary)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (cleaning_job_id, worker_id) DO NOTHING`,
                    [jobId, workerId, isPrimary]
                );
                console.log(`👤 [CLEANING JOB] Assigned worker ${workerId} to job ${jobId} (primary: ${isPrimary})`);
            }
        }

        // Fetch job with property details for response
        const fullJobResult = await pool.query(
            `SELECT cj.*,
                    c.name as client_name,
                    p.property_name, p.address_line1, p.city,
                    u.name as worker_name
             FROM cleaning_jobs cj
             JOIN clients c ON cj.client_id = c.id
             JOIN properties p ON cj.property_id = p.id
             LEFT JOIN users u ON cj.assigned_worker_id = u.id
             WHERE cj.id = $1`,
            [jobId]
        );

        res.status(201).json(fullJobResult.rows[0]);
    } catch (error) {
        console.error('💥 [CLEANING JOB] Error creating cleaning job:', error);
        console.error('💥 [CLEANING JOB] Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            stack: error.stack
        });
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// ==============================================
// UPDATE CLEANING JOB (Master/Admin only) - V2 with property_id
// ==============================================
router.put('/:id', requireMasterOrAdmin, async (req, res) => {
    const {
        client_id, property_id, job_type, scheduled_date, scheduled_time, assigned_worker_id,
        hourly_rate, estimated_hours, status, payment_status, special_instructions, notes
    } = req.body;

    try {
        // Get current job data
        const currentJob = await pool.query('SELECT * FROM cleaning_jobs WHERE id = $1', [req.params.id]);

        if (currentJob.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const current = currentJob.rows[0];

        // Use provided values or fall back to current values
        const updatedClientId = client_id !== undefined ? client_id : current.client_id;
        const updatedPropertyId = property_id !== undefined ? property_id : current.property_id;
        const updatedJobType = job_type !== undefined ? job_type : current.job_type;
        const updatedScheduledDate = scheduled_date !== undefined ? scheduled_date : current.scheduled_date;
        const updatedScheduledTime = scheduled_time !== undefined ? scheduled_time : current.scheduled_time;
        const updatedAssignedWorkerId = assigned_worker_id !== undefined ? assigned_worker_id : current.assigned_worker_id;
        const updatedHourlyRate = hourly_rate !== undefined ? hourly_rate : current.hourly_rate;
        const updatedEstimatedHours = estimated_hours !== undefined ? estimated_hours : current.estimated_hours;
        const updatedStatus = status !== undefined ? status : current.status;
        const updatedPaymentStatus = payment_status !== undefined ? payment_status : current.payment_status;
        const updatedSpecialInstructions = special_instructions !== undefined ? special_instructions : current.special_instructions;
        const updatedNotes = notes !== undefined ? notes : current.notes;

        // If property_id is being changed, verify it belongs to the client
        if (property_id !== undefined && property_id !== current.property_id) {
            const propertyCheck = await pool.query(
                'SELECT id FROM properties WHERE id = $1 AND client_id = $2',
                [updatedPropertyId, updatedClientId]
            );

            if (propertyCheck.rows.length === 0) {
                return res.status(400).json({ error: 'Property does not belong to client' });
            }
        }

        const result = await pool.query(
            `UPDATE cleaning_jobs SET
                client_id = $1, property_id = $2, job_type = $3,
                scheduled_date = $4, scheduled_time = $5, assigned_worker_id = $6,
                hourly_rate = $7, estimated_hours = $8, status = $9, payment_status = $10,
                special_instructions = $11, notes = $12, updated_at = CURRENT_TIMESTAMP
             WHERE id = $13
             RETURNING *`,
            [
                updatedClientId, updatedPropertyId, updatedJobType,
                updatedScheduledDate, updatedScheduledTime, updatedAssignedWorkerId,
                updatedHourlyRate, updatedEstimatedHours, updatedStatus, updatedPaymentStatus,
                updatedSpecialInstructions, updatedNotes,
                req.params.id
            ]
        );

        // Fetch updated job with property details for response
        const fullJobResult = await pool.query(
            `SELECT cj.*,
                    c.name as client_name,
                    p.property_name, p.address_line1, p.city,
                    u.name as worker_name
             FROM cleaning_jobs cj
             JOIN clients c ON cj.client_id = c.id
             JOIN properties p ON cj.property_id = p.id
             LEFT JOIN users u ON cj.assigned_worker_id = u.id
             WHERE cj.id = $1`,
            [req.params.id]
        );

        res.json(fullJobResult.rows[0]);
    } catch (error) {
        console.error('Error updating job:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// START JOB (Worker)
// ==============================================
router.post('/:id/start', requireStaff, async (req, res) => {
    try {
        // Check if job exists and is assigned to this worker
        const jobCheck = await pool.query(
            'SELECT * FROM cleaning_jobs WHERE id = $1',
            [req.params.id]
        );

        if (jobCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const job = jobCheck.rows[0];

        // Workers can only start their own jobs
        if (req.session.userType === 'worker' && job.assigned_worker_id !== req.session.userId) {
            return res.status(403).json({ error: 'Not your assigned job' });
        }

        // Check if job is already started
        if (job.status === 'in_progress') {
            return res.status(400).json({ error: 'Job already started' });
        }

        // Start the job
        const result = await pool.query(
            `UPDATE cleaning_jobs
             SET status = 'in_progress', actual_start_time = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [req.params.id]
        );

        // Create time log entry
        const { start_latitude, start_longitude } = req.body;
        await pool.query(
            `INSERT INTO cleaning_time_logs (
                cleaning_job_id, worker_id, start_time, start_latitude, start_longitude
            ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)`,
            [req.params.id, req.session.userId, start_latitude, start_longitude]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error starting job:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// END JOB (Worker)
// ==============================================
router.post('/:id/end', requireStaff, async (req, res) => {
    try {
        const jobCheck = await pool.query(
            'SELECT * FROM cleaning_jobs WHERE id = $1',
            [req.params.id]
        );

        if (jobCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const job = jobCheck.rows[0];

        if (req.session.userType === 'worker' && job.assigned_worker_id !== req.session.userId) {
            return res.status(403).json({ error: 'Not your assigned job' });
        }

        if (job.status !== 'in_progress') {
            return res.status(400).json({ error: 'Job is not in progress' });
        }

        // End the job (triggers will calculate duration and cost)
        const result = await pool.query(
            `UPDATE cleaning_jobs
             SET status = 'completed', actual_end_time = CURRENT_TIMESTAMP,
                 completed_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [req.params.id]
        );

        // Update time log
        const { end_latitude, end_longitude, notes } = req.body;
        await pool.query(
            `UPDATE cleaning_time_logs
             SET end_time = CURRENT_TIMESTAMP,
                 duration_minutes = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time)) / 60,
                 end_latitude = $1, end_longitude = $2, notes = $3
             WHERE cleaning_job_id = $4 AND worker_id = $5 AND end_time IS NULL`,
            [end_latitude, end_longitude, notes, req.params.id, req.session.userId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error ending job:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// UPLOAD PHOTOS (Worker) - Batch upload up to 10 files
// ==============================================
router.post('/:id/photos', requireStaff, upload.array('photos', 10), async (req, res) => {
    console.log(`📸 POST /api/cleaning-jobs/${req.params.id}/photos [${req.correlationId}] - User: ${req.session.userType}`);

    try {
        // Validate files were uploaded
        if (!req.files || req.files.length === 0) {
            console.log(`❌ No photos uploaded [${req.correlationId}]`);
            return errorResponse(res, 400, 'No photos uploaded', 'NO_FILES', req);
        }

        // Enforce batch limit of 10 files per request
        if (req.files.length > 10) {
            console.log(`❌ Too many files in batch: ${req.files.length} [${req.correlationId}]`);
            return errorResponse(res, 400, 'Maximum 10 photos per upload batch', 'BATCH_LIMIT_EXCEEDED', req);
        }

        // Verify job exists
        const jobCheck = await pool.query(
            'SELECT * FROM cleaning_jobs WHERE id = $1',
            [req.params.id]
        );

        if (jobCheck.rows.length === 0) {
            console.log(`❌ Job not found: ${req.params.id} [${req.correlationId}]`);
            return errorResponse(res, 404, 'Job not found', 'JOB_NOT_FOUND', req);
        }

        const job = jobCheck.rows[0];

        // Workers can only upload to their assigned jobs
        if (req.session.userType === 'worker' && job.assigned_worker_id !== req.session.userId) {
            console.log(`🚫 Worker ${req.session.userId} attempted to upload to unassigned job ${req.params.id} [${req.correlationId}]`);
            return errorResponse(res, 403, 'You can only upload photos to your assigned jobs', 'NOT_ASSIGNED', req);
        }

        const { photo_type, room_area, caption } = req.body;
        const uploadedPhotos = [];

        // Insert each photo into database
        for (const file of req.files) {
            const result = await pool.query(
                `INSERT INTO cleaning_job_photos (
                    cleaning_job_id, worker_id, photo_url, photo_type,
                    room_area, caption, original_filename, file_size_kb
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *`,
                [
                    req.params.id,
                    req.session.userId,
                    '/uploads/cleaning_photos/' + file.filename,
                    photo_type || 'detail',
                    room_area,
                    caption,
                    file.originalname,
                    Math.round(file.size / 1024)
                ]
            );
            uploadedPhotos.push(result.rows[0]);
        }

        console.log(`✅ Uploaded ${uploadedPhotos.length} photos to job ${req.params.id} [${req.correlationId}]`);

        return successResponse(res, {
            photos: uploadedPhotos,
            count: uploadedPhotos.length,
            message: `Successfully uploaded ${uploadedPhotos.length} photo(s)`
        }, 201, req);
    } catch (error) {
        console.error(`❌ Error uploading photos [${req.correlationId}]:`, error.message);
        return errorResponse(res, 500, 'Photo upload failed', 'UPLOAD_ERROR', req);
    }
});

// ==============================================
// DELETE JOB (Master/Admin only)
// ==============================================
router.delete('/:id', requireMasterOrAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM cleaning_jobs WHERE id = $1 RETURNING id',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json({ success: true, message: 'Job deleted' });
    } catch (error) {
        console.error('Error deleting job:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

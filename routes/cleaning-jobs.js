const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { pool } = require('../config/database');
const { requireStaff, requireMasterOrAdmin } = require('../middleware/permissions');

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
    try {
        let query, params;

        if (req.session.userType === 'master' || req.session.userType === 'admin') {
            // Master/Admin see all jobs
            query = `
                SELECT cj.*,
                       c.full_name as client_name, c.phone as client_phone,
                       u.full_name as worker_name
                FROM cleaning_jobs cj
                JOIN clients c ON cj.client_id = c.id
                LEFT JOIN users u ON cj.assigned_worker_id = u.id
                ORDER BY cj.scheduled_date DESC, cj.scheduled_time DESC
            `;
            params = [];
        } else if (req.session.userType === 'worker') {
            // Workers see only assigned jobs
            query = `
                SELECT cj.*,
                       c.full_name as client_name, c.phone as client_phone
                FROM cleaning_jobs cj
                JOIN clients c ON cj.client_id = c.id
                WHERE cj.assigned_worker_id = $1
                ORDER BY cj.scheduled_date DESC, cj.scheduled_time DESC
            `;
            params = [req.session.userId];
        } else if (req.session.userType === 'client') {
            // Clients see only their jobs
            query = `
                SELECT cj.*,
                       u.full_name as worker_name
                FROM cleaning_jobs cj
                LEFT JOIN users u ON cj.assigned_worker_id = u.id
                WHERE cj.client_id = $1
                ORDER BY cj.scheduled_date DESC, cj.scheduled_time DESC
            `;
            params = [req.session.clientId];
        } else {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching cleaning jobs:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// GET SINGLE CLEANING JOB WITH PHOTOS
// ==============================================
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const jobResult = await pool.query(
            `SELECT cj.*,
                    c.full_name as client_name, c.phone as client_phone, c.email as client_email,
                    u.full_name as worker_name
             FROM cleaning_jobs cj
             JOIN clients c ON cj.client_id = c.id
             LEFT JOIN users u ON cj.assigned_worker_id = u.id
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
            `SELECT p.*, u.full_name as uploaded_by_name
             FROM cleaning_job_photos p
             LEFT JOIN users u ON p.worker_id = u.id
             WHERE p.cleaning_job_id = $1
             ORDER BY p.uploaded_at DESC`,
            [req.params.id]
        );

        // Get time logs
        const timeLogsResult = await pool.query(
            `SELECT tl.*, u.full_name as worker_name
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
        }

        res.json({
            job: job,
            photos: photosResult.rows,
            timeLogs: timeLogsResult.rows
        });
    } catch (error) {
        console.error('Error fetching job:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// GET CLEANING JOB WITH FULL DETAILS (photos + time logs + payments)
// ==============================================
router.get('/:id/full', requireAuth, async (req, res) => {
    try {
        const jobResult = await pool.query(
            `SELECT cj.*,
                    c.full_name as client_name, c.phone as client_phone, c.email as client_email,
                    c.address as client_address,
                    u.full_name as worker_name,
                    creator.full_name as created_by_name
             FROM cleaning_jobs cj
             JOIN clients c ON cj.client_id = c.id
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
            `SELECT p.*, u.full_name as uploaded_by_name
             FROM cleaning_job_photos p
             LEFT JOIN users u ON p.worker_id = u.id
             WHERE p.cleaning_job_id = $1
             ORDER BY p.uploaded_at DESC`,
            [req.params.id]
        );

        // Get time logs
        const timeLogsResult = await pool.query(
            `SELECT tl.*, u.full_name as worker_name
             FROM cleaning_time_logs tl
             JOIN users u ON tl.worker_id = u.id
             WHERE tl.cleaning_job_id = $1
             ORDER BY tl.start_time DESC`,
            [req.params.id]
        );

        // Get payments for this job
        const paymentsResult = await pool.query(
            `SELECT p.*, u.full_name as recorded_by_name
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
// CREATE CLEANING JOB (Master/Admin only)
// ==============================================
router.post('/', requireMasterOrAdmin, async (req, res) => {
    const {
        client_id, job_type, property_name, address_line1, address_line2,
        city, postal_code, scheduled_date, scheduled_time, assigned_worker_id,
        hourly_rate, special_instructions, notes
    } = req.body;

    try {
        // Build full property address
        const property_address = property_name
            ? `${property_name}, ${address_line1}`
            : address_line1;

        const result = await pool.query(
            `INSERT INTO cleaning_jobs (
                client_id, job_type, property_name, property_address,
                address_line1, address_line2, city, postal_code,
                scheduled_date, scheduled_time, assigned_worker_id,
                hourly_rate, special_instructions, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *`,
            [
                client_id, job_type, property_name, property_address,
                address_line1, address_line2, city, postal_code,
                scheduled_date, scheduled_time, assigned_worker_id,
                hourly_rate || 15.00, special_instructions, notes, req.session.userId
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating cleaning job:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// UPDATE CLEANING JOB (Master/Admin only)
// ==============================================
router.put('/:id', requireMasterOrAdmin, async (req, res) => {
    const {
        client_id, job_type, property_name, address_line1, address_line2,
        city, postal_code, scheduled_date, scheduled_time, assigned_worker_id,
        hourly_rate, status, payment_status, special_instructions, notes
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
        const updatedJobType = job_type !== undefined ? job_type : current.job_type;
        const updatedPropertyName = property_name !== undefined ? property_name : current.property_name;
        const updatedAddressLine1 = address_line1 !== undefined ? address_line1 : current.address_line1;
        const updatedAddressLine2 = address_line2 !== undefined ? address_line2 : current.address_line2;
        const updatedCity = city !== undefined ? city : current.city;
        const updatedPostalCode = postal_code !== undefined ? postal_code : current.postal_code;
        const updatedScheduledDate = scheduled_date !== undefined ? scheduled_date : current.scheduled_date;
        const updatedScheduledTime = scheduled_time !== undefined ? scheduled_time : current.scheduled_time;
        const updatedAssignedWorkerId = assigned_worker_id !== undefined ? assigned_worker_id : current.assigned_worker_id;
        const updatedHourlyRate = hourly_rate !== undefined ? hourly_rate : current.hourly_rate;
        const updatedStatus = status !== undefined ? status : current.status;
        const updatedPaymentStatus = payment_status !== undefined ? payment_status : current.payment_status;
        const updatedSpecialInstructions = special_instructions !== undefined ? special_instructions : current.special_instructions;
        const updatedNotes = notes !== undefined ? notes : current.notes;

        const property_address = updatedPropertyName
            ? `${updatedPropertyName}, ${updatedAddressLine1}`
            : updatedAddressLine1;

        const result = await pool.query(
            `UPDATE cleaning_jobs SET
                client_id = $1, job_type = $2, property_name = $3, property_address = $4,
                address_line1 = $5, address_line2 = $6, city = $7, postal_code = $8,
                scheduled_date = $9, scheduled_time = $10, assigned_worker_id = $11,
                hourly_rate = $12, status = $13, payment_status = $14,
                special_instructions = $15, notes = $16
             WHERE id = $17
             RETURNING *`,
            [
                updatedClientId, updatedJobType, updatedPropertyName, property_address,
                updatedAddressLine1, updatedAddressLine2, updatedCity, updatedPostalCode,
                updatedScheduledDate, updatedScheduledTime, updatedAssignedWorkerId,
                updatedHourlyRate, updatedStatus, updatedPaymentStatus,
                updatedSpecialInstructions, updatedNotes,
                req.params.id
            ]
        );

        res.json(result.rows[0]);
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
// UPLOAD PHOTOS (Worker)
// ==============================================
router.post('/:id/photos', requireStaff, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No photo uploaded' });
        }

        const { photo_type, room_area, caption } = req.body;

        const result = await pool.query(
            `INSERT INTO cleaning_job_photos (
                cleaning_job_id, worker_id, photo_url, photo_type,
                room_area, caption, original_filename, file_size_kb
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                req.params.id,
                req.session.userId,
                '/uploads/cleaning_photos/' + req.file.filename,
                photo_type || 'detail',
                room_area,
                caption,
                req.file.originalname,
                Math.round(req.file.size / 1024)
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error uploading photo:', error);
        res.status(500).json({ error: 'Server error' });
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

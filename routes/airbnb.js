const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/cleaning_photos');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userType) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

const requireAdmin = (req, res, next) => {
    if (req.session.userType !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

const requireWorkerOrAdmin = (req, res, next) => {
    if (req.session.userType !== 'admin' && req.session.userType !== 'worker' && req.session.userType !== 'master') {
        return res.status(403).json({ error: 'Worker or admin access required' });
    }
    next();
};

// Get all airbnb orders
router.get('/', requireAuth, async (req, res) => {
    try {
        let query, params;

        if (req.session.userType === 'master' || req.session.userType === 'admin') {
            query = `
                SELECT ao.*, c.full_name as client_name, c.phone as client_phone,
                       u.full_name as cleaner_name
                FROM airbnb_orders ao
                JOIN clients c ON ao.client_id = c.id
                LEFT JOIN users u ON ao.assigned_cleaner_id = u.id
                ORDER BY ao.scheduled_date DESC, ao.scheduled_time DESC
            `;
            params = [];
        } else if (req.session.userType === 'client') {
            query = `
                SELECT ao.*, u.full_name as cleaner_name
                FROM airbnb_orders ao
                LEFT JOIN users u ON ao.assigned_cleaner_id = u.id
                WHERE ao.client_id = $1
                ORDER BY ao.scheduled_date DESC
            `;
            params = [req.session.clientId];
        } else if (req.session.userType === 'worker') {
            query = `
                SELECT ao.*, c.full_name as client_name, c.phone as client_phone
                FROM airbnb_orders ao
                JOIN clients c ON ao.client_id = c.id
                WHERE ao.assigned_cleaner_id = $1
                ORDER BY ao.scheduled_date DESC
            `;
            params = [req.session.userId];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching airbnb orders:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single order with photos
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const orderResult = await pool.query(
            `SELECT ao.*, c.full_name as client_name, c.phone as client_phone,
                    u.full_name as cleaner_name
             FROM airbnb_orders ao
             JOIN clients c ON ao.client_id = c.id
             LEFT JOIN users u ON ao.assigned_cleaner_id = u.id
             WHERE ao.id = $1`,
            [req.params.id]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const photosResult = await pool.query(
            'SELECT * FROM cleaning_photos WHERE airbnb_order_id = $1 ORDER BY uploaded_at DESC',
            [req.params.id]
        );

        const timeLogsResult = await pool.query(
            `SELECT tl.*, u.full_name as cleaner_name
             FROM time_logs tl
             JOIN users u ON tl.cleaner_id = u.id
             WHERE tl.airbnb_order_id = $1
             ORDER BY tl.start_time DESC`,
            [req.params.id]
        );

        res.json({
            order: orderResult.rows[0],
            photos: photosResult.rows,
            timeLogs: timeLogsResult.rows
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create airbnb order (Admin only)
router.post('/', requireAdmin, async (req, res) => {
    const { client_id, property_name, property_address, scheduled_date, scheduled_time, assigned_cleaner_id, price, notes } = req.body;

    try {
        const orderNumber = 'A' + Date.now();

        const result = await pool.query(
            `INSERT INTO airbnb_orders
             (client_id, order_number, property_name, property_address, scheduled_date, scheduled_time, assigned_cleaner_id, price, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [client_id, orderNumber, property_name, property_address, scheduled_date, scheduled_time, assigned_cleaner_id, price, notes]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating airbnb order:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update airbnb order
router.put('/:id', requireWorkerOrAdmin, async (req, res) => {
    const { status, completed_date, price, paid, notes } = req.body;

    try {
        const result = await pool.query(
            `UPDATE airbnb_orders
             SET status = $1, completed_date = $2, price = $3, paid = $4, notes = $5
             WHERE id = $6
             RETURNING *`,
            [status, completed_date, price, paid, notes, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating airbnb order:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Upload photos (Cleaner or Admin)
router.post('/:id/photos', requireWorkerOrAdmin, upload.array('photos', 10), async (req, res) => {
    try {
        const orderId = req.params.id;
        const photoType = req.body.photo_type || 'after';
        const notes = req.body.notes || '';
        const uploadedBy = req.session.userId;

        const uploadedPhotos = [];

        for (const file of req.files) {
            const photoPath = '/uploads/cleaning_photos/' + file.filename;

            const result = await pool.query(
                `INSERT INTO cleaning_photos (airbnb_order_id, photo_path, photo_type, uploaded_by, notes)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [orderId, photoPath, photoType, uploadedBy, notes]
            );

            uploadedPhotos.push(result.rows[0]);
        }

        res.status(201).json(uploadedPhotos);
    } catch (error) {
        console.error('Error uploading photos:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Start time log (Cleaner)
router.post('/:id/time/start', requireWorkerOrAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `INSERT INTO time_logs (airbnb_order_id, cleaner_id, start_time)
             VALUES ($1, $2, NOW())
             RETURNING *`,
            [req.params.id, req.session.userId]
        );

        // Update order status to in_progress
        await pool.query(
            `UPDATE airbnb_orders SET status = 'in_progress' WHERE id = $1`,
            [req.params.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error starting time log:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// End time log (Cleaner)
router.put('/time/:timeLogId/end', requireWorkerOrAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE time_logs
             SET end_time = NOW(),
                 total_hours = EXTRACT(EPOCH FROM (NOW() - start_time)) / 3600
             WHERE id = $1 AND cleaner_id = $2
             RETURNING *`,
            [req.params.timeLogId, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Time log not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error ending time log:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

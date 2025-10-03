const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireMasterOrAdmin, requireStaff } = require('../middleware/permissions');

// Get all services (all staff can view)
router.get('/', requireStaff, async (req, res) => {
    try {
        const { type } = req.query;
        let query = 'SELECT * FROM services WHERE is_active = true';
        const params = [];

        if (type) {
            query += ' AND type = $1';
            params.push(type);
        }

        query += ' ORDER BY type, name';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single service
router.get('/:id', requireStaff, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM services WHERE id = $1', [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create service (Master/Admin only)
router.post('/', requireMasterOrAdmin, async (req, res) => {
    const { name, type, price, unit, duration_minutes, description } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO services (name, type, price, unit, duration_minutes, description)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [name, type, price, unit, duration_minutes, description]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating service:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update service (Master/Admin only)
router.put('/:id', requireMasterOrAdmin, async (req, res) => {
    const { name, type, price, unit, duration_minutes, description, is_active } = req.body;

    try {
        const result = await pool.query(
            `UPDATE services
             SET name = $1, type = $2, price = $3, unit = $4, duration_minutes = $5, description = $6, is_active = $7
             WHERE id = $8
             RETURNING *`,
            [name, type, price, unit, duration_minutes, description, is_active, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete service (Master/Admin only)
router.delete('/:id', requireMasterOrAdmin, async (req, res) => {
    try {
        // Soft delete - mark as inactive
        const result = await pool.query(
            'UPDATE services SET is_active = false WHERE id = $1 RETURNING id',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

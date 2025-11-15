const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

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

// Get all laundry orders (Master/Admin/Worker) or client's orders (Client)
router.get('/', requireAuth, async (req, res) => {
    try {
        let query, params;

        if (req.session.userType === 'master' || req.session.userType === 'admin' || req.session.userType === 'worker') {
            query = `
                SELECT lo.*, c.name as client_name, c.phone as client_phone
                FROM laundry_orders lo
                JOIN clients c ON lo.client_id = c.id
                ORDER BY lo.created_at DESC
            `;
            params = [];
        } else if (req.session.userType === 'client') {
            query = `
                SELECT * FROM laundry_orders
                WHERE client_id = $1
                ORDER BY created_at DESC
            `;
            params = [req.session.clientId];
        } else {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching laundry orders:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create laundry order (Admin only)
router.post('/', requireAdmin, async (req, res) => {
    const { client_id, service_type, quantity, unit, price, drop_off_date, pickup_date, notes } = req.body;

    try {
        // Generate order number
        const orderNumber = 'L' + Date.now();

        const result = await pool.query(
            `INSERT INTO laundry_orders
             (client_id, order_number, service_type, quantity, unit, price, drop_off_date, pickup_date, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [client_id, orderNumber, service_type, quantity, unit, price, drop_off_date, pickup_date, notes]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating laundry order:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update laundry order (Admin only)
router.put('/:id', requireAdmin, async (req, res) => {
    const { status, price, pickup_date, paid, notes } = req.body;

    try {
        const result = await pool.query(
            `UPDATE laundry_orders
             SET status = $1, price = $2, pickup_date = $3, paid = $4, notes = $5
             WHERE id = $6
             RETURNING *`,
            [status, price, pickup_date, paid, notes, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating laundry order:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

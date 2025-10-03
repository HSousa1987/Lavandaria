const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireFinanceAccess } = require('../middleware/permissions');

// Get all payments (Master and Admin only, NOT workers)
router.get('/', requireFinanceAccess, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*, c.full_name as client_name, c.phone as client_phone
             FROM payments p
             JOIN clients c ON p.client_id = c.id
             ORDER BY p.payment_date DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Record payment (Master and Admin only)
router.post('/', requireFinanceAccess, async (req, res) => {
    const { client_id, order_type, order_id, amount, payment_method, payment_date, notes } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO payments (client_id, order_type, order_id, amount, payment_method, payment_date, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [client_id, order_type, order_id, amount, payment_method, payment_date, notes]
        );

        // Mark order as paid
        const table = order_type === 'laundry' ? 'laundry_orders' : 'airbnb_orders';
        await pool.query(`UPDATE ${table} SET paid = true WHERE id = $1`, [order_id]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

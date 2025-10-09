const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireFinanceAccess } = require('../middleware/permissions');

// Get dashboard statistics (Master and Admin only - includes finance)
router.get('/stats', requireFinanceAccess, async (req, res) => {
    try {
        // Total clients
        const clientsResult = await pool.query('SELECT COUNT(*) as count FROM clients WHERE is_active = true');
        const totalClients = parseInt(clientsResult.rows[0].count);

        // Total laundry orders
        const laundryResult = await pool.query('SELECT COUNT(*) as count FROM laundry_orders_new');
        const totalLaundryOrders = parseInt(laundryResult.rows[0].count);

        // Total airbnb orders
        const airbnbResult = await pool.query('SELECT COUNT(*) as count FROM cleaning_jobs');
        const totalAirbnbOrders = parseInt(airbnbResult.rows[0].count);

        // Total revenue (sum from both payment tables)
        const revenueResult = await pool.query(`
            SELECT (
                COALESCE((SELECT SUM(amount) FROM payments_cleaning), 0) +
                COALESCE((SELECT SUM(amount) FROM payments_laundry), 0)
            ) as total
        `);
        const totalRevenue = parseFloat(revenueResult.rows[0].total) || 0;

        // Pending payments
        const pendingLaundry = await pool.query('SELECT SUM(total_price) as total FROM laundry_orders_new WHERE payment_status != \'paid\'');
        const pendingAirbnb = await pool.query('SELECT SUM(total_cost) as total FROM cleaning_jobs WHERE payment_status != \'paid\'');
        const pendingPayments = (parseFloat(pendingLaundry.rows[0].total) || 0) + (parseFloat(pendingAirbnb.rows[0].total) || 0);

        // Recent orders
        const recentOrders = await pool.query(`
            (SELECT 'laundry' as type, lo.order_number, c.full_name as client_name, lo.status, lo.created_at
             FROM laundry_orders_new lo
             JOIN clients c ON lo.client_id = c.id
             ORDER BY lo.created_at DESC
             LIMIT 5)
            UNION ALL
            (SELECT 'airbnb' as type, CONCAT('CJ-', cj.id) as order_number, c.full_name as client_name, cj.status, cj.created_at
             FROM cleaning_jobs cj
             JOIN clients c ON cj.client_id = c.id
             ORDER BY cj.created_at DESC
             LIMIT 5)
            ORDER BY created_at DESC
            LIMIT 10
        `);

        res.json({
            totalClients,
            totalLaundryOrders,
            totalAirbnbOrders,
            totalRevenue,
            pendingPayments,
            recentOrders: recentOrders.rows
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

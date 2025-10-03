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
        const laundryResult = await pool.query('SELECT COUNT(*) as count FROM laundry_orders');
        const totalLaundryOrders = parseInt(laundryResult.rows[0].count);

        // Total airbnb orders
        const airbnbResult = await pool.query('SELECT COUNT(*) as count FROM airbnb_orders');
        const totalAirbnbOrders = parseInt(airbnbResult.rows[0].count);

        // Total revenue
        const revenueResult = await pool.query('SELECT SUM(amount) as total FROM payments');
        const totalRevenue = parseFloat(revenueResult.rows[0].total) || 0;

        // Pending payments
        const pendingLaundry = await pool.query('SELECT SUM(price) as total FROM laundry_orders WHERE paid = false');
        const pendingAirbnb = await pool.query('SELECT SUM(price) as total FROM airbnb_orders WHERE paid = false');
        const pendingPayments = (parseFloat(pendingLaundry.rows[0].total) || 0) + (parseFloat(pendingAirbnb.rows[0].total) || 0);

        // Recent orders
        const recentOrders = await pool.query(`
            (SELECT 'laundry' as type, lo.order_number, c.full_name as client_name, lo.status, lo.created_at
             FROM laundry_orders lo
             JOIN clients c ON lo.client_id = c.id
             ORDER BY lo.created_at DESC
             LIMIT 5)
            UNION ALL
            (SELECT 'airbnb' as type, ao.order_number, c.full_name as client_name, ao.status, ao.created_at
             FROM airbnb_orders ao
             JOIN clients c ON ao.client_id = c.id
             ORDER BY ao.created_at DESC
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

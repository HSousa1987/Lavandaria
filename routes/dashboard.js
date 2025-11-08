const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireFinanceAccess } = require('../middleware/permissions');

// Root dashboard endpoint (redirects to stats) - Finance access required
router.get('/', requireFinanceAccess, (req, res) => {
    res.json({
        success: true,
        data: {
            message: 'Dashboard API',
            endpoints: ['/api/dashboard/stats']
        },
        _meta: {
            correlationId: req.correlationId,
            timestamp: new Date().toISOString()
        }
    });
});

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

// ============================================
// DASHBOARD TAX SUMMARY (Current Quarter)
// ============================================
// GET /api/dashboard/tax-summary
router.get('/tax-summary', requireFinanceAccess, async (req, res) => {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // 1-12
        const quarter = Math.ceil(month / 3);

        const startMonth = (quarter - 1) * 3 + 1;
        const endMonth = startMonth + 2;
        const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(endMonth).padStart(2, '0')}-31`;

        // Get current quarter VAT
        const cleaningVAT = await pool.query(`
            SELECT
                SUM(subtotal_before_vat) as subtotal,
                SUM(vat_amount) as vat,
                SUM(total_with_vat) as total
            FROM cleaning_jobs
            WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2
                AND status != 'cancelled'
        `, [startDate, endDate]);

        const laundryVAT = await pool.query(`
            SELECT
                SUM(subtotal_before_vat) as subtotal,
                SUM(vat_amount) as vat,
                SUM(total_with_vat) as total
            FROM laundry_orders_new
            WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2
                AND status != 'cancelled'
        `, [startDate, endDate]);

        const totalSubtotal = (parseFloat(cleaningVAT.rows[0].subtotal) || 0) +
                               (parseFloat(laundryVAT.rows[0].subtotal) || 0);
        const totalVAT = (parseFloat(cleaningVAT.rows[0].vat) || 0) +
                         (parseFloat(laundryVAT.rows[0].vat) || 0);
        const totalWithVAT = (parseFloat(cleaningVAT.rows[0].total) || 0) +
                             (parseFloat(laundryVAT.rows[0].total) || 0);

        res.json({
            success: true,
            data: {
                currentPeriod: {
                    year,
                    quarter,
                    startDate,
                    endDate
                },
                vatSummary: {
                    subtotal: parseFloat(totalSubtotal.toFixed(2)),
                    vat: parseFloat(totalVAT.toFixed(2)),
                    totalWithVAT: parseFloat(totalWithVAT.toFixed(2)),
                    vatRate: 23.00
                },
                breakdown: {
                    cleaning: parseFloat((cleaningVAT.rows[0].vat || 0).toFixed(2)),
                    laundry: parseFloat((laundryVAT.rows[0].vat || 0).toFixed(2))
                }
            },
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error(`[${req.correlationId}] Error fetching tax summary:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tax summary',
            code: 'SERVER_ERROR',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

module.exports = router;

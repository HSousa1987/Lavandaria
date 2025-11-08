const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireFinanceAccess } = require('../middleware/permissions');

// ============================================
// QUARTERLY TAX REPORT
// ============================================
// GET /api/reports/tax/quarterly?year=2025&quarter=1
router.get('/tax/quarterly', requireFinanceAccess, async (req, res) => {
    try {
        const { year, quarter } = req.query;

        if (!year || !quarter) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: year and quarter',
                code: 'INVALID_PARAMETERS',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Validate quarter (1-4)
        if (quarter < 1 || quarter > 4) {
            return res.status(400).json({
                success: false,
                error: 'Quarter must be between 1 and 4',
                code: 'INVALID_QUARTER',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Calculate date range for quarter
        const startMonth = (quarter - 1) * 3 + 1;
        const endMonth = startMonth + 2;
        const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(endMonth).padStart(2, '0')}-31`;

        // Cleaning jobs VAT summary
        const cleaningVAT = await pool.query(`
            SELECT
                COUNT(*) as transaction_count,
                SUM(subtotal_before_vat) as total_subtotal,
                SUM(vat_amount) as total_vat,
                SUM(total_with_vat) as total_with_vat,
                AVG(vat_rate) as avg_vat_rate
            FROM cleaning_jobs
            WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2
                AND status != 'cancelled'
        `, [startDate, endDate]);

        // Laundry orders VAT summary
        const laundryVAT = await pool.query(`
            SELECT
                COUNT(*) as transaction_count,
                SUM(subtotal_before_vat) as total_subtotal,
                SUM(vat_amount) as total_vat,
                SUM(total_with_vat) as total_with_vat,
                AVG(vat_rate) as avg_vat_rate
            FROM laundry_orders_new
            WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2
                AND status != 'cancelled'
        `, [startDate, endDate]);

        const cleaningData = cleaningVAT.rows[0];
        const laundryData = laundryVAT.rows[0];

        // Combined totals
        const totalSubtotal = (parseFloat(cleaningData.total_subtotal) || 0) +
                               (parseFloat(laundryData.total_subtotal) || 0);
        const totalVAT = (parseFloat(cleaningData.total_vat) || 0) +
                         (parseFloat(laundryData.total_vat) || 0);
        const totalWithVAT = (parseFloat(cleaningData.total_with_vat) || 0) +
                             (parseFloat(laundryData.total_with_vat) || 0);

        res.json({
            success: true,
            data: {
                period: {
                    year: parseInt(year),
                    quarter: parseInt(quarter),
                    startDate,
                    endDate
                },
                summary: {
                    totalSubtotal: parseFloat(totalSubtotal.toFixed(2)),
                    totalVAT: parseFloat(totalVAT.toFixed(2)),
                    totalWithVAT: parseFloat(totalWithVAT.toFixed(2)),
                    vatRate: 23.00
                },
                breakdown: {
                    cleaning: {
                        transactionCount: parseInt(cleaningData.transaction_count),
                        subtotal: parseFloat((cleaningData.total_subtotal || 0).toFixed(2)),
                        vat: parseFloat((cleaningData.total_vat || 0).toFixed(2)),
                        totalWithVAT: parseFloat((cleaningData.total_with_vat || 0).toFixed(2))
                    },
                    laundry: {
                        transactionCount: parseInt(laundryData.transaction_count),
                        subtotal: parseFloat((laundryData.total_subtotal || 0).toFixed(2)),
                        vat: parseFloat((laundryData.total_vat || 0).toFixed(2)),
                        totalWithVAT: parseFloat((laundryData.total_with_vat || 0).toFixed(2))
                    }
                }
            },
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error(`[${req.correlationId}] Error fetching quarterly tax report:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate quarterly tax report',
            code: 'SERVER_ERROR',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// ============================================
// ANNUAL TAX REPORT
// ============================================
// GET /api/reports/tax/annual?year=2025
router.get('/tax/annual', requireFinanceAccess, async (req, res) => {
    try {
        const { year } = req.query;

        if (!year) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: year',
                code: 'INVALID_PARAMETERS',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // Get quarterly breakdown
        const quarters = [];
        for (let q = 1; q <= 4; q++) {
            const startMonth = (q - 1) * 3 + 1;
            const endMonth = startMonth + 2;
            const qStartDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
            const qEndDate = `${year}-${String(endMonth).padStart(2, '0')}-31`;

            const cleaningQ = await pool.query(`
                SELECT
                    SUM(subtotal_before_vat) as subtotal,
                    SUM(vat_amount) as vat,
                    SUM(total_with_vat) as total
                FROM cleaning_jobs
                WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2
                    AND status != 'cancelled'
            `, [qStartDate, qEndDate]);

            const laundryQ = await pool.query(`
                SELECT
                    SUM(subtotal_before_vat) as subtotal,
                    SUM(vat_amount) as vat,
                    SUM(total_with_vat) as total
                FROM laundry_orders_new
                WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2
                    AND status != 'cancelled'
            `, [qStartDate, qEndDate]);

            const qTotalSubtotal = (parseFloat(cleaningQ.rows[0].subtotal) || 0) +
                                    (parseFloat(laundryQ.rows[0].subtotal) || 0);
            const qTotalVAT = (parseFloat(cleaningQ.rows[0].vat) || 0) +
                              (parseFloat(laundryQ.rows[0].vat) || 0);
            const qTotalWithVAT = (parseFloat(cleaningQ.rows[0].total) || 0) +
                                   (parseFloat(laundryQ.rows[0].total) || 0);

            quarters.push({
                quarter: q,
                subtotal: parseFloat(qTotalSubtotal.toFixed(2)),
                vat: parseFloat(qTotalVAT.toFixed(2)),
                totalWithVAT: parseFloat(qTotalWithVAT.toFixed(2))
            });
        }

        // Annual totals
        const annualSubtotal = quarters.reduce((sum, q) => sum + q.subtotal, 0);
        const annualVAT = quarters.reduce((sum, q) => sum + q.vat, 0);
        const annualTotal = quarters.reduce((sum, q) => sum + q.totalWithVAT, 0);

        res.json({
            success: true,
            data: {
                year: parseInt(year),
                summary: {
                    totalSubtotal: parseFloat(annualSubtotal.toFixed(2)),
                    totalVAT: parseFloat(annualVAT.toFixed(2)),
                    totalWithVAT: parseFloat(annualTotal.toFixed(2)),
                    vatRate: 23.00
                },
                quarterlyBreakdown: quarters
            },
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error(`[${req.correlationId}] Error fetching annual tax report:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate annual tax report',
            code: 'SERVER_ERROR',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

module.exports = router;

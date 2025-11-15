const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireFinanceAccess } = require('../middleware/permissions');
const { listResponse, validatePagination, errorResponse } = require('../middleware/validation');

// ========================================
// PAYMENT INTEGRITY VALIDATION
// ========================================
// Validates that order_id references an existing order in the correct table
// This prevents orphaned payments until we add proper FK constraints
async function validateOrderExists(order_type, order_id) {
    let table, query;

    if (order_type === 'laundry') {
        // NEW system - laundry_orders_new is canonical
        table = 'laundry_orders_new';
        query = 'SELECT id FROM laundry_orders_new WHERE id = $1';
    } else if (order_type === 'airbnb') {
        // NEW system - cleaning_jobs is canonical
        table = 'cleaning_jobs';
        query = 'SELECT id FROM cleaning_jobs WHERE id = $1';
    } else {
        throw new Error(`Invalid order_type: ${order_type}. Must be 'laundry' or 'airbnb'`);
    }

    const result = await pool.query(query, [order_id]);

    if (result.rows.length === 0) {
        throw new Error(`Order not found: ${order_type} order #${order_id} does not exist in ${table}`);
    }

    return true;
}

// Get all payments (Master and Admin only, NOT workers)
router.get('/', requireFinanceAccess, async (req, res) => {
    console.log(`🔵 GET /api/payments [${req.correlationId}] - User: ${req.session.userType}`);

    try {
        const { limit, offset, sort, order } = validatePagination(req);

        const query = `SELECT p.*, c.name as client_name, c.phone as client_phone
             FROM payments p
             JOIN clients c ON p.client_id = c.id
             ORDER BY p.payment_date ${order}
             LIMIT $1 OFFSET $2`;

        const countQuery = 'SELECT COUNT(*) FROM payments';

        const [result, countResult] = await Promise.all([
            pool.query(query, [limit, offset]),
            pool.query(countQuery)
        ]);

        console.log(`✅ Payments fetched [${req.correlationId}]: ${result.rows.length} of ${countResult.rows[0].count}`);

        return listResponse(res, result.rows, {
            total: parseInt(countResult.rows[0].count),
            limit,
            offset
        }, req);
    } catch (error) {
        console.error(`❌ Error fetching payments [${req.correlationId}]:`, error.message);
        return errorResponse(res, 500, 'Server error', 'SERVER_ERROR', req);
    }
});

// Record payment (Master and Admin only)
router.post('/', requireFinanceAccess, async (req, res) => {
    const requestId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const { client_id, order_type, order_id, amount, payment_method, payment_date, notes } = req.body;

    console.log(`💳 [${requestId}] POST /api/payments - Recording payment for ${order_type} order #${order_id}`);

    try {
        // ⚠️ CONTRACT GUARD: Validate order exists before creating orphaned payment
        console.log(`🔍 [${requestId}] Validating order exists in NEW tables...`);
        await validateOrderExists(order_type, order_id);
        console.log(`✅ [${requestId}] Order validation passed`);

        const result = await pool.query(
            `INSERT INTO payments (client_id, order_type, order_id, amount, payment_method, payment_date, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [client_id, order_type, order_id, amount, payment_method, payment_date, notes]
        );

        // Mark order as paid in NEW tables
        const table = order_type === 'laundry' ? 'laundry_orders_new' : 'cleaning_jobs';
        const paidColumn = order_type === 'laundry' ? 'payment_status' : 'payment_status';
        console.log(`📝 [${requestId}] Updating ${table} to mark order as paid`);

        await pool.query(
            `UPDATE ${table} SET payment_status = 'paid', paid_amount = $1 WHERE id = $2`,
            [amount, order_id]
        );

        console.log(`✅ [${requestId}] Payment recorded successfully`);
        res.status(201).json({ ...result.rows[0], _meta: { requestId } });
    } catch (error) {
        console.error(`❌ [${requestId}] Error recording payment:`, error.message);

        if (error.message.includes('Order not found')) {
            return res.status(400).json({
                error: 'Invalid order reference',
                details: error.message,
                requestId
            });
        }

        res.status(500).json({ error: 'Server error', requestId });
    }
});

module.exports = router;

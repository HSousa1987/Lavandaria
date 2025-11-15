const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// ==============================================
// MIDDLEWARE: Check if user is authenticated
// ==============================================
const requireAuth = (req, res, next) => {
    if (!req.session.userId || !req.session.userType) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// ==============================================
// MIDDLEWARE: Master or Admin only
// ==============================================
const requireMasterOrAdmin = (req, res, next) => {
    if (req.session.userType !== 'master' && req.session.userType !== 'admin') {
        return res.status(403).json({ error: 'Forbidden - Master or Admin only' });
    }
    next();
};

// ==============================================
// GET ALL LAUNDRY SERVICES
// ==============================================
// Available to all authenticated users (for displaying prices)
router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id, name, service_type, base_price, unit,
                estimated_duration_minutes, description, is_active,
                updated_at, created_at
            FROM laundry_services
            WHERE is_active = TRUE
            ORDER BY id
        `);

        res.json({
            success: true,
            data: result.rows,
            _meta: {
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            }
        });
    } catch (error) {
        console.error('Error fetching laundry services:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            _meta: {
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            }
        });
    }
});

// ==============================================
// GET SINGLE SERVICE BY ID
// ==============================================
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT
                id, name, service_type, base_price, unit,
                estimated_duration_minutes, description, is_active,
                updated_at, created_at
            FROM laundry_services
            WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Service not found',
                _meta: {
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                }
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
            _meta: {
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            }
        });
    } catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            _meta: {
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            }
        });
    }
});

// ==============================================
// UPDATE SERVICE PRICE (Master/Admin only)
// ==============================================
// Can only update base_price, description, is_active
// Cannot change service_code, service_name, unit, is_package
router.put('/:id', requireAuth, requireMasterOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { base_price, description, is_active } = req.body;

        // Validate base_price if provided
        if (base_price !== undefined) {
            const price = parseFloat(base_price);
            if (isNaN(price) || price < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'base_price must be a positive number',
                    _meta: {
                        timestamp: new Date().toISOString(),
                        correlationId: req.correlationId
                    }
                });
            }
        }

        // Build update query dynamically based on provided fields
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (base_price !== undefined) {
            updates.push(`base_price = $${paramCount++}`);
            values.push(parseFloat(base_price));
        }

        if (description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(description);
        }

        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(is_active);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update',
                _meta: {
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                }
            });
        }

        // Add updated_at
        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        // Add id to values for WHERE clause
        values.push(id);

        const query = `
            UPDATE laundry_services
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Service not found',
                _meta: {
                    timestamp: new Date().toISOString(),
                    correlationId: req.correlationId
                }
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
            _meta: {
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            }
        });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            _meta: {
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            }
        });
    }
});

// ==============================================
// GET SERVICES BY NAME (Search endpoint)
// ==============================================
router.get('/search/:name', requireAuth, async (req, res) => {
    try {
        const { name } = req.params;

        const result = await pool.query(`
            SELECT
                id, name, service_type, base_price, unit,
                estimated_duration_minutes, description, is_active,
                updated_at, created_at
            FROM laundry_services
            WHERE name ILIKE $1 AND is_active = TRUE
        `, [`%${name}%`]);

        res.json({
            success: true,
            data: result.rows,
            _meta: {
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            }
        });
    } catch (error) {
        console.error('Error searching services:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            _meta: {
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            }
        });
    }
});

module.exports = router;

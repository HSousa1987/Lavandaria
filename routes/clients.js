const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { requireMasterOrAdmin, requireStaff, canManageUsers } = require('../middleware/permissions');
const { listResponse, validatePagination, errorResponse } = require('../middleware/validation');

// Get all clients (All staff can view as contacts, but only Master/Admin can manage)
router.get('/', requireStaff, async (req, res) => {
    console.log(`🔵 GET /api/clients [${req.correlationId}] - User: ${req.session.userType}`);

    try {
        const { limit, offset, sort, order } = validatePagination(req);

        const query = `SELECT id, phone, name, email, date_of_birth, nif,
                    address_line1, address_line2, city, postal_code, district,
                    notes, is_enterprise, company_name, created_at, is_active
             FROM clients
             ORDER BY created_at ${order}
             LIMIT $1 OFFSET $2`;

        const countQuery = 'SELECT COUNT(*) FROM clients';

        const [result, countResult] = await Promise.all([
            pool.query(query, [limit, offset]),
            pool.query(countQuery)
        ]);

        console.log(`✅ Clients fetched [${req.correlationId}]: ${result.rows.length} of ${countResult.rows[0].count}`);

        return listResponse(res, result.rows, {
            total: parseInt(countResult.rows[0].count),
            limit,
            offset
        }, req);
    } catch (error) {
        console.error(`❌ Error fetching clients [${req.correlationId}]:`, error.message);
        return errorResponse(res, 500, 'Server error', 'SERVER_ERROR', req);
    }
});

// Get single client
router.get('/:id', requireMasterOrAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, phone, name, email, date_of_birth, nif,
                    address_line1, address_line2, city, postal_code, district,
                    notes, is_enterprise, company_name, created_at, is_active
             FROM clients WHERE id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching client:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create new client (Master or Admin only)
router.post('/', requireMasterOrAdmin, async (req, res) => {
    console.log('🟢 ============================================');
    console.log('🟢 POST /api/clients - CREATE CLIENT START');
    console.log('🟢 User:', req.session.userType, 'ID:', req.session.userId);
    console.log('🟢 ============================================');

    const { phone, name, email, date_of_birth, nif,
            address_line1, address_line2, city, postal_code, district,
            notes, is_enterprise, company_name } = req.body;

    console.log('📥 Received data from frontend (V2 schema):');
    console.log('   - phone:', phone);
    console.log('   - name:', name);
    console.log('   - email:', email);
    console.log('   - date_of_birth:', date_of_birth);
    console.log('   - nif:', nif);
    console.log('   - address_line1:', address_line1);
    console.log('   - address_line2:', address_line2);
    console.log('   - city:', city);
    console.log('   - postal_code:', postal_code);
    console.log('   - district:', district);
    console.log('   - notes:', notes);
    console.log('   - is_enterprise:', is_enterprise);
    console.log('   - company_name:', company_name);

    try {
        console.log('🔐 Hashing default password...');
        const defaultPassword = await bcrypt.hash('lavandaria2025', 10);
        console.log('✅ Password hashed successfully');

        // V2 Schema: Use name directly (frontend should handle enterprise vs individual name logic)
        const clientName = is_enterprise ? (company_name || name || 'Enterprise Client') : (name || 'Unnamed Client');
        console.log('📝 V2 Schema - Client name:', clientName, '(enterprise:', is_enterprise, ')');

        const query = `INSERT INTO clients (phone, password, name, email, date_of_birth,
                                 nif, address_line1, address_line2, city, postal_code, district,
                                 notes, is_enterprise, company_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING id, phone, name, email, date_of_birth, nif,
                       address_line1, address_line2, city, postal_code, district,
                       notes, is_enterprise, company_name`;

        const values = [phone, defaultPassword, clientName, email, date_of_birth,
             nif, address_line1, address_line2, city, postal_code, district,
             notes, is_enterprise, company_name];

        console.log('📝 Executing INSERT query with', values.length, 'parameters (V2)');
        console.log('📝 Values to insert:', {
            phone, name: clientName, email, date_of_birth, nif,
            address_line1, address_line2, city, postal_code, district, is_enterprise
        });

        const result = await pool.query(query, values);

        console.log('✅ ============================================');
        console.log('✅ Client created successfully!');
        console.log('✅ New client ID:', result.rows[0].id);
        console.log('✅ Returned data:', result.rows[0]);
        console.log('✅ ============================================\n');

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('❌ ============================================');
        console.error('❌ ERROR CREATING CLIENT!');
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error detail:', error.detail);
        console.error('❌ Error hint:', error.hint);
        console.error('❌ Error position:', error.position);
        console.error('❌ Error column:', error.column);
        console.error('❌ Error table:', error.table);
        console.error('❌ Full error stack:', error.stack);
        console.error('❌ ============================================\n');

        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Phone number already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// Update client (Master or Admin only)
router.put('/:id', requireMasterOrAdmin, async (req, res) => {
    const { phone, name, email, date_of_birth, nif,
            address_line1, address_line2, city, postal_code, district,
            notes, is_active, is_enterprise, company_name } = req.body;

    try {
        // V2 Schema: Use name directly (frontend should provide appropriate name)
        const clientName = is_enterprise ? (company_name || name || 'Enterprise Client') : (name || 'Unnamed Client');

        const result = await pool.query(
            `UPDATE clients
             SET phone = $1, name = $2, email = $3,
                 date_of_birth = $4, nif = $5, address_line1 = $6, address_line2 = $7, city = $8,
                 postal_code = $9, district = $10, notes = $11, is_active = $12,
                 is_enterprise = $13, company_name = $14
             WHERE id = $15
             RETURNING id, phone, name, email, date_of_birth, nif,
                       address_line1, address_line2, city, postal_code, district,
                       notes, is_active, is_enterprise, company_name`,
            [phone, clientName, email, date_of_birth, nif,
             address_line1, address_line2, city, postal_code, district,
             notes, is_active, is_enterprise, company_name, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete client (Master or Admin only)
router.delete('/:id', requireMasterOrAdmin, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING id', [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { requireMasterOrAdmin, requireStaff, canManageUsers } = require('../middleware/permissions');

// Get all clients (All staff can view as contacts, but only Master/Admin can manage)
router.get('/', requireStaff, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, phone, full_name, first_name, last_name, email, date_of_birth, nif, address,
                    notes, is_enterprise, company_name, registration_date, created_at, is_active
             FROM clients ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single client
router.get('/:id', requireMasterOrAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, phone, full_name, first_name, last_name, email, date_of_birth, nif, address,
                    notes, is_enterprise, company_name, registration_date, created_at, is_active
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
    const { phone, first_name, last_name, email, date_of_birth, nif, street, zip_code, district, notes, is_enterprise, company_name } = req.body;

    try {
        // Default password: lavandaria2025
        const defaultPassword = await bcrypt.hash('lavandaria2025', 10);

        // Build full_name based on client type
        let full_name;
        if (is_enterprise) {
            full_name = company_name || 'Enterprise Client';
        } else {
            full_name = `${first_name} ${last_name}`;
        }

        const result = await pool.query(
            `INSERT INTO clients (phone, password, full_name, first_name, last_name, email, date_of_birth,
                                 nif, street, zip_code, district, notes, is_enterprise, company_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING id, phone, full_name, first_name, last_name, email, date_of_birth, nif, street, zip_code, district,
                       notes, is_enterprise, company_name`,
            [phone, defaultPassword, full_name, first_name, last_name, email, date_of_birth,
             nif, street, zip_code, district, notes, is_enterprise, company_name]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating client:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Phone number already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// Update client (Master or Admin only)
router.put('/:id', requireMasterOrAdmin, async (req, res) => {
    const { phone, first_name, last_name, email, date_of_birth, nif, street, zip_code, district, notes, is_active, is_enterprise, company_name } = req.body;

    try {
        // Build full_name based on client type
        let full_name;
        if (is_enterprise) {
            full_name = company_name || 'Enterprise Client';
        } else {
            full_name = `${first_name} ${last_name}`;
        }

        const result = await pool.query(
            `UPDATE clients
             SET phone = $1, full_name = $2, first_name = $3, last_name = $4, email = $5,
                 date_of_birth = $6, nif = $7, street = $8, zip_code = $9, district = $10, notes = $11, is_active = $12,
                 is_enterprise = $13, company_name = $14
             WHERE id = $15
             RETURNING id, phone, full_name, first_name, last_name, email, date_of_birth, nif, street, zip_code, district,
                       notes, is_active, is_enterprise, company_name`,
            [phone, full_name, first_name, last_name, email, date_of_birth, nif, street, zip_code, district, notes,
             is_active, is_enterprise, company_name, req.params.id]
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

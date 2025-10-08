const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { requireMaster, requireMasterOrAdmin, requireStaff } = require('../middleware/permissions');

// Get all users (staff)
// Master sees all, Admin sees workers only
router.get('/', requireMasterOrAdmin, async (req, res) => {
    try {
        let query, params;

        if (req.session.userType === 'master') {
            // Master sees everyone
            query = `
                SELECT u.id, u.username, u.role, u.full_name, u.first_name, u.last_name, u.email, u.phone,
                       u.date_of_birth, u.nif, u.address_line1, u.address_line2, u.city, u.postal_code, u.district, u.country,
                       u.registration_date, u.created_at, u.is_active, u2.full_name as created_by_name
                FROM users u
                LEFT JOIN users u2 ON u.created_by = u2.id
                ORDER BY
                    CASE u.role
                        WHEN 'master' THEN 1
                        WHEN 'admin' THEN 2
                        WHEN 'worker' THEN 3
                    END,
                    u.created_at DESC
            `;
            params = [];
        } else {
            // Admin sees only workers
            query = `
                SELECT id, username, role, full_name, first_name, last_name, email, phone,
                       date_of_birth, nif, address_line1, address_line2, city, postal_code, district, country,
                       registration_date, created_at, is_active
                FROM users
                WHERE role = 'worker'
                ORDER BY created_at DESC
            `;
            params = [];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single user
router.get('/:id', requireMasterOrAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, role, full_name, first_name, last_name, email, phone,
                    date_of_birth, nif, address_line1, address_line2, city, postal_code, district, country,
                    registration_date, created_at, is_active
             FROM users WHERE id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Admin can only view workers
        if (req.session.userType === 'admin' && user.role !== 'worker') {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create new user (Master creates admins, Admin creates workers)
router.post('/', requireMasterOrAdmin, async (req, res) => {
    const { password, role, first_name, last_name, email, phone, date_of_birth, nif,
            address_line1, address_line2, city, postal_code, district, country } = req.body;

    try {
        // Validation: Master can create anyone, Admin can only create workers
        if (req.session.userType === 'admin' && role !== 'worker') {
            return res.status(403).json({ error: 'You can only create worker accounts' });
        }

        // Master cannot be created (only one exists)
        if (role === 'master') {
            return res.status(403).json({ error: 'Cannot create master accounts' });
        }

        // Use phone number as username (required and unique)
        const username = phone;

        const hashedPassword = await bcrypt.hash(password, 10);
        const full_name = `${first_name} ${last_name}`;

        const result = await pool.query(
            `INSERT INTO users (username, password, role, full_name, first_name, last_name, email, phone,
                               date_of_birth, nif, address_line1, address_line2, city, postal_code, district, country, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
             RETURNING id, username, role, full_name, first_name, last_name, email, phone, date_of_birth, nif,
                       address_line1, address_line2, city, postal_code, district, country`,
            [username, hashedPassword, role, full_name, first_name, last_name, email, phone,
             date_of_birth, nif, address_line1, address_line2, city, postal_code, district, country || 'Portugal', req.session.userId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating user:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Phone number already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// Update user
router.put('/:id', requireMasterOrAdmin, async (req, res) => {
    const { password, first_name, last_name, email, phone, date_of_birth, nif,
            address_line1, address_line2, city, postal_code, district, country, is_active } = req.body;

    // Use phone number as username
    const username = phone;

    try {
        // Check if user exists and get their role
        const userCheck = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.id]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const targetRole = userCheck.rows[0].role;

        // Only master can update master accounts
        if (targetRole === 'master' && req.session.userType !== 'master') {
            return res.status(403).json({ error: 'Only master can update master accounts' });
        }

        // Admin can update admin and worker accounts (not master)
        if (req.session.userType === 'admin' && targetRole === 'master') {
            return res.status(403).json({ error: 'Cannot update master account' });
        }

        const full_name = `${first_name} ${last_name}`;

        // If password is provided, hash it and update; otherwise, don't update password
        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            const result = await pool.query(
                `UPDATE users
                 SET username = $1, password = $2, full_name = $3, first_name = $4, last_name = $5,
                     email = $6, phone = $7, date_of_birth = $8, nif = $9,
                     address_line1 = $10, address_line2 = $11, city = $12, postal_code = $13, district = $14, country = $15,
                     is_active = $16
                 WHERE id = $17
                 RETURNING id, username, role, full_name, first_name, last_name, email, phone,
                           date_of_birth, nif, address_line1, address_line2, city, postal_code, district, country, is_active`,
                [username, hashedPassword, full_name, first_name, last_name, email, phone,
                 date_of_birth, nif, address_line1, address_line2, city, postal_code, district, country || 'Portugal',
                 is_active, req.params.id]
            );
            res.json(result.rows[0]);
        } else {
            // Don't update password
            const result = await pool.query(
                `UPDATE users
                 SET username = $1, full_name = $2, first_name = $3, last_name = $4, email = $5, phone = $6,
                     date_of_birth = $7, nif = $8, address_line1 = $9, address_line2 = $10, city = $11,
                     postal_code = $12, district = $13, country = $14, is_active = $15
                 WHERE id = $16
                 RETURNING id, username, role, full_name, first_name, last_name, email, phone,
                           date_of_birth, nif, address_line1, address_line2, city, postal_code, district, country, is_active`,
                [username, full_name, first_name, last_name, email, phone, date_of_birth, nif,
                 address_line1, address_line2, city, postal_code, district, country || 'Portugal',
                 is_active, req.params.id]
            );
            res.json(result.rows[0]);
        }
    } catch (error) {
        console.error('Error updating user:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete user
router.delete('/:id', requireMasterOrAdmin, async (req, res) => {
    try {
        // Check if user exists and get their role
        const userCheck = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.id]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const targetRole = userCheck.rows[0].role;

        // Cannot delete master
        if (targetRole === 'master') {
            return res.status(403).json({ error: 'Cannot delete master account' });
        }

        // Admin can delete admin and worker accounts (not master)
        if (req.session.userType === 'admin' && targetRole === 'master') {
            return res.status(403).json({ error: 'Cannot delete master account' });
        }

        // Prevent deleting yourself
        if (parseInt(req.params.id) === req.session.userId) {
            return res.status(403).json({ error: 'Cannot delete your own account' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Change password (for own account)
router.post('/change-password', requireStaff, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const result = await pool.query('SELECT password FROM users WHERE id = $1', [req.session.userId]);
        const user = result.rows[0];

        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.session.userId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

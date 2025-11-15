const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { requireMaster, requireMasterOrAdmin, requireStaff } = require('../middleware/permissions');
const { listResponse, validatePagination, errorResponse } = require('../middleware/validation');

// Get all users (staff)
// Master sees all, Admin sees workers only
// V2 Schema: Uses role_id (FK), no address or name split fields
router.get('/', requireMasterOrAdmin, async (req, res) => {
    try {
        const { limit, offset, sort, order } = validatePagination(req);
        let query, params, countQuery;

        if (req.session.userType === 'master') {
            // Master sees everyone with role type
            countQuery = 'SELECT COUNT(*) FROM users';
            query = `
                SELECT u.id, u.username, u.role_id, rt.role_name, u.name, u.email, u.phone,
                       u.date_of_birth, u.nif, u.created_at
                FROM users u
                LEFT JOIN role_types rt ON u.role_id = rt.id
                ORDER BY u.role_id ASC, u.created_at ${order}
                LIMIT $1 OFFSET $2
            `;
            params = [limit, offset];
        } else {
            // Admin sees only workers (role_id 3)
            countQuery = "SELECT COUNT(*) FROM users WHERE role_id = 3";
            query = `
                SELECT u.id, u.username, u.role_id, rt.role_name, u.name, u.email, u.phone,
                       u.date_of_birth, u.nif, u.created_at
                FROM users u
                LEFT JOIN role_types rt ON u.role_id = rt.id
                WHERE u.role_id = 3
                ORDER BY u.created_at ${order}
                LIMIT $1 OFFSET $2
            `;
            params = [limit, offset];
        }

        const [result, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery)
        ]);

        return listResponse(res, result.rows, {
            total: parseInt(countResult.rows[0].count),
            limit,
            offset
        }, req);
    } catch (error) {
        console.error(`Error fetching users [${req.correlationId}]:`, error);
        return errorResponse(res, 500, 'Server error', 'SERVER_ERROR', req);
    }
});

// Get single user
// Uses actual database schema: id (not user_id), role_id (FK)
router.get('/:id', requireMasterOrAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.username, u.role_id, rt.role_name, u.name, u.email, u.phone,
                    u.date_of_birth, u.nif, u.created_at, u.updated_at
             FROM users u
             LEFT JOIN role_types rt ON u.role_id = rt.id
             WHERE u.id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'USER_NOT_FOUND',
                message: 'User not found',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        const user = result.rows[0];

        // Admin can only view workers (role_id 3)
        if (req.session.userType === 'admin' && user.role_id !== 3) {
            return res.status(403).json({
                success: false,
                error: 'ACCESS_DENIED',
                message: 'Access denied',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        return res.json({
            success: true,
            data: user,
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error(`[${req.correlationId}] Error fetching user:`, error);
        return res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Server error',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Create new user (Master creates admins, Admin creates workers)
// V2 Schema: Uses role_id (FK) and name (single field), no address fields
router.post('/', requireMasterOrAdmin, async (req, res) => {
    const { username, password, role_id, name, email, phone, date_of_birth, nif } = req.body;

    try {
        // Validation: role_id is required
        if (!username || !password || !role_id) {
            return res.status(400).json({
                success: false,
                error: 'USERNAME_PASSWORD_ROLE_REQUIRED',
                message: 'Username, password, and role_id are required',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Validation: Master can create anyone, Admin can only create workers (role_id 3)
        if (req.session.userType === 'admin' && role_id !== 3) {
            return res.status(403).json({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'You can only create worker accounts (role_id 3)',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Master cannot be created (only one exists, role_id 1)
        if (role_id === 1) {
            return res.status(403).json({
                success: false,
                error: 'FORBIDDEN',
                message: 'Cannot create master accounts',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Convert empty strings to NULL for optional date/text fields
        const dateOfBirth = date_of_birth && date_of_birth.trim() ? date_of_birth : null;
        const nifValue = nif && nif.trim() ? nif : null;

        // Insert using actual database schema (id, not user_id; no must_change_password)
        const result = await pool.query(
            `INSERT INTO users (username, password, role_id, name, email, phone, date_of_birth, nif, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, username, role_id, name, email, phone, date_of_birth, nif, created_at`,
            [username, hashedPassword, role_id, name, email, phone, dateOfBirth, nifValue, req.session.userId]
        );

        // Return response with actual schema
        return res.status(201).json({
            success: true,
            data: {
                user: {
                    id: result.rows[0].id,
                    username: result.rows[0].username,
                    role_id: result.rows[0].role_id,
                    name: result.rows[0].name,
                    email: result.rows[0].email,
                    phone: result.rows[0].phone,
                    date_of_birth: result.rows[0].date_of_birth,
                    nif: result.rows[0].nif,
                    created_at: result.rows[0].created_at
                }
            },
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error(`[${req.correlationId}] Error creating user:`, error.message);

        // Handle specific PostgreSQL errors
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({
                success: false,
                error: 'DUPLICATE_USERNAME',
                message: 'Username already exists',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        if (error.code === '23503') { // Foreign key violation
            return res.status(400).json({
                success: false,
                error: 'INVALID_ROLE_ID',
                message: 'Invalid role_id - must reference existing role_types',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        return res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Failed to create user',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
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

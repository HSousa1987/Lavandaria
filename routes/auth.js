const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { body, validationResult } = require('express-validator');
const { loginLimiter, addCorrelationId } = require('../middleware/rateLimiter');

// Apply correlation ID middleware to all auth routes
router.use(addCorrelationId);

// Login for Admin/Cleaners
router.post('/login/user', loginLimiter, [
    body('username').trim().notEmpty(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log(`❌ [AUTH] Validation errors [${req.correlationId}]:`, errors.array());
        return res.status(400).json({
            errors: errors.array(),
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }

    const { username, password } = req.body;
    console.log(`🔐 [AUTH] Login attempt for user: ${username} [${req.correlationId}]`);

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND is_active = true',
            [username]
        );

        console.log(`📊 [AUTH] Database query result - rows found: ${result.rows.length} [${req.correlationId}]`);

        if (result.rows.length === 0) {
            console.log(`❌ [AUTH] User not found in database: ${username} [${req.correlationId}]`);
            return res.status(401).json({
                error: 'Invalid credentials',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        const user = result.rows[0];
        console.log(`👤 [AUTH] User found [${req.correlationId}]:`, { id: user.id, username: user.username, role: user.role });

        const validPassword = await bcrypt.compare(password, user.password);
        console.log(`🔑 [AUTH] Password validation result: ${validPassword} [${req.correlationId}]`);

        if (!validPassword) {
            console.log(`❌ [AUTH] Invalid password for user: ${username} [${req.correlationId}]`);
            return res.status(401).json({
                error: 'Invalid credentials',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        req.session.userId = user.id;
        req.session.userType = user.role;
        req.session.userName = user.full_name;

        console.log(`✅ [AUTH] Login successful for user: ${username} - Role: ${user.role} [${req.correlationId}]`);

        // Save session before responding to ensure it's persisted
        req.session.save((err) => {
            if (err) {
                console.error(`💥 [AUTH] Session save error [${req.correlationId}]:`, err);
                return res.status(500).json({
                    error: 'Session save failed',
                    _meta: {
                        correlationId: req.correlationId,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            console.log(`💾 [AUTH] Session saved successfully [${req.correlationId}]`);

            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    name: user.full_name
                },
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        });
    } catch (error) {
        console.error(`💥 [AUTH] Login error [${req.correlationId}]:`, error);
        res.status(500).json({
            error: 'Server error',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Login for Clients
router.post('/login/client', loginLimiter, [
    body('phone').trim().notEmpty(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log(`❌ [AUTH] Client validation errors [${req.correlationId}]:`, errors.array());
        return res.status(400).json({
            errors: errors.array(),
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }

    const { phone, password } = req.body;
    console.log(`🔐 [AUTH] Client login attempt for phone: ${phone} [${req.correlationId}]`);

    try {
        const result = await pool.query(
            'SELECT * FROM clients WHERE phone = $1 AND is_active = true',
            [phone]
        );

        console.log(`📊 [AUTH] Client query result - rows found: ${result.rows.length} [${req.correlationId}]`);

        if (result.rows.length === 0) {
            console.log(`❌ [AUTH] Client not found: ${phone} [${req.correlationId}]`);
            return res.status(401).json({
                error: 'Invalid credentials',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        const client = result.rows[0];
        const validPassword = await bcrypt.compare(password, client.password);
        console.log(`🔑 [AUTH] Client password validation: ${validPassword} [${req.correlationId}]`);

        if (!validPassword) {
            console.log(`❌ [AUTH] Invalid password for client: ${phone} [${req.correlationId}]`);
            return res.status(401).json({
                error: 'Invalid credentials',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        req.session.clientId = client.id;
        req.session.userType = 'client';
        req.session.userName = client.full_name;
        req.session.mustChangePassword = client.must_change_password;

        console.log(`✅ [AUTH] Client login successful: ${phone} [${req.correlationId}]`);

        // Save session before responding to ensure it's persisted
        req.session.save((err) => {
            if (err) {
                console.error(`💥 [AUTH] Session save error [${req.correlationId}]:`, err);
                return res.status(500).json({
                    error: 'Session save failed',
                    _meta: {
                        correlationId: req.correlationId,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            console.log(`💾 [AUTH] Session saved successfully [${req.correlationId}]`);

            res.json({
                success: true,
                client: {
                    id: client.id,
                    phone: client.phone,
                    name: client.full_name,
                    mustChangePassword: client.must_change_password
                },
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        });
    } catch (error) {
        console.error(`💥 [AUTH] Client login error [${req.correlationId}]:`, error);
        res.status(500).json({
            error: 'Server error',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Check session
router.get('/check', (req, res) => {
    if (!req.session.userType) {
        return res.json({ authenticated: false });
    }

    res.json({
        authenticated: true,
        userType: req.session.userType,
        userName: req.session.userName,
        userId: req.session.userId || req.session.clientId,
        mustChangePassword: req.session.mustChangePassword
    });
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

// Change password (works for all user types)
router.post('/change-password', async (req, res) => {
    if (!req.session.userType) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;

    try {
        let user, tableName, idField, userId;

        // Determine which table and ID to use
        if (req.session.userType === 'client') {
            tableName = 'clients';
            idField = 'id';
            userId = req.session.clientId;
        } else {
            tableName = 'users';
            idField = 'id';
            userId = req.session.userId;
        }

        // Get current password
        const result = await pool.query(`SELECT password FROM ${tableName} WHERE ${idField} = $1`, [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        user = result.rows[0];

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        if (req.session.userType === 'client') {
            await pool.query(
                'UPDATE clients SET password = $1, must_change_password = false WHERE id = $2',
                [hashedPassword, userId]
            );
            req.session.mustChangePassword = false;
        } else {
            await pool.query(
                'UPDATE users SET password = $1 WHERE id = $2',
                [hashedPassword, userId]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

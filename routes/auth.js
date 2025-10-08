const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { body, validationResult } = require('express-validator');

// Login for Admin/Cleaners
router.post('/login/user', [
    body('username').trim().notEmpty(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('❌ [AUTH] Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    console.log('🔐 [AUTH] Login attempt for user:', username);

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND is_active = true',
            [username]
        );

        console.log('📊 [AUTH] Database query result - rows found:', result.rows.length);

        if (result.rows.length === 0) {
            console.log('❌ [AUTH] User not found in database:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        console.log('👤 [AUTH] User found:', { id: user.id, username: user.username, role: user.role });

        const validPassword = await bcrypt.compare(password, user.password);
        console.log('🔑 [AUTH] Password validation result:', validPassword);

        if (!validPassword) {
            console.log('❌ [AUTH] Invalid password for user:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = user.id;
        req.session.userType = user.role;
        req.session.userName = user.full_name;

        console.log('✅ [AUTH] Login successful for user:', username, '- Role:', user.role);

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.full_name
            }
        });
    } catch (error) {
        console.error('💥 [AUTH] Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login for Clients
router.post('/login/client', [
    body('phone').trim().notEmpty(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { phone, password } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM clients WHERE phone = $1 AND is_active = true',
            [phone]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const client = result.rows[0];
        const validPassword = await bcrypt.compare(password, client.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.clientId = client.id;
        req.session.userType = 'client';
        req.session.userName = client.full_name;
        req.session.mustChangePassword = client.must_change_password;

        res.json({
            success: true,
            client: {
                id: client.id,
                phone: client.phone,
                name: client.full_name,
                mustChangePassword: client.must_change_password
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
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

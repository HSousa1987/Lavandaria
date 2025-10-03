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
// MIDDLEWARE: Master only (system settings)
// ==============================================
const requireMaster = (req, res, next) => {
    if (req.session.userType !== 'master') {
        return res.status(403).json({ error: 'Forbidden - Master only' });
    }
    next();
};

// ==============================================
// GET ALL SYSTEM SETTINGS (Master only)
// ==============================================
router.get('/', requireAuth, requireMaster, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id, setting_key, setting_value, description,
                updated_by, updated_at
            FROM system_settings
            ORDER BY setting_key
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// GET SINGLE SETTING BY KEY (Master only)
// ==============================================
router.get('/:key', requireAuth, requireMaster, async (req, res) => {
    try {
        const { key } = req.params;

        const result = await pool.query(`
            SELECT
                id, setting_key, setting_value, description,
                updated_by, updated_at
            FROM system_settings
            WHERE setting_key = $1
        `, [key]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching setting:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// UPDATE SETTING (Master only)
// ==============================================
router.put('/:key', requireAuth, requireMaster, async (req, res) => {
    try {
        const { key } = req.params;
        const { setting_value } = req.body;

        // Validate setting_value is provided
        if (setting_value === undefined || setting_value === null || setting_value === '') {
            return res.status(400).json({ error: 'setting_value is required' });
        }

        // Validate numeric values for specific settings
        if (['vat_rate', 'delivery_fee', 'cleaning_rate_30min'].includes(key)) {
            const numValue = parseFloat(setting_value);
            if (isNaN(numValue) || numValue < 0) {
                return res.status(400).json({ error: 'Value must be a positive number' });
            }
        }

        // Update setting
        const result = await pool.query(`
            UPDATE system_settings
            SET
                setting_value = $1,
                updated_by = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE setting_key = $3
            RETURNING *
        `, [setting_value, req.session.userId, key]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        res.json({
            success: true,
            message: `Setting '${key}' updated successfully`,
            setting: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// CREATE NEW SETTING (Master only)
// ==============================================
router.post('/', requireAuth, requireMaster, async (req, res) => {
    try {
        const { setting_key, setting_value, description } = req.body;

        // Validate required fields
        if (!setting_key || setting_value === undefined) {
            return res.status(400).json({ error: 'setting_key and setting_value are required' });
        }

        // Insert new setting
        const result = await pool.query(`
            INSERT INTO system_settings (setting_key, setting_value, description, updated_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [setting_key, setting_value, description, req.session.userId]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Setting key already exists' });
        }
        console.error('Error creating setting:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// DELETE SETTING (Master only)
// ==============================================
router.delete('/:key', requireAuth, requireMaster, async (req, res) => {
    try {
        const { key } = req.params;

        // Prevent deletion of critical settings
        const criticalSettings = ['vat_rate', 'delivery_fee', 'cleaning_rate_30min'];
        if (criticalSettings.includes(key)) {
            return res.status(403).json({
                error: 'Cannot delete critical system settings. Update their values instead.'
            });
        }

        const result = await pool.query(`
            DELETE FROM system_settings
            WHERE setting_key = $1
            RETURNING *
        `, [key]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        res.json({
            success: true,
            message: `Setting '${key}' deleted successfully`
        });
    } catch (error) {
        console.error('Error deleting setting:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

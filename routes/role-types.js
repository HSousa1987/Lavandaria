const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireMasterOrAdmin } = require('../middleware/permissions');

// ==============================================
// GET /api/role-types - List all role types
// ==============================================
// Used by UserModal to populate role dropdown
// Only Master/Admin can create users, so restrict to those roles
router.get('/', requireMasterOrAdmin, async (req, res) => {
    console.log(`🔵 GET /api/role-types [${req.correlationId}] - User: ${req.session.userType}`);

    try {
        // Fetch all role types from database
        const result = await pool.query(`
            SELECT id, role_name, description, created_at
            FROM role_types
            ORDER BY id ASC
        `);

        console.log(`✅ Role types fetched [${req.correlationId}]: ${result.rows.length} roles`);

        // Return array directly (UserModal expects this format)
        res.json(result.rows);

    } catch (error) {
        console.error(`❌ Error fetching role types [${req.correlationId}]:`, error.message);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to fetch role types'
        });
    }
});

module.exports = router;

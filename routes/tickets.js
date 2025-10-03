const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireAuth, requireStaff, requireMasterOrAdmin } = require('../middleware/permissions');

// Get all tickets (staff only)
// Workers see only their own tickets, admins/master see all
router.get('/', requireStaff, async (req, res) => {
    try {
        let query, params;

        if (req.session.userType === 'worker') {
            // Workers see only their tickets
            query = `
                SELECT t.*,
                       u1.full_name as created_by_name,
                       u2.full_name as assigned_to_name,
                       u3.full_name as resolved_by_name
                FROM tickets t
                LEFT JOIN users u1 ON t.created_by = u1.id
                LEFT JOIN users u2 ON t.assigned_to = u2.id
                LEFT JOIN users u3 ON t.resolved_by = u3.id
                WHERE t.created_by = $1
                ORDER BY
                    CASE t.priority
                        WHEN 'urgent' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    t.created_at DESC
            `;
            params = [req.session.userId];
        } else {
            // Admins and Master see all tickets
            query = `
                SELECT t.*,
                       u1.full_name as created_by_name,
                       u2.full_name as assigned_to_name,
                       u3.full_name as resolved_by_name
                FROM tickets t
                LEFT JOIN users u1 ON t.created_by = u1.id
                LEFT JOIN users u2 ON t.assigned_to = u2.id
                LEFT JOIN users u3 ON t.resolved_by = u3.id
                ORDER BY
                    CASE t.priority
                        WHEN 'urgent' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    t.created_at DESC
            `;
            params = [];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single ticket
router.get('/:id', requireStaff, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT t.*,
                    u1.full_name as created_by_name,
                    u2.full_name as assigned_to_name,
                    u3.full_name as resolved_by_name
             FROM tickets t
             LEFT JOIN users u1 ON t.created_by = u1.id
             LEFT JOIN users u2 ON t.assigned_to = u2.id
             LEFT JOIN users u3 ON t.resolved_by = u3.id
             WHERE t.id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const ticket = result.rows[0];

        // Workers can only see their own tickets
        if (req.session.userType === 'worker' && ticket.created_by !== req.session.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(ticket);
    } catch (error) {
        console.error('Error fetching ticket:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create ticket (all staff can create)
router.post('/', requireStaff, async (req, res) => {
    const { title, description, order_type, order_id, priority } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO tickets (title, description, order_type, order_id, priority, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [title, description, order_type, order_id, priority || 'medium', req.session.userId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update ticket (Admin/Master only)
router.put('/:id', requireMasterOrAdmin, async (req, res) => {
    const { status, assigned_to, priority, notes } = req.body;

    try {
        const updateFields = [];
        const values = [];
        let paramCount = 1;

        if (status !== undefined) {
            updateFields.push(`status = $${paramCount++}`);
            values.push(status);

            // If status is resolved or closed, set resolved_at and resolved_by
            if (status === 'resolved' || status === 'closed') {
                updateFields.push(`resolved_at = NOW()`);
                updateFields.push(`resolved_by = $${paramCount++}`);
                values.push(req.session.userId);
            }
        }

        if (assigned_to !== undefined) {
            updateFields.push(`assigned_to = $${paramCount++}`);
            values.push(assigned_to);
        }

        if (priority !== undefined) {
            updateFields.push(`priority = $${paramCount++}`);
            values.push(priority);
        }

        if (notes !== undefined) {
            updateFields.push(`notes = $${paramCount++}`);
            values.push(notes);
        }

        values.push(req.params.id);

        const result = await pool.query(
            `UPDATE tickets SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating ticket:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete ticket (Admin/Master only)
router.delete('/:id', requireMasterOrAdmin, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM tickets WHERE id = $1 RETURNING id', [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting ticket:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

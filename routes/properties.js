const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireMasterOrAdmin, requireStaff } = require('../middleware/permissions');

// Get all properties for a client (Master/Admin only)
router.get('/client/:clientId', requireMasterOrAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM properties
             WHERE client_id = $1 AND is_active = true
             ORDER BY is_primary DESC, property_name`,
            [req.params.clientId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching properties:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single property (Staff can view if linked to their order)
router.get('/:id', requireStaff, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*, c.full_name as client_name, c.phone as client_phone
             FROM properties p
             JOIN clients c ON p.client_id = c.id
             WHERE p.id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Property not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching property:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create property (Master/Admin only)
router.post('/', requireMasterOrAdmin, async (req, res) => {
    const {
        client_id,
        property_name,
        address_line1,
        address_line2,
        city,
        postal_code,
        country,
        latitude,
        longitude,
        property_type,
        access_instructions,
        key_location,
        parking_info,
        special_notes,
        is_primary
    } = req.body;

    try {
        // If this is set as primary, unset other primary properties for this client
        if (is_primary) {
            await pool.query(
                'UPDATE properties SET is_primary = false WHERE client_id = $1',
                [client_id]
            );
        }

        const result = await pool.query(
            `INSERT INTO properties
             (client_id, property_name, address_line1, address_line2, city, postal_code, country,
              latitude, longitude, property_type, access_instructions, key_location, parking_info,
              special_notes, is_primary)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             RETURNING *`,
            [client_id, property_name, address_line1, address_line2, city, postal_code, country,
             latitude, longitude, property_type, access_instructions, key_location, parking_info,
             special_notes, is_primary]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating property:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update property (Master/Admin only)
router.put('/:id', requireMasterOrAdmin, async (req, res) => {
    const {
        property_name,
        address_line1,
        address_line2,
        city,
        postal_code,
        country,
        latitude,
        longitude,
        property_type,
        access_instructions,
        key_location,
        parking_info,
        special_notes,
        is_primary,
        is_active
    } = req.body;

    try {
        // If setting as primary, get client_id first
        if (is_primary) {
            const prop = await pool.query('SELECT client_id FROM properties WHERE id = $1', [req.params.id]);
            if (prop.rows.length > 0) {
                await pool.query(
                    'UPDATE properties SET is_primary = false WHERE client_id = $1',
                    [prop.rows[0].client_id]
                );
            }
        }

        const result = await pool.query(
            `UPDATE properties
             SET property_name = $1, address_line1 = $2, address_line2 = $3, city = $4,
                 postal_code = $5, country = $6, latitude = $7, longitude = $8,
                 property_type = $9, access_instructions = $10, key_location = $11,
                 parking_info = $12, special_notes = $13, is_primary = $14, is_active = $15
             WHERE id = $16
             RETURNING *`,
            [property_name, address_line1, address_line2, city, postal_code, country,
             latitude, longitude, property_type, access_instructions, key_location,
             parking_info, special_notes, is_primary, is_active, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Property not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating property:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete property (Master/Admin only)
router.delete('/:id', requireMasterOrAdmin, async (req, res) => {
    try {
        // Soft delete - mark as inactive
        const result = await pool.query(
            'UPDATE properties SET is_active = false WHERE id = $1 RETURNING id',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Property not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting property:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

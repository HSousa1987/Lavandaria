const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireStaff, requireMasterOrAdmin } = require('../middleware/permissions');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.userType) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

// Generate unique order number
const generateOrderNumber = () => {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `LDR-${dateStr}-${randomSuffix}`;
};

// ==============================================
// GET ALL LAUNDRY ORDERS
// ==============================================
router.get('/', requireAuth, async (req, res) => {
    try {
        let query, params;

        if (req.session.userType === 'master' || req.session.userType === 'admin') {
            // Master/Admin see all orders
            query = `
                SELECT lo.*,
                       c.full_name as client_name, c.phone as client_phone,
                       u.full_name as worker_name
                FROM laundry_orders_new lo
                JOIN clients c ON lo.client_id = c.id
                LEFT JOIN users u ON lo.assigned_worker_id = u.id
                ORDER BY lo.created_at DESC
            `;
            params = [];
        } else if (req.session.userType === 'worker') {
            // Workers see all orders (they process them)
            query = `
                SELECT lo.*,
                       c.full_name as client_name, c.phone as client_phone
                FROM laundry_orders_new lo
                JOIN clients c ON lo.client_id = c.id
                ORDER BY lo.created_at DESC
            `;
            params = [];
        } else if (req.session.userType === 'client') {
            // Clients see only their orders
            query = `
                SELECT lo.*,
                       u.full_name as worker_name
                FROM laundry_orders_new lo
                LEFT JOIN users u ON lo.assigned_worker_id = u.id
                WHERE lo.client_id = $1
                ORDER BY lo.created_at DESC
            `;
            params = [req.session.clientId];
        } else {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching laundry orders:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// GET SINGLE ORDER WITH ITEMS
// ==============================================
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const orderResult = await pool.query(
            `SELECT lo.*,
                    c.full_name as client_name, c.phone as client_phone, c.email as client_email,
                    u.full_name as worker_name
             FROM laundry_orders_new lo
             JOIN clients c ON lo.client_id = c.id
             LEFT JOIN users u ON lo.assigned_worker_id = u.id
             WHERE lo.id = $1`,
            [req.params.id]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderResult.rows[0];

        // Check permissions
        if (req.session.userType === 'client' && order.client_id !== req.session.clientId) {
            return res.status(403).json({ error: 'Not your order' });
        }

        // Get items if order is itemized or house_bundle
        let items = [];
        if (order.order_type === 'itemized' || order.order_type === 'house_bundle') {
            const itemsResult = await pool.query(
                `SELECT * FROM laundry_order_items
                 WHERE laundry_order_id = $1
                 ORDER BY created_at ASC`,
                [req.params.id]
            );
            items = itemsResult.rows;
        }

        res.json({
            order: order,
            items: items
        });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// GET SINGLE ORDER WITH FULL DETAILS (items + payments + history)
// ==============================================
router.get('/:id/full', requireAuth, async (req, res) => {
    try {
        const orderResult = await pool.query(
            `SELECT lo.*,
                    c.full_name as client_name, c.phone as client_phone, c.email as client_email,
                    c.address as client_address,
                    u.full_name as worker_name,
                    creator.full_name as created_by_name
             FROM laundry_orders_new lo
             JOIN clients c ON lo.client_id = c.id
             LEFT JOIN users u ON lo.assigned_worker_id = u.id
             LEFT JOIN users creator ON lo.created_by = creator.id
             WHERE lo.id = $1`,
            [req.params.id]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderResult.rows[0];

        // Check permissions
        if (req.session.userType === 'client' && order.client_id !== req.session.clientId) {
            return res.status(403).json({ error: 'Not your order' });
        }

        // Get items if order is itemized or house_bundle
        let items = [];
        if (order.order_type === 'itemized' || order.order_type === 'house_bundle') {
            const itemsResult = await pool.query(
                `SELECT * FROM laundry_order_items
                 WHERE laundry_order_id = $1
                 ORDER BY created_at ASC`,
                [req.params.id]
            );
            items = itemsResult.rows;
        }

        // Get payments for this order
        const paymentsResult = await pool.query(
            `SELECT p.*, u.full_name as recorded_by_name
             FROM payments p
             LEFT JOIN users u ON u.id = (p.notes::jsonb->>'recorded_by_user_id')::integer
             WHERE p.order_type = 'laundry' AND p.order_id = $1
             ORDER BY p.payment_date DESC`,
            [req.params.id]
        );

        // Get status history
        const historyResult = await pool.query(
            `SELECT osh.*, u.full_name as changed_by_name
             FROM order_status_history osh
             LEFT JOIN users u ON osh.changed_by = u.id
             WHERE osh.order_type = 'laundry' AND osh.order_id = $1
             ORDER BY osh.created_at DESC`,
            [req.params.id]
        );

        res.json({
            order: order,
            items: items,
            payments: paymentsResult.rows,
            statusHistory: historyResult.rows
        });
    } catch (error) {
        console.error('Error fetching full order details:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// CREATE LAUNDRY ORDER (Master/Admin only)
// ==============================================
router.post('/', requireMasterOrAdmin, async (req, res) => {
    const client = await pool.query('BEGIN');

    try {
        const {
            client_id, order_type, total_weight_kg, price_per_kg,
            additional_charges, discount, expected_ready_date,
            special_instructions, items, service_id, delivery_requested
        } = req.body;

        // Convert empty strings to null for numeric fields
        const cleanedTotalWeightKg = total_weight_kg === '' ? null : total_weight_kg;
        const cleanedPricePerKg = price_per_kg === '' ? null : price_per_kg;
        const cleanedAdditionalCharges = additional_charges === '' ? null : additional_charges;
        const cleanedDiscount = discount === '' ? null : discount;
        const cleanedServiceId = service_id === '' ? null : service_id;

        const orderNumber = generateOrderNumber();

        let base_price = 0;
        let finalPricePerKg = cleanedPricePerKg;

        // If service_id provided, get price from service
        if (cleanedServiceId) {
            const serviceResult = await pool.query(
                'SELECT base_price, unit FROM laundry_services WHERE id = $1 AND is_active = TRUE',
                [cleanedServiceId]
            );

            if (serviceResult.rows.length > 0) {
                finalPricePerKg = serviceResult.rows[0].base_price;
            }
        }

        // Calculate base price for bulk orders
        if (order_type === 'bulk_kg' && cleanedTotalWeightKg) {
            base_price = cleanedTotalWeightKg * (finalPricePerKg || 3.50);
        }

        // Create order - trigger will calculate VAT and delivery fee
        const orderResult = await pool.query(
            `INSERT INTO laundry_orders_new (
                client_id, order_number, order_type, total_weight_kg, price_per_kg,
                base_price, additional_charges, discount,
                expected_ready_date, special_instructions, created_by,
                service_id, delivery_requested
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *`,
            [
                client_id, orderNumber, order_type, cleanedTotalWeightKg, finalPricePerKg || 3.50,
                base_price, cleanedAdditionalCharges || 0, cleanedDiscount || 0,
                expected_ready_date, special_instructions, req.session.userId,
                cleanedServiceId, delivery_requested || false
            ]
        );

        const order = orderResult.rows[0];

        // Add items if itemized or house_bundle
        if ((order_type === 'itemized' || order_type === 'house_bundle') && items && items.length > 0) {
            let totalFromItems = 0;

            for (const item of items) {
                const itemTotal = item.quantity * item.unit_price;
                totalFromItems += itemTotal;

                await pool.query(
                    `INSERT INTO laundry_order_items (
                        laundry_order_id, item_type, item_category, quantity,
                        unit_price, total_price, condition_notes, special_treatment
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        order.id, item.item_type, item.item_category || 'clothing',
                        item.quantity, item.unit_price, itemTotal,
                        item.condition_notes, item.special_treatment
                    ]
                );
            }

            // Update order total with items sum
            await pool.query(
                `UPDATE laundry_orders_new
                 SET base_price = $1,
                     total_price = $1 + COALESCE(additional_charges, 0) - COALESCE(discount, 0)
                 WHERE id = $2`,
                [totalFromItems, order.id]
            );
        }

        await pool.query('COMMIT');

        // Fetch the complete order with updated totals
        const finalResult = await pool.query(
            'SELECT * FROM laundry_orders_new WHERE id = $1',
            [order.id]
        );

        res.status(201).json(finalResult.rows[0]);
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error creating laundry order:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// UPDATE ORDER STATUS (Staff)
// ==============================================
router.patch('/:id/status', requireStaff, async (req, res) => {
    try {
        const { status } = req.body;

        const validStatuses = ['received', 'in_progress', 'ready', 'collected', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const updates = { status };

        // Set timestamps based on status
        if (status === 'ready') {
            updates.ready_at = 'CURRENT_TIMESTAMP';
        } else if (status === 'collected') {
            updates.collected_at = 'CURRENT_TIMESTAMP';
        }

        const result = await pool.query(
            `UPDATE laundry_orders_new
             SET status = $1,
                 ready_at = CASE WHEN $2 = 'ready' THEN CURRENT_TIMESTAMP ELSE ready_at END,
                 collected_at = CASE WHEN $2 = 'collected' THEN CURRENT_TIMESTAMP ELSE collected_at END
             WHERE id = $3
             RETURNING *`,
            [status, status, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// MARK ORDER AS READY + SEND NOTIFICATION
// ==============================================
router.post('/:id/mark-ready', requireStaff, async (req, res) => {
    try {
        // Get order details
        const orderResult = await pool.query(
            `SELECT lo.*, c.full_name, c.phone, c.email
             FROM laundry_orders_new lo
             JOIN clients c ON lo.client_id = c.id
             WHERE lo.id = $1`,
            [req.params.id]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderResult.rows[0];

        if (order.status === 'ready' || order.status === 'collected') {
            return res.status(400).json({ error: 'Order already marked as ready or collected' });
        }

        // Update order status to ready
        await pool.query(
            `UPDATE laundry_orders_new
             SET status = 'ready',
                 ready_at = CURRENT_TIMESTAMP,
                 ready_notification_sent = TRUE,
                 ready_notification_sent_at = CURRENT_TIMESTAMP,
                 client_notified_via = 'in_app'
             WHERE id = $1`,
            [req.params.id]
        );

        // Create notification
        const notificationTitle = `Laundry Ready! 🧺`;
        const notificationMessage = `Your laundry order ${order.order_number} is ready to collect!`;

        await pool.query(
            `INSERT INTO job_notifications (
                client_id, notification_type, laundry_order_id,
                title, message, delivery_method, status, sent_at
            ) VALUES ($1, 'laundry_ready', $2, $3, $4, 'in_app', 'sent', CURRENT_TIMESTAMP)`,
            [order.client_id, req.params.id, notificationTitle, notificationMessage]
        );

        // In production, here you would:
        // - Send SMS via Twilio/etc
        // - Send push notification via FCM/APNs
        // - Send email via SendGrid/etc

        res.json({
            success: true,
            message: 'Order marked as ready and notification sent',
            order_number: order.order_number,
            client_name: order.full_name,
            client_phone: order.phone,
            notification: {
                title: notificationTitle,
                message: notificationMessage,
                sent_via: ['in_app'] // In production: ['in_app', 'sms', 'email']
            }
        });
    } catch (error) {
        console.error('Error marking order ready:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// UPDATE ORDER (Master/Admin only)
// ==============================================
router.put('/:id', requireMasterOrAdmin, async (req, res) => {
    try {
        const {
            client_id, assigned_worker_id, total_weight_kg, price_per_kg,
            additional_charges, discount, expected_ready_date,
            special_instructions, payment_status, status,
            service_id, delivery_requested
        } = req.body;

        const result = await pool.query(
            `UPDATE laundry_orders_new SET
                client_id = COALESCE($1, client_id),
                assigned_worker_id = $2,
                total_weight_kg = $3,
                price_per_kg = $4,
                additional_charges = $5,
                discount = $6,
                expected_ready_date = $7,
                special_instructions = $8,
                payment_status = $9,
                status = $10,
                service_id = $11,
                delivery_requested = $12
             WHERE id = $13
             RETURNING *`,
            [
                client_id, assigned_worker_id, total_weight_kg, price_per_kg,
                additional_charges, discount, expected_ready_date,
                special_instructions, payment_status, status,
                service_id, delivery_requested,
                req.params.id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// ADD ITEM TO ORDER (Master/Admin only)
// ==============================================
router.post('/:id/items', requireMasterOrAdmin, async (req, res) => {
    try {
        const { item_type, item_category, quantity, unit_price, condition_notes, special_treatment } = req.body;

        const total_price = quantity * unit_price;

        const result = await pool.query(
            `INSERT INTO laundry_order_items (
                laundry_order_id, item_type, item_category, quantity,
                unit_price, total_price, condition_notes, special_treatment
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                req.params.id, item_type, item_category || 'clothing',
                quantity, unit_price, total_price, condition_notes, special_treatment
            ]
        );

        // Recalculate order total
        const itemsSum = await pool.query(
            'SELECT SUM(total_price) as total FROM laundry_order_items WHERE laundry_order_id = $1',
            [req.params.id]
        );

        await pool.query(
            `UPDATE laundry_orders_new
             SET base_price = $1,
                 total_price = $1 + COALESCE(additional_charges, 0) - COALESCE(discount, 0)
             WHERE id = $2`,
            [itemsSum.rows[0].total || 0, req.params.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding item:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// DELETE ITEM FROM ORDER (Master/Admin only)
// ==============================================
router.delete('/:orderId/items/:itemId', requireMasterOrAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM laundry_order_items WHERE id = $1 AND laundry_order_id = $2 RETURNING id',
            [req.params.itemId, req.params.orderId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Recalculate order total
        const itemsSum = await pool.query(
            'SELECT SUM(total_price) as total FROM laundry_order_items WHERE laundry_order_id = $1',
            [req.params.orderId]
        );

        await pool.query(
            `UPDATE laundry_orders_new
             SET base_price = $1,
                 total_price = $1 + COALESCE(additional_charges, 0) - COALESCE(discount, 0)
             WHERE id = $2`,
            [itemsSum.rows[0].total || 0, req.params.orderId]
        );

        res.json({ success: true, message: 'Item deleted' });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==============================================
// DELETE ORDER (Master/Admin only)
// ==============================================
router.delete('/:id', requireMasterOrAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM laundry_orders_new WHERE id = $1 RETURNING id',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ success: true, message: 'Order deleted' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

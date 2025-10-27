const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { addCorrelationId } = require('../middleware/rateLimiter');

// Apply correlation ID middleware to all health routes
router.use(addCorrelationId);

/**
 * Liveness probe - process is alive
 * Returns 200 if server can handle requests
 * No authentication required (public endpoint)
 */
router.get('/healthz', (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            status: 'ok',
            service: 'lavandaria-api',
            uptime: process.uptime()
        },
        _meta: {
            correlationId: req.correlationId,
            timestamp: new Date().toISOString()
        }
    });
});

/**
 * Readiness probe - dependencies are healthy
 * Returns 200 if database is reachable
 * Returns 503 if database ping fails
 * No authentication required (public endpoint)
 */
router.get('/readyz', async (req, res) => {
    const startTime = Date.now();

    try {
        // Lightweight DB ping
        await pool.query('SELECT 1');
        const dbLatency = Date.now() - startTime;

        // Warn if DB is slow
        if (dbLatency > 100) {
            console.warn(`⚠️  [HEALTH] Slow database response: ${dbLatency}ms [${req.correlationId}]`);
        }

        res.status(200).json({
            success: true,
            data: {
                status: 'ready',
                service: 'lavandaria-api',
                checks: {
                    database: {
                        status: 'ok',
                        latency_ms: dbLatency
                    }
                }
            },
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error(`❌ [HEALTH] Readiness check failed [${req.correlationId}]:`, error.message);

        res.status(503).json({
            success: false,
            error: 'Service not ready',
            data: {
                status: 'not_ready',
                service: 'lavandaria-api',
                checks: {
                    database: {
                        status: 'error',
                        error: error.message
                    }
                }
            },
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

module.exports = router;

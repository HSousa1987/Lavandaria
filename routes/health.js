const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

/**
 * Liveness probe - process is alive
 * Returns 200 if server can handle requests
 */
router.get('/healthz', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'lavandaria-api',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * Readiness probe - dependencies are healthy
 * Returns 200 if database is reachable
 * Returns 503 if database ping fails
 */
router.get('/readyz', async (req, res) => {
    const startTime = Date.now();

    try {
        // Lightweight DB ping
        await pool.query('SELECT 1');
        const dbLatency = Date.now() - startTime;

        // Warn if DB is slow
        if (dbLatency > 100) {
            console.warn(`⚠️  [HEALTH] Slow database response: ${dbLatency}ms`);
        }

        res.status(200).json({
            status: 'ready',
            service: 'lavandaria-api',
            timestamp: new Date().toISOString(),
            checks: {
                database: {
                    status: 'ok',
                    latency_ms: dbLatency
                }
            }
        });
    } catch (error) {
        console.error('❌ [HEALTH] Readiness check failed:', error.message);

        res.status(503).json({
            status: 'not_ready',
            service: 'lavandaria-api',
            timestamp: new Date().toISOString(),
            checks: {
                database: {
                    status: 'error',
                    error: error.message
                }
            }
        });
    }
});

module.exports = router;

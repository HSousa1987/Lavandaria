const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for login endpoints
 * Prevents brute force attacks by limiting failed login attempts
 *
 * Rules:
 * - Max 5 attempts per 15 minutes per IP
 * - Applies to both user and client login endpoints
 * - Returns 429 status with friendly error message
 * - Includes request correlation ID in response
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests
  skipFailedRequests: false,
  // Use default memory store (works across all environments)
  keyGenerator: (req) => {
    // Use IP address as the key for rate limiting
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    console.log(`🔍 [RATE-LIMIT] Request from IP: ${ip}`);
    return ip;
  },
  handler: (req, res) => {
    const correlationId = req.correlationId || req.headers['x-correlation-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`🚫 [RATE-LIMIT] Login attempt blocked - IP: ${req.ip}, Correlation ID: ${correlationId}`);

    res.status(429).json({
      error: 'Too many login attempts from this IP, please try again after 15 minutes',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 15 * 60,
      _meta: {
        correlationId,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Middleware to add correlation ID to all requests
 * Helps trace requests through logs
 */
const addCorrelationId = (req, res, next) => {
  // Use client-provided correlation ID or generate one
  const correlationId = req.headers['x-correlation-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  req.correlationId = correlationId;

  // Add to response headers for client tracking
  res.setHeader('X-Correlation-Id', correlationId);

  next();
};

module.exports = {
  loginLimiter,
  addCorrelationId
};

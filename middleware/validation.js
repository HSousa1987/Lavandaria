const { validationResult } = require('express-validator');

/**
 * Middleware to handle validation results
 * Returns a consistent error shape across all endpoints
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const correlationId = req.correlationId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        console.log(`❌ [VALIDATION] Validation errors [${correlationId}]:`, errors.array());

        return res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: errors.array().map(err => ({
                field: err.path || err.param,
                message: err.msg,
                value: err.value
            })),
            _meta: {
                correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }

    next();
};

/**
 * Standard error response helper
 * Ensures consistent error shape across all endpoints
 */
const errorResponse = (res, statusCode, message, code = null, req = null) => {
    const correlationId = req?.correlationId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const response = {
        error: message,
        _meta: {
            correlationId,
            timestamp: new Date().toISOString()
        }
    };

    if (code) {
        response.code = code;
    }

    return res.status(statusCode).json(response);
};

/**
 * Standard success response helper
 * Ensures consistent success shape across all endpoints
 */
const successResponse = (res, data, statusCode = 200, req = null) => {
    const correlationId = req?.correlationId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const response = {
        success: true,
        ...data,
        _meta: {
            correlationId,
            timestamp: new Date().toISOString()
        }
    };

    return res.status(statusCode).json(response);
};

module.exports = {
    handleValidationErrors,
    errorResponse,
    successResponse
};

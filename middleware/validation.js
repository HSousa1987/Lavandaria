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
        success: false,
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

/**
 * Standard list response helper
 * Ensures consistent envelope for list endpoints with pagination
 */
const listResponse = (res, items, pagination = {}, req = null) => {
    const correlationId = req?.correlationId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { total = null, limit = null, offset = 0 } = pagination;

    const response = {
        success: true,
        data: items,
        _meta: {
            correlationId,
            timestamp: new Date().toISOString(),
            ...(total !== null && { total }),
            ...(limit !== null && { limit, offset }),
            count: items.length
        }
    };

    return res.status(200).json(response);
};

/**
 * Validate and sanitize pagination parameters
 * Enforces global defaults and caps
 */
const validatePagination = (req) => {
    const DEFAULT_LIMIT = 50;
    const MAX_LIMIT = 100;

    let limit = parseInt(req.query.limit) || DEFAULT_LIMIT;
    let offset = parseInt(req.query.offset) || 0;

    // Enforce caps
    limit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    offset = Math.max(offset, 0);

    // Validate sort/order if present
    const allowedSortFields = req.allowedSortFields || [];
    const sort = req.query.sort;
    const order = req.query.order?.toUpperCase() || 'DESC';

    if (sort && allowedSortFields.length > 0 && !allowedSortFields.includes(sort)) {
        throw new Error(`Invalid sort field. Allowed: ${allowedSortFields.join(', ')}`);
    }

    if (!['ASC', 'DESC'].includes(order)) {
        throw new Error('Invalid order. Allowed: ASC, DESC');
    }

    return {
        limit,
        offset,
        sort: sort || 'id',
        order
    };
};

module.exports = {
    handleValidationErrors,
    errorResponse,
    successResponse,
    listResponse,
    validatePagination
};

// Role-based permission middleware (standardized envelopes)

// Role hierarchy:
// master - Full access, can create admins
// admin - Can manage clients, orders, payments (but NOT create other admins)
// worker - Can view/manage orders, add photos, create tickets (NO finance access)

// Check if user is authenticated
const requireAuth = (req, res, next) => {
    if (!req.session.userType) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
    next();
};

// Master only (you)
const requireMaster = (req, res, next) => {
    if (req.session.userType !== 'master') {
        return res.status(403).json({
            success: false,
            error: 'Master access required',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
    next();
};

// Master or Admin
const requireMasterOrAdmin = (req, res, next) => {
    if (req.session.userType !== 'master' && req.session.userType !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Admin access required',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
    next();
};

// Master, Admin, or Worker
const requireStaff = (req, res, next) => {
    const staffRoles = ['master', 'admin', 'worker'];
    if (!staffRoles.includes(req.session.userType)) {
        return res.status(403).json({
            success: false,
            error: 'Staff access required',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
    next();
};

// Client only
const requireClient = (req, res, next) => {
    if (req.session.userType !== 'client') {
        return res.status(403).json({
            success: false,
            error: 'Client access required',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
    next();
};

// Finance access (Master or Admin only, NOT workers)
const requireFinanceAccess = (req, res, next) => {
    if (req.session.userType !== 'master' && req.session.userType !== 'admin') {
        console.log(`🚫 [RBAC] Finance access denied for role: ${req.session.userType} [${req.correlationId}]`);
        return res.status(403).json({
            success: false,
            error: 'Finance access denied',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
    next();
};

// Can manage users (create, edit, delete)
const canManageUsers = (targetRole) => {
    return (req, res, next) => {
        const userRole = req.session.userType;

        // Master can manage everyone
        if (userRole === 'master') {
            return next();
        }

        // Admin can manage clients and workers, but NOT admins or master
        if (userRole === 'admin') {
            if (targetRole === 'client' || targetRole === 'worker') {
                return next();
            }
            return res.status(403).json({
                success: false,
                error: 'You cannot manage this user type',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Workers cannot manage users
        return res.status(403).json({
            success: false,
            error: 'Access denied',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    };
};

module.exports = {
    requireAuth,
    requireMaster,
    requireMasterOrAdmin,
    requireStaff,
    requireClient,
    requireFinanceAccess,
    canManageUsers
};

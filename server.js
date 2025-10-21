const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Security: Require SESSION_SECRET from environment
if (!process.env.SESSION_SECRET) {
    console.error('❌ [FATAL] SESSION_SECRET is not defined in environment variables');
    console.error('   Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('   Add it to your .env file as: SESSION_SECRET=your_generated_secret');
    process.exit(1);
}

// Validate SESSION_SECRET strength
if (process.env.SESSION_SECRET.length < 32) {
    console.error('❌ [FATAL] SESSION_SECRET is too short (minimum 32 characters)');
    console.error('   Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
}

// Import database pool
const { pool } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - needed for rate limiting to work correctly behind Docker/nginx
app.set('trust proxy', 1);

// CORS Configuration - Whitelist approach
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://localhost:3001']; // Default for development

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, Postman, curl)
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`🚫 [CORS] Blocked request from unauthorized origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
    exposedHeaders: ['X-Correlation-Id']
};

// Global Correlation ID middleware
const { addCorrelationId } = require('./middleware/rateLimiter');
app.use(addCorrelationId);

// Security Headers Configuration
const isProd = process.env.NODE_ENV === 'production';
const helmetConfig = isProd ? {
    // Production: Strict CSP
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for React inline styles
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
} : {
    // Development: Relaxed CSP for localhost
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // needed for dev tools
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "http://localhost:*"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"]
        }
    }
};

// Middleware
app.use(helmet(helmetConfig));
app.use(morgan('dev'));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET, // No fallback - required from environment
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true', // HTTPS only in production with HTTPS
        httpOnly: true, // Prevent XSS attacks
        sameSite: 'lax', // CSRF protection
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));

// API Documentation (Swagger UI)
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load(path.join(__dirname, 'docs/openapi.yaml'));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Lavandaria API Docs'
}));

// Static files - uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health endpoints (no auth required)
app.use('/api', require('./routes/health'));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/properties', require('./routes/properties'));

// ⚠️ LEGACY ROUTES (DISABLED - Cutover executed on 2025-10-08)
// Return 410 Gone with migration guidance
app.use('/api/services', (req, res) => {
    console.log(`⚠️ [DEPRECATED] ${req.method} /api/services accessed - redirecting client to NEW endpoint`);
    res.status(410).json({
        error: 'Endpoint permanently moved',
        message: 'This API endpoint has been migrated to the new system.',
        newEndpoint: '/api/laundry-services',
        migration: 'All service catalog operations now use /api/laundry-services',
        timestamp: new Date().toISOString()
    });
});

app.use('/api/laundry', (req, res) => {
    console.log(`⚠️ [DEPRECATED] ${req.method} /api/laundry accessed - redirecting client to NEW endpoint`);
    res.status(410).json({
        error: 'Endpoint permanently moved',
        message: 'This API endpoint has been migrated to the new system.',
        newEndpoint: '/api/laundry-orders',
        migration: 'All laundry order operations now use /api/laundry-orders',
        timestamp: new Date().toISOString()
    });
});

app.use('/api/airbnb', (req, res) => {
    console.log(`⚠️ [DEPRECATED] ${req.method} /api/airbnb accessed - redirecting client to NEW endpoint`);
    res.status(410).json({
        error: 'Endpoint permanently moved',
        message: 'This API endpoint has been migrated to the new system.',
        newEndpoint: '/api/cleaning-jobs',
        migration: 'All cleaning job operations now use /api/cleaning-jobs',
        timestamp: new Date().toISOString()
    });
});

// ✅ NEW ROUTES (Active - Single Source of Truth)
app.use('/api/cleaning-jobs', require('./routes/cleaning-jobs'));      // NEW cleaning system
app.use('/api/laundry-orders', require('./routes/laundry-orders'));    // NEW laundry system
app.use('/api/laundry-services', require('./routes/laundry-services')); // NEW service catalog

// Shared Routes
app.use('/api/payments', require('./routes/payments'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/settings', require('./routes/settings'));

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'client/build')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

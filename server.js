const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import database pool
const { pool } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development, configure properly in production
}));
app.use(morgan('dev'));
app.use(cors({
    origin: true, // Allow same origin in production
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'lavandaria-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true only when using HTTPS
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));

// Static files - uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/services', require('./routes/services'));
app.use('/api/laundry', require('./routes/laundry'));
app.use('/api/airbnb', require('./routes/airbnb'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/cleaning-jobs', require('./routes/cleaning-jobs'));
app.use('/api/laundry-orders', require('./routes/laundry-orders'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/laundry-services', require('./routes/laundry-services'));

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

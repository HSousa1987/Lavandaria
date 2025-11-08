#!/usr/bin/env node

/**
 * Test Data Seeding Script for E2E Testing
 *
 * Creates minimal test data for Playwright E2E scenarios:
 * - Master, Admin, Worker, Client users with known credentials
 * - Laundry services
 * - Test cleaning job assigned to Worker and linked to Client
 * - Ensures uploads directory exists with correct permissions
 *
 * Usage: node scripts/seed-test-data.js
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'lavandaria',
    password: process.env.DB_PASSWORD || 'lavandaria2025',
    database: process.env.DB_NAME || 'lavandaria'
});

// Test credentials
const TEST_CREDENTIALS = {
    master: { username: 'master', password: 'master123' },
    admin: { username: 'admin', password: 'admin123' },
    worker: { username: 'worker1', password: 'worker123' },
    client: { phone: '911111111', password: 'lavandaria2025' }
};

async function ensureUploadsDirectory() {
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'cleaning_photos');

    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
        console.log(`✅ Created uploads directory: ${uploadsDir}`);
    } else {
        console.log(`✅ Uploads directory exists: ${uploadsDir}`);
    }
}

async function seedUsers() {
    console.log('\n📝 Seeding test users...');

    try {
        // Check if master exists
        const masterCheck = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [TEST_CREDENTIALS.master.username]
        );

        if (masterCheck.rows.length === 0) {
            const hashedPassword = await bcrypt.hash(TEST_CREDENTIALS.master.password, 10);
            await pool.query(
                `INSERT INTO users (username, password_hash, role, full_name, email, phone)
                 VALUES ($1, $2, 'master', 'Master User', 'master@lavandaria.test', '900000000')`,
                [TEST_CREDENTIALS.master.username, hashedPassword]
            );
            console.log(`✅ Created Master user: ${TEST_CREDENTIALS.master.username}`);
        } else {
            console.log(`✓  Master user exists: ${TEST_CREDENTIALS.master.username}`);
        }

        // Check if admin exists
        const adminCheck = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [TEST_CREDENTIALS.admin.username]
        );

        let adminId;
        if (adminCheck.rows.length === 0) {
            const hashedPassword = await bcrypt.hash(TEST_CREDENTIALS.admin.password, 10);
            const result = await pool.query(
                `INSERT INTO users (username, password_hash, role, full_name, email, phone)
                 VALUES ($1, $2, 'admin', 'Admin User', 'admin@lavandaria.test', '900000001')
                 RETURNING id`,
                [TEST_CREDENTIALS.admin.username, hashedPassword]
            );
            adminId = result.rows[0].id;
            console.log(`✅ Created Admin user: ${TEST_CREDENTIALS.admin.username}`);
        } else {
            adminId = adminCheck.rows[0].id;
            console.log(`✓  Admin user exists: ${TEST_CREDENTIALS.admin.username}`);
        }

        // Check if worker exists
        const workerCheck = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [TEST_CREDENTIALS.worker.username]
        );

        let workerId;
        if (workerCheck.rows.length === 0) {
            const hashedPassword = await bcrypt.hash(TEST_CREDENTIALS.worker.password, 10);
            const result = await pool.query(
                `INSERT INTO users (username, password_hash, role, full_name, email, phone)
                 VALUES ($1, $2, 'worker', 'Test Worker', 'worker@lavandaria.test', '900000002')
                 RETURNING id`,
                [TEST_CREDENTIALS.worker.username, hashedPassword]
            );
            workerId = result.rows[0].id;
            console.log(`✅ Created Worker user: ${TEST_CREDENTIALS.worker.username}`);
        } else {
            workerId = workerCheck.rows[0].id;
            console.log(`✓  Worker user exists: ${TEST_CREDENTIALS.worker.username}`);
        }

        return { adminId, workerId };
    } catch (error) {
        console.error('❌ Error seeding users:', error.message);
        throw error;
    }
}

async function seedClient() {
    console.log('\n📝 Seeding test client...');

    try {
        const clientCheck = await pool.query(
            'SELECT id FROM clients WHERE phone = $1',
            [TEST_CREDENTIALS.client.phone]
        );

        let clientId;
        if (clientCheck.rows.length === 0) {
            const hashedPassword = await bcrypt.hash(TEST_CREDENTIALS.client.password, 10);
            const result = await pool.query(
                `INSERT INTO clients (phone, password_hash, full_name, email, address, nif, must_change_password)
                 VALUES ($1, $2, 'Test Client', 'client@lavandaria.test', 'Rua Teste, 123, Lisboa', '123456789', false)
                 RETURNING id`,
                [TEST_CREDENTIALS.client.phone, hashedPassword]
            );
            clientId = result.rows[0].id;
            console.log(`✅ Created Client: ${TEST_CREDENTIALS.client.phone}`);
        } else {
            clientId = clientCheck.rows[0].id;
            console.log(`✓  Client exists: ${TEST_CREDENTIALS.client.phone}`);
        }

        return clientId;
    } catch (error) {
        console.error('❌ Error seeding client:', error.message);
        throw error;
    }
}

async function seedLaundryServices() {
    console.log('\n📝 Seeding laundry services...');

    // service_type must be one of: 'wash', 'dry_clean', 'iron', 'special'
    const services = [
        { name: 'Wash & Fold', service_type: 'wash', price: 8.00, unit: 'kg', duration: 1440 },
        { name: 'Dry Cleaning', service_type: 'dry_clean', price: 12.00, unit: 'item', duration: 2880 },
        { name: 'Iron Only', service_type: 'iron', price: 3.00, unit: 'item', duration: 720 },
        { name: 'Express Wash', service_type: 'special', price: 15.00, unit: 'kg', duration: 180 },
        { name: 'Delicate Care', service_type: 'special', price: 10.00, unit: 'kg', duration: 1440 }
    ];

    try {
        for (const service of services) {
            const check = await pool.query(
                'SELECT id FROM laundry_services WHERE name = $1 AND service_type = $2',
                [service.name, service.service_type]
            );

            if (check.rows.length === 0) {
                await pool.query(
                    `INSERT INTO laundry_services (name, service_type, base_price, unit, estimated_duration_minutes, is_active)
                     VALUES ($1, $2, $3, $4, $5, true)`,
                    [service.name, service.service_type, service.price, service.unit, service.duration]
                );
                console.log(`✅ Created service: ${service.name}`);
            } else {
                console.log(`✓  Service exists: ${service.name}`);
            }
        }
    } catch (error) {
        console.error('❌ Error seeding services:', error.message);
        throw error;
    }
}

async function seedCleaningJob(workerId, clientId, adminId) {
    console.log('\n📝 Seeding test cleaning job...');

    try {
        const jobCheck = await pool.query(
            `SELECT id FROM cleaning_jobs
             WHERE client_id = $1 AND assigned_worker_id = $2
             AND status = 'scheduled'
             LIMIT 1`,
            [clientId, workerId]
        );

        let jobId;
        if (jobCheck.rows.length === 0) {
            const result = await pool.query(
                `INSERT INTO cleaning_jobs (
                    client_id, job_type, property_name, property_address,
                    address_line1, city, postal_code, district, country,
                    scheduled_date, scheduled_time, assigned_worker_id,
                    estimated_hours, hourly_rate, status, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING id`,
                [
                    clientId,
                    'airbnb',  // Must be 'airbnb' or 'house'
                    'Test Apartment',
                    'Test Apartment, Avenida da Liberdade, 100',
                    'Avenida da Liberdade, 100',
                    'Lisboa',
                    '1200-001',
                    'Lisboa',
                    'Portugal',
                    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
                    '10:00',
                    workerId,
                    2.0,
                    15.00,
                    'scheduled',
                    adminId
                ]
            );
            jobId = result.rows[0].id;

            // Add worker to cleaning_job_workers junction table
            await pool.query(
                `INSERT INTO cleaning_job_workers (cleaning_job_id, worker_id, is_primary)
                 VALUES ($1, $2, true)
                 ON CONFLICT (cleaning_job_id, worker_id) DO NOTHING`,
                [jobId, workerId]
            );

            console.log(`✅ Created test cleaning job ID: ${jobId}`);
        } else {
            jobId = jobCheck.rows[0].id;
            console.log(`✓  Test cleaning job exists ID: ${jobId}`);
        }

        return jobId;
    } catch (error) {
        console.error('❌ Error seeding cleaning job:', error.message);
        throw error;
    }
}

async function main() {
    console.log('🚀 Starting test data seeding...\n');
    console.log('📊 Test Credentials:');
    console.log('   Master:', TEST_CREDENTIALS.master);
    console.log('   Admin:', TEST_CREDENTIALS.admin);
    console.log('   Worker:', TEST_CREDENTIALS.worker);
    console.log('   Client:', TEST_CREDENTIALS.client);

    try {
        // Ensure uploads directory exists
        await ensureUploadsDirectory();

        // Seed users
        const { adminId, workerId } = await seedUsers();

        // Seed client
        const clientId = await seedClient();

        // Seed services
        await seedLaundryServices();

        // Seed test cleaning job
        const jobId = await seedCleaningJob(workerId, clientId, adminId);

        console.log('\n✅ Test data seeding completed successfully!');
        console.log(`\n📋 Summary:`);
        console.log(`   Worker ID: ${workerId}`);
        console.log(`   Client ID: ${clientId}`);
        console.log(`   Test Job ID: ${jobId}`);
        console.log(`\n💡 You can now run Playwright tests with these credentials and test data.`);

    } catch (error) {
        console.error('\n❌ Fatal error during seeding:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { seedTestData: main, TEST_CREDENTIALS };

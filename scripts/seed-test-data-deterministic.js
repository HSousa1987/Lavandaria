#!/usr/bin/env node

/**
 * Deterministic Test Data Seeding Script for E2E Testing
 *
 * Creates FIXED, REPRODUCIBLE test data for Playwright E2E scenarios:
 * - Master, Admin, Worker, Client users with FIXED IDs and known credentials
 * - Cleaning job with FIXED ID assigned to Worker with FIXED ID
 * - 15 photos in 3 batches (5 photos each) with deterministic filenames
 * - Laundry order with status transitions (received → in_progress → ready)
 * - Idempotent: Can run multiple times without duplicates (DELETE then INSERT)
 *
 * Usage: node scripts/seed-test-data-deterministic.js
 *
 * Key Changes from Original:
 * 1. IDEMPOTENT: Deletes test data before inserting (uses transaction)
 * 2. FIXED IDS: Uses ON CONFLICT to ensure same IDs every run
 * 3. DETERMINISTIC PHOTOS: Creates 15 test photos with known IDs
 * 4. PHOTO BATCHES: 3 batches to test pagination (5 photos per batch)
 * 5. STATUS TRANSITIONS: Laundry order demonstrates lifecycle
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

// Fixed test credentials (DETERMINISTIC)
const TEST_CREDENTIALS = {
    master: { username: 'master', password: 'master123' },
    admin: { username: 'admin', password: 'admin123' },
    worker: { username: 'worker1', password: 'worker123' },
    client: { phone: '911111111', password: 'lavandaria2025' }
};

// Fixed IDs for deterministic testing
const FIXED_IDS = {
    master: 1,
    admin: 2,
    worker: 3,
    client: 1,
    cleaningJob: 100,
    laundryOrder: 200
};

async function ensureUploadsDirectory() {
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'cleaning_photos');

    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
        console.log(`✅ Created uploads directory: ${uploadsDir}`);
    } else {
        console.log(`✅ Uploads directory exists: ${uploadsDir}`);
    }

    return uploadsDir;
}

async function createDummyPhotoFiles(uploadsDir) {
    console.log('\n📸 Creating dummy photo files for testing...');

    const photoFiles = [];
    const photoTypes = ['before', 'after', 'detail'];
    const rooms = ['kitchen', 'bathroom', 'bedroom', 'living_room', 'hallway'];

    // Create 15 test photos (3 batches × 5 photos)
    for (let batch = 1; batch <= 3; batch++) {
        for (let i = 1; i <= 5; i++) {
            const photoNum = (batch - 1) * 5 + i;
            const filename = `test-photo-${photoNum.toString().padStart(2, '0')}.jpg`;
            const filepath = path.join(uploadsDir, filename);
            const photoType = photoTypes[(photoNum - 1) % 3]; // Rotate types
            const room = rooms[(photoNum - 1) % 5]; // Rotate rooms

            // Create a minimal 1x1 pixel JPEG if it doesn't exist
            if (!fs.existsSync(filepath)) {
                // Minimal valid JPEG (1x1 pixel, white)
                const minimalJpeg = Buffer.from([
                    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
                    0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
                    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
                    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
                    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
                    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
                    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08,
                    0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7F, 0xFF, 0xD9
                ]);
                fs.writeFileSync(filepath, minimalJpeg);
            }

            photoFiles.push({
                filename,
                filepath,
                photoType,
                room,
                caption: `Test ${photoType} photo of ${room} (batch ${batch})`,
                fileSize: Math.floor(fs.statSync(filepath).size / 1024) // KB
            });
        }
    }

    console.log(`✅ Created ${photoFiles.length} dummy photo files`);
    return photoFiles;
}

async function cleanupTestData(client) {
    console.log('\n🧹 Cleaning up existing test data...');

    try {
        // Delete in reverse dependency order
        await client.query(`DELETE FROM cleaning_job_photos WHERE cleaning_job_id = $1`, [FIXED_IDS.cleaningJob]);
        await client.query(`DELETE FROM cleaning_job_workers WHERE cleaning_job_id = $1`, [FIXED_IDS.cleaningJob]);
        await client.query(`DELETE FROM cleaning_jobs WHERE id = $1`, [FIXED_IDS.cleaningJob]);
        await client.query(`DELETE FROM laundry_order_items WHERE laundry_order_id = $1`, [FIXED_IDS.laundryOrder]);
        await client.query(`DELETE FROM laundry_orders_new WHERE id = $1`, [FIXED_IDS.laundryOrder]);
        await client.query(`DELETE FROM clients WHERE id = $1`, [FIXED_IDS.client]);
        await client.query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [FIXED_IDS.master, FIXED_IDS.admin, FIXED_IDS.worker]);

        console.log('✅ Cleanup completed');
    } catch (error) {
        console.error('⚠️  Cleanup error (may be first run):', error.message);
        // Don't throw - continue with seeding even if cleanup fails
    }
}

async function seedUsersWithFixedIds(client) {
    console.log('\n📝 Seeding users with FIXED IDs...');

    const hashedMaster = await bcrypt.hash(TEST_CREDENTIALS.master.password, 10);
    const hashedAdmin = await bcrypt.hash(TEST_CREDENTIALS.admin.password, 10);
    const hashedWorker = await bcrypt.hash(TEST_CREDENTIALS.worker.password, 10);

    // Insert with explicit IDs
    await client.query(`
        INSERT INTO users (id, username, password, role, full_name, email, phone)
        VALUES
            ($1, $2, $3, 'master', 'Master User', 'master@lavandaria.test', '900000000'),
            ($4, $5, $6, 'admin', 'Admin User', 'admin@lavandaria.test', '900000001'),
            ($7, $8, $9, 'worker', 'Test Worker', 'worker@lavandaria.test', '900000002')
        ON CONFLICT (id) DO UPDATE SET
            password = EXCLUDED.password
    `, [
        FIXED_IDS.master, TEST_CREDENTIALS.master.username, hashedMaster,
        FIXED_IDS.admin, TEST_CREDENTIALS.admin.username, hashedAdmin,
        FIXED_IDS.worker, TEST_CREDENTIALS.worker.username, hashedWorker
    ]);

    console.log(`✅ Created Master (ID: ${FIXED_IDS.master}): ${TEST_CREDENTIALS.master.username}`);
    console.log(`✅ Created Admin (ID: ${FIXED_IDS.admin}): ${TEST_CREDENTIALS.admin.username}`);
    console.log(`✅ Created Worker (ID: ${FIXED_IDS.worker}): ${TEST_CREDENTIALS.worker.username}`);

    return { masterId: FIXED_IDS.master, adminId: FIXED_IDS.admin, workerId: FIXED_IDS.worker };
}

async function seedClientWithFixedId(client) {
    console.log('\n📝 Seeding client with FIXED ID...');

    const hashedPassword = await bcrypt.hash(TEST_CREDENTIALS.client.password, 10);

    await client.query(`
        INSERT INTO clients (id, phone, password, full_name, email, nif, must_change_password)
        VALUES ($1, $2, $3, 'Test Client', 'client@lavandaria.test', '123456789', false)
        ON CONFLICT (id) DO UPDATE SET
            password = EXCLUDED.password,
            must_change_password = false
    `, [FIXED_IDS.client, TEST_CREDENTIALS.client.phone, hashedPassword]);

    console.log(`✅ Created Client (ID: ${FIXED_IDS.client}): ${TEST_CREDENTIALS.client.phone}`);
    return FIXED_IDS.client;
}

async function seedCleaningJobWithPhotos(client, workerId, clientId, adminId, photoFiles) {
    console.log('\n📝 Seeding cleaning job with FIXED ID and photos...');

    // Create cleaning job
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await client.query(`
        INSERT INTO cleaning_jobs (
            id, client_id, job_type, property_name, property_address,
            address_line1, city, postal_code, district, country,
            scheduled_date, scheduled_time, assigned_worker_id,
            estimated_hours, hourly_rate, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
            assigned_worker_id = EXCLUDED.assigned_worker_id,
            status = EXCLUDED.status
    `, [
        FIXED_IDS.cleaningJob, clientId, 'airbnb', 'Test Airbnb Apartment',
        'Avenida da Liberdade, 100, Lisboa',
        'Avenida da Liberdade, 100', 'Lisboa', '1200-001', 'Lisboa', 'Portugal',
        tomorrow, '10:00', workerId,
        2.0, 15.00, 'in_progress', adminId
    ]);

    // Add worker to junction table
    await client.query(`
        INSERT INTO cleaning_job_workers (cleaning_job_id, worker_id, is_primary)
        VALUES ($1, $2, true)
        ON CONFLICT (cleaning_job_id, worker_id) DO NOTHING
    `, [FIXED_IDS.cleaningJob, workerId]);

    console.log(`✅ Created cleaning job (ID: ${FIXED_IDS.cleaningJob})`);

    // Insert photos
    console.log(`📸 Inserting ${photoFiles.length} photos...`);

    for (const photo of photoFiles) {
        await client.query(`
            INSERT INTO cleaning_job_photos (
                cleaning_job_id, worker_id, photo_url, photo_type,
                room_area, caption, file_size_kb, original_filename,
                uploaded_at, viewed_by_client
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), false)
        `, [
            FIXED_IDS.cleaningJob,
            workerId,
            `/uploads/cleaning_photos/${photo.filename}`,
            photo.photoType,
            photo.room,
            photo.caption,
            photo.fileSize,
            photo.filename
        ]);
    }

    console.log(`✅ Inserted ${photoFiles.length} photos for job ${FIXED_IDS.cleaningJob}`);
    return FIXED_IDS.cleaningJob;
}

async function seedLaundryOrderWithTransitions(client, clientId) {
    console.log('\n📝 Seeding laundry order with FIXED ID...');

    await client.query(`
        INSERT INTO laundry_orders_new (
            id, client_id, order_number, status, order_type, total_weight_kg,
            total_price, internal_notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            order_number = EXCLUDED.order_number
    `, [
        FIXED_IDS.laundryOrder,
        clientId,
        `TEST-ORDER-${FIXED_IDS.laundryOrder}`, // Unique order number
        'ready', // Status for testing (received → in_progress → ready)
        'bulk_kg',
        5.5,
        19.25,
        'Test laundry order for E2E testing'
    ]);

    console.log(`✅ Created laundry order (ID: ${FIXED_IDS.laundryOrder}) with status: ready`);
    return FIXED_IDS.laundryOrder;
}

async function main() {
    console.log('🚀 Starting DETERMINISTIC test data seeding...\n');
    console.log('🔒 Fixed Test Credentials:');
    console.log(`   Master (ID: ${FIXED_IDS.master}):`, TEST_CREDENTIALS.master);
    console.log(`   Admin (ID: ${FIXED_IDS.admin}):`, TEST_CREDENTIALS.admin);
    console.log(`   Worker (ID: ${FIXED_IDS.worker}):`, TEST_CREDENTIALS.worker);
    console.log(`   Client (ID: ${FIXED_IDS.client}):`, TEST_CREDENTIALS.client);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Ensure uploads directory and create dummy photos
        const uploadsDir = await ensureUploadsDirectory();
        const photoFiles = await createDummyPhotoFiles(uploadsDir);

        // Cleanup existing test data (idempotent)
        await cleanupTestData(client);

        // Seed with fixed IDs
        const { adminId, workerId } = await seedUsersWithFixedIds(client);
        const clientId = await seedClientWithFixedId(client);
        const jobId = await seedCleaningJobWithPhotos(client, workerId, clientId, adminId, photoFiles);
        const orderId = await seedLaundryOrderWithTransitions(client, clientId);

        await client.query('COMMIT');

        console.log('\n✅ DETERMINISTIC test data seeding completed successfully!');
        console.log(`\n📋 Fixed IDs Summary:`);
        console.log(`   Master ID: ${FIXED_IDS.master}`);
        console.log(`   Admin ID: ${FIXED_IDS.admin}`);
        console.log(`   Worker ID: ${FIXED_IDS.worker}`);
        console.log(`   Client ID: ${FIXED_IDS.client}`);
        console.log(`   Cleaning Job ID: ${FIXED_IDS.cleaningJob} (${photoFiles.length} photos)`);
        console.log(`   Laundry Order ID: ${FIXED_IDS.laundryOrder}`);
        console.log(`\n💡 Data is IDEMPOTENT - you can run this script multiple times.`);
        console.log(`💡 Tests will find EXACTLY these IDs and photo counts every time.`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Fatal error during seeding:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal:', error);
        process.exit(1);
    });
}

module.exports = { seedDeterministicTestData: main, TEST_CREDENTIALS, FIXED_IDS };

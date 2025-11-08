/**
 * Entity Builder: Seedless test data creation utilities
 *
 * Implements Human-Journey testing pattern:
 * - Master creates Admin
 * - Admin creates Worker & Client
 * - Admin creates Cleaning Job & assigns Worker
 * - Worker uploads photos
 * - Client views photos
 *
 * NO hardcoded IDs. NO pre-seeded data. ALL entities created dynamically.
 */

const { test, expect } = require('@playwright/test');

/**
 * Generate unique username with timestamp to avoid collisions
 * @param {string} prefix - Username prefix (e.g., 'worker', 'admin', 'client')
 * @returns {string} Unique username
 */
function generateUniqueUsername(prefix = 'user') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate unique phone number for Portuguese format
 * @returns {string} Unique phone number (9 digits starting with 9)
 */
function generateUniquePhone() {
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits
    return `9${timestamp}`;
}

/**
 * Login as Master user (assumes Master exists in bootstrapped system)
 * @param {import('@playwright/test').Page} page - Playwright page
 * @returns {Promise<{success: boolean, userId: number, username: string}>}
 */
async function loginAsMaster(page) {
    console.log('🔐 [Entity Builder] Logging in as Master...');

    await page.goto('/');

    // Select Staff tab
    await page.click('button:has-text("Staff")');

    // Use master credentials (bootstrapped in DB init)
    await page.fill('input[name="username"]', 'master');
    await page.fill('input[name="password"]', 'master123');

    // Capture login response
    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/auth/login/user') &&
                    response.request().method() === 'POST'
    );

    await page.click('button[type="submit"]');

    const response = await responsePromise;
    const result = await response.json();

    if (!result.success) {
        throw new Error(`Master login failed: ${result.error || 'Unknown error'}`);
    }

    await page.waitForURL('/dashboard', { timeout: 10000 });

    console.log(`✅ [Entity Builder] Master logged in: ID=${result.user.id}`);

    return {
        success: true,
        userId: result.user.id,
        username: result.user.username,
        role: 'master'
    };
}

/**
 * Create Admin user via Master session
 * @param {import('@playwright/test').Page} page - Playwright page (must be logged in as Master)
 * @param {Object} masterCtx - Master context from loginAsMaster()
 * @returns {Promise<{userId: number, username: string, phone: string, password: string}>}
 */
async function createAdmin(page, masterCtx) {
    console.log('👤 [Entity Builder] Creating Admin...');

    const phone = generateUniquePhone();
    const password = 'admin123test';
    const firstName = 'Admin';
    const lastName = 'Test';

    // Navigate to Dashboard (should already be there after login)
    await page.goto('/dashboard');
    await page.waitForTimeout(500);

    // Click "All Users" tab
    await page.click('button:has-text("All Users")');
    await page.waitForTimeout(300);

    // Click "Add User" button (Master sees "Add User", Admin sees "Add Worker")
    await page.click('button:has-text("Add User")');
    await page.waitForTimeout(300);

    // Fill form
    await page.selectOption('select[name="role"]', 'admin');
    await page.fill('input[name="first_name"]', firstName);
    await page.fill('input[name="last_name"]', lastName);
    await page.fill('input[name="phone"]', phone);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="email"]', `admin_${phone}@test.lavandaria.pt`);

    // Capture create response
    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/users') &&
                    response.request().method() === 'POST',
        { timeout: 10000 }
    );

    await page.click('button[type="submit"]:has-text("Create")');

    const response = await responsePromise;
    const result = await response.json();

    if (!result.id) {
        throw new Error(`Admin creation failed: ${JSON.stringify(result)}`);
    }

    console.log(`✅ [Entity Builder] Admin created: ID=${result.id}, phone=${phone}`);

    return {
        userId: result.id,
        username: phone, // Username is phone number
        phone: phone,
        password: password,
        firstName: firstName,
        lastName: lastName,
        role: 'admin'
    };
}

/**
 * Login as Admin user
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} adminData - Admin data from createAdmin()
 * @returns {Promise<{success: boolean, userId: number, username: string}>}
 */
async function loginAsAdmin(page, adminData) {
    console.log(`🔐 [Entity Builder] Logging in as Admin (${adminData.username})...`);

    await page.goto('/');

    // Select Staff tab
    await page.click('button:has-text("Staff")');

    await page.fill('input[name="username"]', adminData.username);
    await page.fill('input[name="password"]', adminData.password);

    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/auth/login/user') &&
                    response.request().method() === 'POST'
    );

    await page.click('button[type="submit"]');

    const response = await responsePromise;
    const result = await response.json();

    if (!result.success) {
        throw new Error(`Admin login failed: ${result.error || 'Unknown error'}`);
    }

    await page.waitForURL('/dashboard', { timeout: 10000 });

    console.log(`✅ [Entity Builder] Admin logged in: ID=${result.user.id}`);

    return {
        success: true,
        userId: result.user.id,
        username: result.user.username,
        role: 'admin',
        ...adminData
    };
}

/**
 * Create Worker user via Admin session
 * @param {import('@playwright/test').Page} page - Playwright page (must be logged in as Admin)
 * @param {Object} adminCtx - Admin context from loginAsAdmin()
 * @returns {Promise<{userId: number, username: string, phone: string, password: string}>}
 */
async function createWorker(page, adminCtx) {
    console.log('👷 [Entity Builder] Creating Worker...');

    const phone = generateUniquePhone();
    const password = 'worker123test';
    const firstName = 'Worker';
    const lastName = 'Test';

    // Navigate to Dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(500);

    // Click "Workers" tab (Admin sees "Workers", Master sees "All Users")
    const usersTabButton = page.locator('button:has-text("Workers"), button:has-text("All Users")').first();
    await usersTabButton.click();
    await page.waitForTimeout(300);

    // Click "Add Worker" button (Admin sees "Add Worker")
    await page.click('button:has-text("Add Worker")');
    await page.waitForTimeout(300);

    // Fill form (Admin can only create workers)
    await page.selectOption('select[name="role"]', 'worker');
    await page.fill('input[name="first_name"]', firstName);
    await page.fill('input[name="last_name"]', lastName);
    await page.fill('input[name="phone"]', phone);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="email"]', `worker_${phone}@test.lavandaria.pt`);

    // Capture create response
    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/users') &&
                    response.request().method() === 'POST',
        { timeout: 10000 }
    );

    await page.click('button[type="submit"]:has-text("Create")');

    const response = await responsePromise;
    const result = await response.json();

    if (!result.id) {
        throw new Error(`Worker creation failed: ${JSON.stringify(result)}`);
    }

    console.log(`✅ [Entity Builder] Worker created: ID=${result.id}, phone=${phone}`);

    return {
        userId: result.id,
        username: phone,
        phone: phone,
        password: password,
        firstName: firstName,
        lastName: lastName,
        role: 'worker'
    };
}

/**
 * Login as Worker user
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} workerData - Worker data from createWorker()
 * @returns {Promise<{success: boolean, userId: number, username: string}>}
 */
async function loginAsWorker(page, workerData) {
    console.log(`🔐 [Entity Builder] Logging in as Worker (${workerData.username})...`);

    await page.goto('/');

    // Select Staff tab
    await page.click('button:has-text("Staff")');

    await page.fill('input[name="username"]', workerData.username);
    await page.fill('input[name="password"]', workerData.password);

    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/auth/login/user') &&
                    response.request().method() === 'POST'
    );

    await page.click('button[type="submit"]');

    const response = await responsePromise;
    const result = await response.json();

    if (!result.success) {
        throw new Error(`Worker login failed: ${result.error || 'Unknown error'}`);
    }

    await page.waitForURL('/dashboard', { timeout: 10000 });

    console.log(`✅ [Entity Builder] Worker logged in: ID=${result.user.id}`);

    return {
        success: true,
        userId: result.user.id,
        username: result.user.username,
        role: 'worker',
        ...workerData
    };
}

/**
 * Create Client via Admin session
 * @param {import('@playwright/test').Page} page - Playwright page (must be logged in as Admin)
 * @param {Object} adminCtx - Admin context from loginAsAdmin()
 * @returns {Promise<{clientId: number, phone: string, password: string}>}
 */
async function createClient(page, adminCtx) {
    console.log('👥 [Entity Builder] Creating Client...');

    const phone = generateUniquePhone();
    const password = 'lavandaria2025'; // Default client password
    const firstName = 'Client';
    const lastName = 'Test';

    // Navigate to Dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(500);

    // Click "Clients" tab
    await page.click('button:has-text("Clients")');
    await page.waitForTimeout(300);

    // Click "Add Client" button
    await page.click('button:has-text("Add Client")');
    await page.waitForTimeout(300);

    // Fill form
    await page.fill('input[name="first_name"]', firstName);
    await page.fill('input[name="last_name"]', lastName);
    await page.fill('input[name="phone"]', phone);
    await page.fill('input[name="email"]', `client_${phone}@test.lavandaria.pt`);
    await page.fill('input[name="address_line1"]', 'Rua Test 123');
    await page.fill('input[name="city"]', 'Lisboa');
    await page.fill('input[name="postal_code"]', '1000-001');

    // Capture create response
    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/clients') &&
                    response.request().method() === 'POST',
        { timeout: 10000 }
    );

    await page.click('button[type="submit"]:has-text("Create")');

    const response = await responsePromise;
    const result = await response.json();

    if (!result.id) {
        throw new Error(`Client creation failed: ${JSON.stringify(result)}`);
    }

    console.log(`✅ [Entity Builder] Client created: ID=${result.id}, phone=${phone}`);

    return {
        clientId: result.id,
        phone: phone,
        password: password, // Default password
        firstName: firstName,
        lastName: lastName
    };
}

/**
 * Login as Client user
 * @param {import('@playwright/test').Page} page - Playwright page
 * @param {Object} clientData - Client data from createClient()
 * @returns {Promise<{success: boolean, clientId: number, phone: string}>}
 */
async function loginAsClient(page, clientData) {
    console.log(`🔐 [Entity Builder] Logging in as Client (${clientData.phone})...`);

    await page.goto('/');

    // Select Client tab
    await page.click('button:has-text("Client")');

    await page.fill('input[name="phone"]', clientData.phone);
    await page.fill('input[name="password"]', clientData.password);

    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/auth/login/client') &&
                    response.request().method() === 'POST'
    );

    await page.click('button[type="submit"]');

    const response = await responsePromise;
    const result = await response.json();

    if (!result.success) {
        throw new Error(`Client login failed: ${result.error || 'Unknown error'}`);
    }

    await page.waitForURL('/dashboard', { timeout: 10000 });

    console.log(`✅ [Entity Builder] Client logged in: ID=${result.client.id}`);

    return {
        success: true,
        clientId: result.client.id,
        phone: result.client.phone,
        ...clientData
    };
}

/**
 * Create Cleaning Job via Admin session
 * @param {import('@playwright/test').Page} page - Playwright page (must be logged in as Admin)
 * @param {Object} adminCtx - Admin context
 * @param {Object} options - Job options
 * @param {number} options.clientId - Client ID
 * @param {string} options.propertyAddress - Property address
 * @param {string} options.scheduledDate - Scheduled date (YYYY-MM-DD)
 * @param {string} options.jobType - Job type ('airbnb' or 'house')
 * @param {number} [options.assignedWorkerId] - Optional worker ID to assign
 * @returns {Promise<{jobId: number, clientId: number, assignedWorkerId: number|null}>}
 */
async function createCleaningJob(page, adminCtx, options) {
    const {
        clientId,
        propertyAddress = 'Test Property, Rua Test 456',
        scheduledDate = new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
        jobType = 'airbnb',
        assignedWorkerId = null
    } = options;

    console.log(`🧹 [Entity Builder] Creating Cleaning Job for client ${clientId}...`);

    // Navigate to Dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(500);

    // Click "Cleaning Jobs" or "Jobs" tab
    const jobsTab = page.locator('button:has-text("Cleaning Jobs"), button:has-text("Jobs")').first();
    await jobsTab.click();
    await page.waitForTimeout(300);

    // Click "Schedule Job" button
    await page.click('button:has-text("Schedule Job")');
    await page.waitForTimeout(300);

    // Fill form
    await page.selectOption('select[name="client_id"]', clientId.toString());
    await page.selectOption('select[name="job_type"]', jobType);
    await page.fill('input[name="property_name"]', 'Test Property');
    await page.fill('input[name="address_line1"]', 'Rua Test 456');
    await page.fill('input[name="city"]', 'Porto');
    await page.fill('input[name="postal_code"]', '4000-001');
    await page.fill('input[name="scheduled_date"]', scheduledDate);
    await page.fill('input[name="scheduled_time"]', '10:00');

    if (assignedWorkerId) {
        await page.selectOption('select[name="assigned_worker_ids"]', assignedWorkerId.toString());
    }

    // Capture create response
    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/cleaning-jobs') &&
                    response.request().method() === 'POST',
        { timeout: 10000 }
    );

    await page.click('button[type="submit"]:has-text("Create")');

    const response = await responsePromise;
    const result = await response.json();

    if (!result.id) {
        throw new Error(`Job creation failed: ${JSON.stringify(result)}`);
    }

    console.log(`✅ [Entity Builder] Cleaning Job created: ID=${result.id}`);

    return {
        jobId: result.id,
        clientId: clientId,
        assignedWorkerId: assignedWorkerId,
        propertyAddress: propertyAddress,
        scheduledDate: scheduledDate,
        jobType: jobType
    };
}

/**
 * Assign Worker to Job via API (direct approach for tests)
 * @param {import('@playwright/test').Page} page - Playwright page (must be logged in as Admin)
 * @param {Object} adminCtx - Admin context
 * @param {number} jobId - Job ID
 * @param {number} workerId - Worker ID
 * @returns {Promise<{success: boolean}>}
 */
async function assignWorkerToJob(page, adminCtx, jobId, workerId) {
    console.log(`🔗 [Entity Builder] Assigning worker ${workerId} to job ${jobId}...`);

    // Navigate to job details
    await page.goto(`/cleaning-jobs/${jobId}`);
    await page.waitForTimeout(500);

    // Click "Edit Job" button
    await page.click('button:has-text("Edit Job")');
    await page.waitForSelector('select[name="assigned_worker_ids"]', { timeout: 5000 });

    // Select worker
    await page.selectOption('select[name="assigned_worker_ids"]', workerId.toString());

    // Capture update response
    const responsePromise = page.waitForResponse(
        response => response.url().includes(`/api/cleaning-jobs/${jobId}`) &&
                    response.request().method() === 'PUT',
        { timeout: 10000 }
    );

    await page.click('button[type="submit"]:has-text("Save")');

    const response = await responsePromise;
    const result = await response.json();

    if (!result.id) {
        throw new Error(`Worker assignment failed: ${JSON.stringify(result)}`);
    }

    console.log(`✅ [Entity Builder] Worker ${workerId} assigned to job ${jobId}`);

    return {
        success: true,
        jobId: jobId,
        workerId: workerId
    };
}

module.exports = {
    generateUniqueUsername,
    generateUniquePhone,
    loginAsMaster,
    createAdmin,
    loginAsAdmin,
    createWorker,
    loginAsWorker,
    createClient,
    loginAsClient,
    createCleaningJob,
    assignWorkerToJob
};

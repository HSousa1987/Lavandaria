/**
 * UI Entity Builder - 100% UI Interactions (No API Calls)
 *
 * Purpose: For the Golden Path test requiring full human-journey via UI.
 * All entity creation happens through browser UI interactions (forms, buttons, modals).
 *
 * Each function:
 * - Navigates UI step-by-step
 * - Waits for XHR responses with envelope validation
 * - Asserts X-Correlation-Id header matches _meta.correlationId
 * - Captures console errors and fails test if found
 * - Returns created entity data
 */

const { expect } = require('@playwright/test');

/**
 * Generate unique username/phone to avoid collisions
 */
function generateUniquePhone() {
    const timestamp = Date.now().toString().slice(-8);
    return `9${timestamp}`;
}

/**
 * Setup console error capture
 * @param {import('@playwright/test').Page} page
 * @returns {Array} consoleErrors array
 */
function setupConsoleErrorCapture(page) {
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });
    return consoleErrors;
}

/**
 * Login as Master via UI
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{userId: number, username: string, role: string, consoleErrors: Array}>}
 */
async function loginAsMaster(page) {
    console.log('🔐 [UI] Logging in as Master...');
    const consoleErrors = setupConsoleErrorCapture(page);

    await page.goto('/');

    // Click "Staff" login button
    await page.click('button:has-text("Staff")');
    await page.waitForTimeout(300);

    // Fill login form
    await page.fill('input[name="username"]', 'master');
    await page.fill('input[name="password"]', 'master123');

    // Wait for login response
    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/auth/login/user') &&
                    response.request().method() === 'POST'
    );

    await page.click('button[type="submit"]');
    const response = await responsePromise;
    const result = await response.json();

    // Validate envelope
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('_meta');
    expect(result._meta).toHaveProperty('correlationId');
    expect(result._meta.correlationId).toMatch(/^req_/);

    // Validate correlation header
    const correlationHeader = response.headers()['x-correlation-id'];
    expect(correlationHeader).toBeDefined();
    expect(correlationHeader).toBe(result._meta.correlationId);

    await page.waitForURL('/dashboard', { timeout: 10000 });

    console.log(`✅ Master logged in: ${result.user.username} (ID: ${result.user.id})`);
    console.log(`   Correlation ID: ${result._meta.correlationId}`);

    return {
        userId: result.user.id,
        username: result.user.username,
        role: 'master',
        consoleErrors
    };
}

/**
 * Create Admin via UI (Master must be logged in)
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{userId: number, username: string, phone: string, password: string, role: string, consoleErrors: Array}>}
 */
async function uiCreateAdmin(page) {
    console.log('👤 [UI] Creating Admin via UI...');
    const consoleErrors = setupConsoleErrorCapture(page);

    const phone = generateUniquePhone();
    const password = 'admin123test';
    const email = `admin_${phone}@test.lavandaria.pt`;

    // Navigate to All Users tab
    await page.goto('/dashboard');
    await page.waitForTimeout(500);
    await page.click('button:has-text("All Users")');
    await page.waitForTimeout(500);

    // Click Add User button
    await page.click('button:has-text("Add User")');
    await page.waitForTimeout(500);

    // Wait for modal/form to appear
    await page.waitForSelector('text=Add New User', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Fill form fields (using labels + position since no name attributes)
    // Role dropdown
    const roleSelect = page.locator('label:has-text("Role")').locator('..').locator('select');
    await roleSelect.selectOption('admin');

    // Password
    const passwordField = page.locator('label:has-text("Password")').locator('..').locator('input');
    await passwordField.fill(password);

    // First Name
    const firstNameField = page.locator('label:has-text("First Name")').locator('..').locator('input');
    await firstNameField.fill('Admin');

    // Last Name
    const lastNameField = page.locator('label:has-text("Last Name")').locator('..').locator('input');
    await lastNameField.fill('Test');

    // Phone
    const phoneField = page.locator('label:has-text("Phone")').locator('..').locator('input');
    await phoneField.fill(phone);

    // Email
    const emailField = page.locator('label:has-text("Email")').locator('..').locator('input');
    await emailField.fill(email);

    // Address Line 1
    const addressField = page.locator('label:has-text("Address Line 1")').locator('..').locator('input');
    await addressField.fill('Rua Admin 123');

    // City
    const cityField = page.locator('label:has-text("City")').locator('..').locator('input');
    await cityField.fill('Lisboa');

    // Postal Code
    const postalField = page.locator('label:has-text("Postal Code")').locator('..').locator('input');
    await postalField.fill('1000-001');

    // Wait for create response
    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/users') &&
                    response.request().method() === 'POST'
    );

    await page.click('button:has-text("Create User")');
    const response = await responsePromise;
    const result = await response.json();

    // Validate envelope
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('_meta');
    expect(result._meta).toHaveProperty('correlationId');
    expect(result._meta.correlationId).toMatch(/^req_/);

    // Validate correlation header
    const correlationHeader = response.headers()['x-correlation-id'];
    expect(correlationHeader).toBeDefined();
    expect(correlationHeader).toBe(result._meta.correlationId);

    console.log(`✅ Admin created: ${phone} (ID: ${result.id})`);
    console.log(`   Correlation ID: ${result._meta.correlationId}`);

    return {
        userId: result.id,
        username: phone,
        phone: phone,
        password: password,
        role: 'admin',
        consoleErrors
    };
}

/**
 * Login as Admin via UI
 * @param {import('@playwright/test').Page} page
 * @param {{username: string, password: string}} adminData
 * @returns {Promise<{userId: number, username: string, role: string, consoleErrors: Array}>}
 */
async function loginAsAdmin(page, adminData) {
    console.log(`🔐 [UI] Logging in as Admin: ${adminData.username}...`);
    const consoleErrors = setupConsoleErrorCapture(page);

    await page.goto('/');

    // Click "Staff" login button
    await page.click('button:has-text("Staff")');
    await page.waitForTimeout(300);

    // Fill login form
    await page.fill('input[name="username"]', adminData.username);
    await page.fill('input[name="password"]', adminData.password);

    // Wait for login response
    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/auth/login/user') &&
                    response.request().method() === 'POST'
    );

    await page.click('button[type="submit"]');
    const response = await responsePromise;
    const result = await response.json();

    // Validate envelope
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('_meta');
    expect(result._meta).toHaveProperty('correlationId');
    expect(result._meta.correlationId).toMatch(/^req_/);

    // Validate correlation header
    const correlationHeader = response.headers()['x-correlation-id'];
    expect(correlationHeader).toBeDefined();
    expect(correlationHeader).toBe(result._meta.correlationId);

    await page.waitForURL('/dashboard', { timeout: 10000 });

    console.log(`✅ Admin logged in: ${result.user.username} (ID: ${result.user.id})`);
    console.log(`   Correlation ID: ${result._meta.correlationId}`);

    return {
        userId: result.user.id,
        username: result.user.username,
        role: 'admin',
        consoleErrors
    };
}

/**
 * Create Worker via UI (Admin must be logged in)
 * Note: Workers are created via "Add User" form with role=worker
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{userId: number, username: string, phone: string, password: string, role: string, consoleErrors: Array}>}
 */
async function uiCreateWorker(page) {
    console.log('👷 [UI] Creating Worker via UI...');
    const consoleErrors = setupConsoleErrorCapture(page);

    const phone = generateUniquePhone();
    const password = 'worker123test';
    const email = `worker_${phone}@test.lavandaria.pt`;

    // Navigate to All Users tab (workers are created here)
    await page.goto('/dashboard');
    await page.waitForTimeout(500);
    await page.click('button:has-text("All Users")');
    await page.waitForTimeout(500);

    // Click Add User button
    await page.click('button:has-text("Add User")');
    await page.waitForTimeout(500);

    // Wait for modal/form to appear
    await page.waitForSelector('text=Add New User', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Fill form fields
    // Role dropdown
    const roleSelect = page.locator('label:has-text("Role")').locator('..').locator('select');
    await roleSelect.selectOption('worker');

    // Password
    const passwordField = page.locator('label:has-text("Password")').locator('..').locator('input');
    await passwordField.fill(password);

    // First Name
    const firstNameField = page.locator('label:has-text("First Name")').locator('..').locator('input');
    await firstNameField.fill('Worker');

    // Last Name
    const lastNameField = page.locator('label:has-text("Last Name")').locator('..').locator('input');
    await lastNameField.fill('Test');

    // Phone
    const phoneField = page.locator('label:has-text("Phone")').locator('..').locator('input');
    await phoneField.fill(phone);

    // Email
    const emailField = page.locator('label:has-text("Email")').locator('..').locator('input');
    await emailField.fill(email);

    // Address Line 1
    const addressField = page.locator('label:has-text("Address Line 1")').locator('..').locator('input');
    await addressField.fill('Rua Worker 456');

    // City
    const cityField = page.locator('label:has-text("City")').locator('..').locator('input');
    await cityField.fill('Porto');

    // Postal Code
    const postalField = page.locator('label:has-text("Postal Code")').locator('..').locator('input');
    await postalField.fill('4000-001');

    // Wait for create response
    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/users') &&
                    response.request().method() === 'POST'
    );

    await page.click('button:has-text("Create User")');
    const response = await responsePromise;
    const result = await response.json();

    // Validate envelope
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('_meta');
    expect(result._meta).toHaveProperty('correlationId');
    expect(result._meta.correlationId).toMatch(/^req_/);

    // Validate correlation header
    const correlationHeader = response.headers()['x-correlation-id'];
    expect(correlationHeader).toBeDefined();
    expect(correlationHeader).toBe(result._meta.correlationId);

    console.log(`✅ Worker created: ${phone} (ID: ${result.id})`);
    console.log(`   Correlation ID: ${result._meta.correlationId}`);

    return {
        userId: result.id,
        username: phone,
        phone: phone,
        password: password,
        role: 'worker',
        consoleErrors
    };
}

/**
 * Create Client via UI (Admin must be logged in)
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{clientId: number, phone: string, password: string, consoleErrors: Array}>}
 */
async function uiCreateClient(page) {
    console.log('🧑 [UI] Creating Client via UI...');
    const consoleErrors = setupConsoleErrorCapture(page);

    const phone = generateUniquePhone();
    const email = `client_${phone}@test.lavandaria.pt`;

    // Navigate to Clients tab
    await page.goto('/dashboard');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Clients")');
    await page.waitForTimeout(500);

    // Click Add Client button
    await page.click('button:has-text("Add Client")');
    await page.waitForTimeout(500);

    // Wait for modal/form to appear
    await page.waitForSelector('text=Add New Client', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Fill form fields (using labels + position)
    // First Name
    const firstNameField = page.locator('label:has-text("First Name")').locator('..').locator('input');
    await firstNameField.fill('Client');

    // Last Name
    const lastNameField = page.locator('label:has-text("Last Name")').locator('..').locator('input');
    await lastNameField.fill('Test');

    // Phone
    const phoneField = page.locator('label:has-text("Phone")').locator('..').locator('input');
    await phoneField.fill(phone);

    // Email
    const emailField = page.locator('label:has-text("Email")').locator('..').locator('input');
    await emailField.fill(email);

    // Address Line 1
    const addressField = page.locator('label:has-text("Address Line 1")').locator('..').locator('input');
    await addressField.fill('Rua Client 789');

    // City
    const cityField = page.locator('label:has-text("City")').locator('..').locator('input');
    await cityField.fill('Lisboa');

    // Postal Code
    const postalField = page.locator('label:has-text("Postal Code")').locator('..').locator('input');
    await postalField.fill('1000-001');

    // Wait for create response
    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/clients') &&
                    response.request().method() === 'POST'
    );

    await page.click('button:has-text("Create Client")');
    const response = await responsePromise;
    const result = await response.json();

    // Validate envelope
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('_meta');
    expect(result._meta).toHaveProperty('correlationId');
    expect(result._meta.correlationId).toMatch(/^req_/);

    // Validate correlation header
    const correlationHeader = response.headers()['x-correlation-id'];
    expect(correlationHeader).toBeDefined();
    expect(correlationHeader).toBe(result._meta.correlationId);

    console.log(`✅ Client created: ${phone} (ID: ${result.id})`);
    console.log(`   Correlation ID: ${result._meta.correlationId}`);

    return {
        clientId: result.id,
        phone: phone,
        password: 'lavandaria2025', // Default client password
        consoleErrors
    };
}

/**
 * Create Cleaning Job via UI (Admin must be logged in)
 * @param {import('@playwright/test').Page} page
 * @param {{clientId: number, propertyAddress: string, scheduledDate: string, jobType: string}} options
 * @returns {Promise<{jobId: number, clientId: number, consoleErrors: Array}>}
 */
async function uiCreateCleaningJob(page, options) {
    console.log('🏠 [UI] Creating Cleaning Job via UI...');
    const consoleErrors = setupConsoleErrorCapture(page);

    const {
        clientId,
        propertyAddress = 'Test Property Address',
        scheduledDate = new Date(Date.now() + 86400000).toISOString().split('T')[0],
        jobType = 'airbnb'
    } = options;

    // Navigate to Cleaning Jobs tab
    await page.goto('/dashboard');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Cleaning Jobs")');
    await page.waitForTimeout(500);

    // Click Schedule Job button
    await page.click('button:has-text("Schedule Job")');
    await page.waitForTimeout(500);

    // Wait for modal/form to appear
    await page.waitForSelector('select[name="client_id"]', { timeout: 10000 });

    // Fill form fields
    await page.selectOption('select[name="client_id"]', clientId.toString());
    await page.selectOption('select[name="job_type"]', jobType);
    await page.fill('input[name="property_name"]', 'Test Property');
    await page.fill('input[name="address_line1"]', propertyAddress);
    await page.fill('input[name="city"]', 'Porto');
    await page.fill('input[name="postal_code"]', '4000-001');
    await page.fill('input[name="scheduled_date"]', scheduledDate);
    await page.fill('input[name="scheduled_time"]', '10:00');

    // Wait for create response
    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/cleaning-jobs') &&
                    response.request().method() === 'POST' &&
                    !response.url().includes('/assign')
    );

    await page.click('button[type="submit"]:has-text("Schedule")');
    const response = await responsePromise;
    const result = await response.json();

    // Validate envelope
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('_meta');
    expect(result._meta).toHaveProperty('correlationId');
    expect(result._meta.correlationId).toMatch(/^req_/);

    // Validate correlation header
    const correlationHeader = response.headers()['x-correlation-id'];
    expect(correlationHeader).toBeDefined();
    expect(correlationHeader).toBe(result._meta.correlationId);

    console.log(`✅ Cleaning Job created: ID ${result.id} for client ${clientId}`);
    console.log(`   Correlation ID: ${result._meta.correlationId}`);

    return {
        jobId: result.id,
        clientId: clientId,
        consoleErrors
    };
}

/**
 * Assign Worker to Job via UI (Admin must be logged in)
 * @param {import('@playwright/test').Page} page
 * @param {{jobId: number, workerId: number}} options
 * @returns {Promise<{jobId: number, workerId: number, consoleErrors: Array}>}
 */
async function uiAssignWorker(page, options) {
    console.log('📌 [UI] Assigning Worker to Job via UI...');
    const consoleErrors = setupConsoleErrorCapture(page);

    const { jobId, workerId } = options;

    // Navigate to Cleaning Jobs tab
    await page.goto('/dashboard');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Cleaning Jobs")');
    await page.waitForTimeout(500);

    // Find and click the "Assign Worker" button for this job
    // Assuming the job list shows jobs with action buttons
    await page.click(`button[data-job-id="${jobId}"]:has-text("Assign")`);
    await page.waitForTimeout(500);

    // Wait for assignment modal
    await page.waitForSelector('select[name="worker_id"]', { timeout: 10000 });

    // Select worker
    await page.selectOption('select[name="worker_id"]', workerId.toString());

    // Wait for assign response
    const responsePromise = page.waitForResponse(
        response => response.url().includes(`/api/cleaning-jobs/${jobId}/assign`) &&
                    response.request().method() === 'POST'
    );

    await page.click('button[type="submit"]:has-text("Assign")');
    const response = await responsePromise;
    const result = await response.json();

    // Validate envelope
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('_meta');
    expect(result._meta).toHaveProperty('correlationId');
    expect(result._meta.correlationId).toMatch(/^req_/);

    // Validate correlation header
    const correlationHeader = response.headers()['x-correlation-id'];
    expect(correlationHeader).toBeDefined();
    expect(correlationHeader).toBe(result._meta.correlationId);

    console.log(`✅ Worker ${workerId} assigned to Job ${jobId}`);
    console.log(`   Correlation ID: ${result._meta.correlationId}`);

    return {
        jobId: jobId,
        workerId: workerId,
        consoleErrors
    };
}

/**
 * Login as Worker via UI
 * @param {import('@playwright/test').Page} page
 * @param {{username: string, password: string}} workerData
 * @returns {Promise<{userId: number, username: string, role: string, consoleErrors: Array}>}
 */
async function loginAsWorker(page, workerData) {
    console.log(`🔐 [UI] Logging in as Worker: ${workerData.username}...`);
    const consoleErrors = setupConsoleErrorCapture(page);

    await page.goto('/');

    // Click "Staff" login button
    await page.click('button:has-text("Staff")');
    await page.waitForTimeout(300);

    // Fill login form
    await page.fill('input[name="username"]', workerData.username);
    await page.fill('input[name="password"]', workerData.password);

    // Wait for login response
    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/auth/login/user') &&
                    response.request().method() === 'POST'
    );

    await page.click('button[type="submit"]');
    const response = await responsePromise;
    const result = await response.json();

    // Validate envelope
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('_meta');
    expect(result._meta).toHaveProperty('correlationId');
    expect(result._meta.correlationId).toMatch(/^req_/);

    // Validate correlation header
    const correlationHeader = response.headers()['x-correlation-id'];
    expect(correlationHeader).toBeDefined();
    expect(correlationHeader).toBe(result._meta.correlationId);

    await page.waitForURL('/dashboard', { timeout: 10000 });

    console.log(`✅ Worker logged in: ${result.user.username} (ID: ${result.user.id})`);
    console.log(`   Correlation ID: ${result._meta.correlationId}`);

    return {
        userId: result.user.id,
        username: result.user.username,
        role: 'worker',
        consoleErrors
    };
}

/**
 * Login as Client via UI
 * @param {import('@playwright/test').Page} page
 * @param {{phone: string, password: string}} clientData
 * @returns {Promise<{clientId: number, phone: string, consoleErrors: Array}>}
 */
async function loginAsClient(page, clientData) {
    console.log(`🔐 [UI] Logging in as Client: ${clientData.phone}...`);
    const consoleErrors = setupConsoleErrorCapture(page);

    await page.goto('/');

    // Click "Client" login button
    await page.click('button:has-text("Client")');
    await page.waitForTimeout(300);

    // Fill login form
    await page.fill('input[name="phone"]', clientData.phone);
    await page.fill('input[name="password"]', clientData.password);

    // Wait for login response
    const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/auth/login/client') &&
                    response.request().method() === 'POST'
    );

    await page.click('button[type="submit"]');
    const response = await responsePromise;
    const result = await response.json();

    // Validate envelope
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('client');
    expect(result).toHaveProperty('_meta');
    expect(result._meta).toHaveProperty('correlationId');
    expect(result._meta.correlationId).toMatch(/^req_/);

    // Validate correlation header
    const correlationHeader = response.headers()['x-correlation-id'];
    expect(correlationHeader).toBeDefined();
    expect(correlationHeader).toBe(result._meta.correlationId);

    await page.waitForURL('/client-dashboard', { timeout: 10000 });

    console.log(`✅ Client logged in: ${result.client.phone} (ID: ${result.client.id})`);
    console.log(`   Correlation ID: ${result._meta.correlationId}`);

    return {
        clientId: result.client.id,
        phone: result.client.phone,
        consoleErrors
    };
}

module.exports = {
    generateUniquePhone,
    setupConsoleErrorCapture,
    loginAsMaster,
    uiCreateAdmin,
    loginAsAdmin,
    uiCreateWorker,
    uiCreateClient,
    uiCreateCleaningJob,
    uiAssignWorker,
    loginAsWorker,
    loginAsClient
};

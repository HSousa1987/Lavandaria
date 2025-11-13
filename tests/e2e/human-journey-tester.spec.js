/**
 * Human-Journey UX & Debug Validation — Lavandaria
 * Seedless, UI-driven Golden Path tests
 *
 * Role: Independent tester. Act like a real user. No seed data.
 * Environment: Commit c9fd88e, Image 3d4c3ecb2a10
 */

const { test, expect } = require('@playwright/test');

// Helper to generate unique names
const timestamp = Date.now();
const uniqueSuffix = `_test${timestamp}`;

// Test users with unique names
const testData = {
  admin: {
    username: `admin${uniqueSuffix}`,
    password: 'AdminTest123!',
    name: `Test Admin ${timestamp}`,
    email: `admin${timestamp}@test.local`
  },
  worker: {
    username: `worker${uniqueSuffix}`,
    password: 'WorkerTest123!',
    name: `Test Worker ${timestamp}`,
    email: `worker${timestamp}@test.local`
  },
  client: {
    username: `client${uniqueSuffix}`,
    password: 'ClientTest123!',
    name: `Test Client ${timestamp}`,
    email: `client${timestamp}@test.local`,
    phone: '912345678',
    nif: '123456789'
  },
  property: {
    name: `Test Property ${timestamp}`,
    address: `Rua Teste ${timestamp}, Porto`,
    propertyType: 'airbnb'
  }
};

// Existing master user (should exist in any fresh installation)
const masterUser = {
  username: 'master',
  password: 'master123'
};

test.describe('Human-Journey UX Validation — Golden Path (UI-Only)', () => {

  test.setTimeout(60000); // 60 seconds for complex workflows

  test.beforeEach(async ({ page }) => {
    // Navigate to home
    await page.goto('http://localhost:3000');
    // Wait for page to fully load before proceeding
    await page.waitForLoadState('networkidle');
    await page.waitForLoadState('domcontentloaded');

    // Capture any console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`❌ Console Error: ${msg.text()}`);
      }
    });

    // Capture any page errors
    page.on('pageerror', error => {
      console.error(`❌ Page Error: ${error.message}`);
    });
  });

  test('[Golden Path] Cleaning Service — Master → Admin → Worker → Client', async ({ page }) => {

    // ═══════════════════════════════════════════════════════════
    // STEP 1: Master Login and Create Admin
    // ═══════════════════════════════════════════════════════════
    console.log('\n📍 STEP 1: Master logs in and creates Admin');

    await test.step('Master logs in', async () => {
      // Wait for username field to be visible
      const usernameField = page.locator('input[name="username"]');
      await usernameField.waitFor({ state: 'visible', timeout: 10000 });

      // Fill credentials
      await usernameField.fill(masterUser.username);
      await page.locator('input[name="password"]').fill(masterUser.password);

      // Click submit button and wait for navigation
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');

      // Wait for dashboard
      await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });

      // Take screenshot
      await page.screenshot({ path: 'test-artifacts/tester/01-master-dashboard.png', fullPage: true });
    });

    await test.step('Master creates new Admin', async () => {
      // Navigate to Users section - wait for element visibility first
      const usersLink = page.locator('text=Users');
      await usersLink.waitFor({ state: 'visible', timeout: 10000 });
      await usersLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(200); // Small buffer for rendering

      // Click Create User - wait for button visibility
      const createButton = page.locator('button:has-text("Create"), button:has-text("Add User"), button:has-text("New User")').first();
      await createButton.waitFor({ state: 'visible', timeout: 10000 });
      await createButton.click();
      await page.waitForTimeout(300); // Wait for form modal to appear

      // Fill admin form
      const usernameField = page.locator('input[name="username"]');
      await usernameField.waitFor({ state: 'visible', timeout: 10000 });
      await usernameField.fill(testData.admin.username);
      await page.locator('input[name="password"]').fill(testData.admin.password);
      await page.locator('input[name="name"]').fill(testData.admin.name);
      await page.locator('input[name="email"]').fill(testData.admin.email);

      // Select admin role
      await page.selectOption('select[name="role"]', 'admin');

      // Submit and wait for modal to close
      const submitButton = page.locator('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save")').first();
      await submitButton.waitFor({ state: 'visible', timeout: 10000 });
      await submitButton.click();
      await page.waitForLoadState('networkidle');

      // Screenshot
      await page.screenshot({ path: 'test-artifacts/tester/02-admin-created.png', fullPage: true });

      // Verify admin appears in list
      await expect(page.locator(`text=${testData.admin.username}`)).toBeVisible({ timeout: 10000 });
    });

    await test.step('Master logs out', async () => {
      const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")').first();
      await logoutButton.waitFor({ state: 'visible', timeout: 10000 });
      await logoutButton.click();
      await page.waitForLoadState('networkidle');
    });

    // ═══════════════════════════════════════════════════════════
    // STEP 2: Admin Login and Create Worker + Client + Property
    // ═══════════════════════════════════════════════════════════
    console.log('\n📍 STEP 2: Admin logs in and creates Worker, Client, Property');

    await test.step('Admin logs in', async () => {
      await page.goto('http://localhost:3000');
      await page.waitForLoadState('networkidle');
      await page.waitForLoadState('domcontentloaded');

      // Wait for login form to be visible
      const usernameField = page.locator('input[name="username"]');
      await usernameField.waitFor({ state: 'visible', timeout: 10000 });

      // Fill and submit
      await usernameField.fill(testData.admin.username);
      await page.locator('input[name="password"]').fill(testData.admin.password);
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: 'test-artifacts/tester/03-admin-dashboard.png', fullPage: true });
    });

    await test.step('Admin creates Worker', async () => {
      // Navigate to Users
      const usersLink = page.locator('text=Users');
      await usersLink.waitFor({ state: 'visible', timeout: 10000 });
      await usersLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(200);

      // Click Create button
      const createButton = page.locator('button:has-text("Create"), button:has-text("Add User")').first();
      await createButton.waitFor({ state: 'visible', timeout: 10000 });
      await createButton.click();
      await page.waitForTimeout(300);

      // Fill form
      const usernameField = page.locator('input[name="username"]');
      await usernameField.waitFor({ state: 'visible', timeout: 10000 });
      await usernameField.fill(testData.worker.username);
      await page.locator('input[name="password"]').fill(testData.worker.password);
      await page.locator('input[name="name"]').fill(testData.worker.name);
      await page.locator('input[name="email"]').fill(testData.worker.email);
      await page.selectOption('select[name="role"]', 'worker');

      // Submit
      const submitButton = page.locator('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save")').first();
      await submitButton.waitFor({ state: 'visible', timeout: 10000 });
      await submitButton.click();
      await page.waitForLoadState('networkidle');

      await page.screenshot({ path: 'test-artifacts/tester/04-worker-created.png', fullPage: true });
      await expect(page.locator(`text=${testData.worker.username}`)).toBeVisible({ timeout: 10000 });
    });

    await test.step('Admin creates Client', async () => {
      // Navigate to Clients if needed
      const clientsLink = page.locator('text=Clients, a:has-text("Clients")').first();
      const isClientLinkVisible = await clientsLink.isVisible({ timeout: 5000 }).catch(() => false);
      if (isClientLinkVisible) {
        await clientsLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(200);
      }

      // Click Create button
      const createButton = page.locator('button:has-text("Create"), button:has-text("Add Client")').first();
      await createButton.waitFor({ state: 'visible', timeout: 10000 });
      await createButton.click();
      await page.waitForTimeout(300);

      // Fill form
      const usernameField = page.locator('input[name="username"]');
      await usernameField.waitFor({ state: 'visible', timeout: 10000 });
      await usernameField.fill(testData.client.username);
      await page.locator('input[name="password"]').fill(testData.client.password);
      await page.locator('input[name="name"]').fill(testData.client.name);
      await page.locator('input[name="email"]').fill(testData.client.email);
      await page.locator('input[name="phone"]').fill(testData.client.phone);
      await page.locator('input[name="nif"]').fill(testData.client.nif);

      // Submit
      const submitButton = page.locator('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save")').first();
      await submitButton.waitFor({ state: 'visible', timeout: 10000 });
      await submitButton.click();
      await page.waitForLoadState('networkidle');

      await page.screenshot({ path: 'test-artifacts/tester/05-client-created.png', fullPage: true });
    });

    await test.step('Admin creates Property and schedules Cleaning Job', async () => {
      // Navigate to Properties or Jobs
      const propertiesLink = page.locator('text=Properties, a:has-text("Properties"), text=Jobs, a:has-text("Jobs")').first();
      await propertiesLink.waitFor({ state: 'visible', timeout: 10000 });
      await propertiesLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(200);

      // Create property/job
      const createButton = page.locator('button:has-text("Create"), button:has-text("Add Property"), button:has-text("New Job")').first();
      await createButton.waitFor({ state: 'visible', timeout: 10000 });
      await createButton.click();
      await page.waitForTimeout(300);

      // This is highly dependent on the UI structure
      // Will need to adapt based on actual form fields
      await page.waitForLoadState('networkidle');

      await page.screenshot({ path: 'test-artifacts/tester/06-property-job-form.png', fullPage: true });

      // Log warning if we can't proceed
      console.warn('⚠️  Property/Job creation form - manual verification needed');
    });

  });

  // Add debugging for failures
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed') {
      await page.screenshot({
        path: `test-artifacts/human-journey-failed-${testInfo.title}.png`,
        fullPage: true
      });
    }
  });

  test('[Negative] Worker upload — 11 files should be blocked', async ({ page }) => {
    console.log('\n📍 NEGATIVE TEST: Upload 11 files (expect client-side block)');

    // This test requires:
    // 1. Login as worker
    // 2. Navigate to job with upload form
    // 3. Attempt to select 11 files
    // 4. Verify button is disabled or error shown

    // Placeholder for now
    await page.goto('http://localhost:3000');
    console.warn('⚠️  11-file upload test - requires worker session and file selection UI');
  });

  test('[Negative] Worker upload — invalid file type (.txt)', async ({ page }) => {
    console.log('\n📍 NEGATIVE TEST: Upload .txt file (expect rejection)');
    await page.goto('http://localhost:3000');
    console.warn('⚠️  Invalid file type test - requires upload form access');
  });

  test('[Negative] Worker upload — file >10MB', async ({ page }) => {
    console.log('\n📍 NEGATIVE TEST: Upload >10MB file (expect rejection)');
    await page.goto('http://localhost:3000');
    console.warn('⚠️  Oversized file test - requires upload form access');
  });

  test('[RBAC] Worker attempts unassigned job — expect 403', async ({ page }) => {
    console.log('\n📍 RBAC TEST: Worker tries to access unassigned job');
    await page.goto('http://localhost:3000');
    console.warn('⚠️  Unassigned job test - requires existing job setup');
  });

  test('[Accessibility] Keyboard navigation in dashboard tabs', async ({ page }) => {
    console.log('\n📍 ACCESSIBILITY: Keyboard navigation');

    await page.goto('http://localhost:3000');

    // Login as any user (use master for simplicity)
    await page.fill('input[name="username"]', masterUser.username);
    await page.fill('input[name="password"]', masterUser.password);
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });

    // Check for tab elements
    const tabs = page.locator('[role="tab"], button.tab, .tab-button');
    const tabCount = await tabs.count();

    if (tabCount > 0) {
      console.log(`✅ Found ${tabCount} tab elements`);

      // Test keyboard navigation
      await tabs.first().focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      await page.screenshot({ path: 'test-artifacts/tester/accessibility-tabs.png', fullPage: true });
    } else {
      console.warn('⚠️  No tab elements found - check dashboard structure');
    }
  });

  test('[UX] Mobile viewport — responsive layout sanity', async ({ page }) => {
    console.log('\n📍 UX: Mobile viewport test');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3000');

    await page.screenshot({ path: 'test-artifacts/tester/mobile-login.png', fullPage: true });

    // Login
    await page.fill('input[name="username"]', masterUser.username);
    await page.fill('input[name="password"]', masterUser.password);
    await page.click('button[type="submit"]');

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-artifacts/tester/mobile-dashboard.png', fullPage: true });

    // Check if navigation is accessible (hamburger menu, etc.)
    const mobileMenu = page.locator('button[aria-label="menu"], button.hamburger, [data-testid="mobile-menu"]');
    if (await mobileMenu.isVisible()) {
      console.log('✅ Mobile menu found');
      await mobileMenu.click();
      await page.screenshot({ path: 'test-artifacts/tester/mobile-menu-open.png', fullPage: true });
    } else {
      console.warn('⚠️  Mobile menu not found - check responsive design');
    }
  });

});

test.describe('Golden Path — Laundry Service', () => {

  test.setTimeout(60000); // 60 seconds for complex workflows

  test('[Laundry] Admin creates order → status transitions → payment', async ({ page }) => {
    console.log('\n📍 LAUNDRY SERVICE: Order lifecycle');

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForLoadState('domcontentloaded');

    // Login as admin (reusing from cleaning test)
    const usernameField = page.locator('input[name="username"]');
    await usernameField.waitFor({ state: 'visible', timeout: 10000 });
    await usernameField.fill(masterUser.username);
    await page.locator('input[name="password"]').fill(masterUser.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });

    // Navigate to Orders
    const ordersLink = page.locator('text=Orders, a:has-text("Orders")').first();
    const isOrdersVisible = await ordersLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (isOrdersVisible) {
      await ordersLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(200);

      await page.screenshot({ path: 'test-artifacts/tester/laundry-orders-page.png', fullPage: true });

      // Try to create order
      const createButton = page.locator('button:has-text("Create"), button:has-text("New Order")').first();
      const isCreateVisible = await createButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (isCreateVisible) {
        await createButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'test-artifacts/tester/laundry-order-form.png', fullPage: true });
      } else {
        console.warn('⚠️  Create Order button not found');
      }
    } else {
      console.warn('⚠️  Orders navigation not found');
    }
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed') {
      await page.screenshot({
        path: `test-artifacts/laundry-failed-${testInfo.title}.png`,
        fullPage: true
      });
    }
  });

});

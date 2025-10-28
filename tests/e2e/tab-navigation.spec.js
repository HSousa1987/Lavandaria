/**
 * Tab Navigation E2E Test
 *
 * Tests that dashboard tabs can be clicked and content switches properly.
 * This test guards against regression of the tab navigation bug.
 */
const { test, expect } = require('@playwright/test');

test.describe('Dashboard Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login as worker
    await page.goto('http://localhost:3000');
    // Login form is visible by default (login-first UX)
    // Select Staff tab
    await page.click('button:has-text("Staff")');
    await page.fill('input[name="username"]', 'worker1');
    await page.fill('input[name="password"]', 'worker123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should switch to My Jobs tab when clicked', async ({ page }) => {
    // Click My Jobs tab
    await page.click('nav button:has-text("My Jobs")');

    // Wait for content to load
    await page.waitForSelector('h2:has-text("My Cleaning Jobs")');

    // Verify tab is active (has aria-selected="true")
    const myJobsTab = page.locator('nav button:has-text("My Jobs")');
    await expect(myJobsTab).toHaveAttribute('aria-selected', 'true');

    // Verify content changed
    await expect(page.locator('h2:has-text("My Cleaning Jobs")')).toBeVisible();
  });

  test('should switch to Cleaning Jobs tab when clicked', async ({ page }) => {
    // Click Cleaning Jobs tab
    await page.click('nav button:has-text("Cleaning Jobs")');

    // Wait for content to load
    await page.waitForSelector('h2:has-text("Cleaning Jobs")');

    // Verify tab is active
    const cleaningJobsTab = page.locator('nav button:has-text("Cleaning Jobs")');
    await expect(cleaningJobsTab).toHaveAttribute('aria-selected', 'true');

    // Verify content changed
    await expect(page.locator('h2:has-text("Cleaning Jobs")')).toBeVisible();
  });

  test('should switch between multiple tabs correctly', async ({ page }) => {
    // Start on Overview
    await expect(page.locator('nav button:has-text("Overview")')).toHaveAttribute('aria-selected', 'true');

    // Switch to My Jobs
    await page.click('nav button:has-text("My Jobs")');
    await page.waitForSelector('h2:has-text("My Cleaning Jobs")');
    await expect(page.locator('nav button:has-text("My Jobs")')).toHaveAttribute('aria-selected', 'true');

    // Switch to Laundry Orders
    await page.click('nav button:has-text("Laundry Orders")');
    await page.waitForSelector('h2:has-text("Laundry Orders")');
    await expect(page.locator('nav button:has-text("Laundry Orders")')).toHaveAttribute('aria-selected', 'true');

    // Switch back to Overview
    await page.click('nav button:has-text("Overview")');
    await page.waitForSelector('h3:has-text("Assigned Jobs")');
    await expect(page.locator('nav button:has-text("Overview")')).toHaveAttribute('aria-selected', 'true');
  });

  test('should have proper ARIA attributes for accessibility', async ({ page }) => {
    // Check tablist role
    const nav = page.locator('nav[role="tablist"]');
    await expect(nav).toBeVisible();

    // Check all tabs have proper role and type
    const tabs = page.locator('nav button[role="tab"]');
    const count = await tabs.count();
    expect(count).toBeGreaterThan(0);

    // Verify each tab has type="button"
    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i);
      await expect(tab).toHaveAttribute('type', 'button');
      await expect(tab).toHaveAttribute('role', 'tab');
    }
  });

  test('should not have console errors when switching tabs', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Click through all tabs
    await page.click('nav button:has-text("My Jobs")');
    await page.waitForTimeout(200);
    await page.click('nav button:has-text("Cleaning Jobs")');
    await page.waitForTimeout(200);
    await page.click('nav button:has-text("Laundry Orders")');
    await page.waitForTimeout(200);
    await page.click('nav button:has-text("Client Contacts")');
    await page.waitForTimeout(200);
    await page.click('nav button:has-text("Overview")');
    await page.waitForTimeout(200);

    // Verify no console errors
    expect(consoleErrors).toHaveLength(0);
  });
});

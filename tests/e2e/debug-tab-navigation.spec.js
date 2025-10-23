/**
 * Debug test to understand tab navigation issue
 * This test will be replaced by the final tab-navigation.spec.js
 */
const { test, expect } = require('@playwright/test');

test.describe('Tab Navigation Debug', () => {
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

  test('inspect tab button properties', async ({ page }) => {
    // Wait for tabs to be visible
    await page.waitForSelector('nav button:has-text("Overview")');

    // Get the "My Jobs" button
    const myJobsButton = page.locator('nav button:has-text("My Jobs")');

    // Check if button exists
    await expect(myJobsButton).toBeVisible();

    // Check computed styles
    const styles = await myJobsButton.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        pointerEvents: computed.pointerEvents,
        zIndex: computed.zIndex,
        position: computed.position,
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity,
        cursor: computed.cursor,
        disabled: el.disabled,
        tagName: el.tagName
      };
    });

    console.log('Button styles:', styles);

    // Try clicking
    await myJobsButton.click();

    // Wait a moment for state to update
    await page.waitForTimeout(500);

    // Check if activeTab state changed (by looking at DOM)
    const isActive = await myJobsButton.evaluate((el) => {
      return el.className.includes('border-blue-600');
    });

    console.log('Button is active after click:', isActive);

    // Take screenshot for debugging
    await page.screenshot({ path: '.playwright-mcp/tab-debug.png' });
  });

  test('try different click methods', async ({ page }) => {
    const myJobsButton = page.locator('nav button:has-text("My Jobs")');

    // Method 1: Regular Playwright click
    console.log('Method 1: Playwright click()');
    await myJobsButton.click();
    await page.waitForTimeout(300);
    let isActive = await myJobsButton.evaluate((el) => el.className.includes('border-blue-600'));
    console.log('Active after Playwright click:', isActive);

    // Method 2: Force click
    console.log('Method 2: Force click');
    const overviewButton = page.locator('nav button:has-text("Overview")');
    await overviewButton.click(); // Reset to overview
    await page.waitForTimeout(300);
    await myJobsButton.click({ force: true });
    await page.waitForTimeout(300);
    isActive = await myJobsButton.evaluate((el) => el.className.includes('border-blue-600'));
    console.log('Active after force click:', isActive);

    // Method 3: JavaScript click
    console.log('Method 3: JavaScript dispatchEvent');
    await overviewButton.click();
    await page.waitForTimeout(300);
    await myJobsButton.evaluate((el) => el.click());
    await page.waitForTimeout(300);
    isActive = await myJobsButton.evaluate((el) => el.className.includes('border-blue-600'));
    console.log('Active after JS click:', isActive);

    // Method 4: Trigger React event
    console.log('Method 4: Direct React event');
    await overviewButton.click();
    await page.waitForTimeout(300);
    await myJobsButton.evaluate((el) => {
      const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      el.dispatchEvent(event);
    });
    await page.waitForTimeout(300);
    isActive = await myJobsButton.evaluate((el) => el.className.includes('border-blue-600'));
    console.log('Active after React event:', isActive);
  });
});

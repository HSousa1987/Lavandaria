const { test, expect } = require('@playwright/test');

test('Simple login test - Master', async ({ page }) => {
  // Navigate to home
  await page.goto('http://localhost:3000', { waitUntil: 'load' });

  // Wait for page to fully load
  await page.waitForTimeout(1000);

  // Click Staff tab
  await page.getByRole('button', { name: /Staff/i }).click();

  // Wait for form to appear
  await page.waitForTimeout(500);

  // Fill username and password
  await page.getByPlaceholder(/username/i).fill('master');
  await page.getByPlaceholder(/password/i).fill('master123');

  // Click Login button
  await page.getByRole('button', { name: /Login/i }).first().click();

  // Wait for redirect or navigation
  await page.waitForTimeout(5000);

  // Check final URL
  const finalUrl = page.url();
  console.log(`Final URL: ${finalUrl}`);

  // Try to get any visible text from the page
  const bodyText = await page.locator('body').textContent();
  console.log(`Page body contains dashboard: ${bodyText.includes('Dashboard') || bodyText.includes('dashboard')}`);

  // Print first 200 chars of body text
  console.log(`Page content preview: ${bodyText.substring(0, 200)}`);

  // Assertion
  expect(finalUrl).toContain('/dashboard');
});

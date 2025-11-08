const { test, expect } = require('@playwright/test');

test('Login debug test to check execution flow', async ({ page }) => {
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

  // Wait for async operations
  await page.waitForTimeout(5000);

  // Get debug info from window
  const debugInfo = await page.evaluate(() => {
    return {
      handleSubmitCalled: window.LANDING_DEBUG?.handleSubmitCalled || false,
      loginReturned: window.LANDING_DEBUG?.loginReturned || false,
      navigateToDashboard: window.LANDING_DEBUG?.navigateToDashboard || false,
      navigateToCPW: window.LANDING_DEBUG?.navigateToCPW || false,
      loginResponse: window.LANDING_DEBUG?.loginResponse || null,
      loginError: window.LANDING_DEBUG?.loginError ? window.LANDING_DEBUG.loginError.toString() : null
    };
  });

  const finalUrl = page.url();

  console.log('\n=== DEBUG INFO ===');
  console.log('Final URL:', finalUrl);
  console.log('handleSubmitCalled:', debugInfo.handleSubmitCalled);
  console.log('loginReturned:', debugInfo.loginReturned);
  console.log('navigateToDashboard:', debugInfo.navigateToDashboard);
  console.log('loginResponse:', JSON.stringify(debugInfo.loginResponse, null, 2));
  console.log('loginError:', debugInfo.loginError);

  expect(debugInfo.handleSubmitCalled).toBe(true);
  expect(debugInfo.loginReturned).toBe(true);
  expect(debugInfo.navigateToDashboard).toBe(true);
  expect(finalUrl).toContain('/dashboard');
});

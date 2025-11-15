const { test, expect } = require('@playwright/test');

test.describe('Login with Trace', () => {
  test('Master login should redirect to dashboard', async ({ page }) => {
    // Start recording trace for debugging
    await page.context().tracing.start({ screenshots: true, snapshots: true });

    try {
      // Navigate to landing page
      await page.goto('http://localhost:3000');
      console.log('Page loaded');

      // Wait for page to stabilize
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

      // Click Staff tab
      const staffButton = page.getByRole('button', { name: /Staff/i });
      console.log('Clicking Staff tab...');
      await staffButton.click();
      await page.waitForTimeout(500);

      // Fill credentials
      const usernameField = page.getByPlaceholder(/username/i);
      const passwordField = page.getByPlaceholder(/password/i);

      console.log('Filling credentials...');
      await usernameField.fill('master');
      await passwordField.fill('master123');

      // Click Login button
      const loginButton = page.getByRole('button', { name: /Login/i }).first();
      console.log('Clicking Login button...');
      await loginButton.click();

      // Wait for any potential redirect and network activity
      await page.waitForTimeout(4000);

      const finalURL = page.url();
      console.log('Final URL:', finalURL);

      // Check if redirect happened
      if (finalURL.includes('/dashboard')) {
        console.log('SUCCESS: Redirected to dashboard!');
        expect(finalURL).toContain('/dashboard');
      } else {
        console.log('FAIL: Still on landing page');
        // Take screenshot for debugging
        await page.screenshot({ path: 'login-fail-screenshot.png' });
      }
    } finally {
      // Stop tracing and save it
      await page.context().tracing.stop({ path: 'trace.zip' });
    }
  });
});

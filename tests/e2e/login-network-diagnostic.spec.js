const { test, expect } = require('@playwright/test');

test.describe('Login Network Diagnostic', () => {
  test('Capture network requests during login attempt', async ({ page }) => {
    // Collect all network requests
    const requests = [];
    page.on('response', response => {
      requests.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method()
      });
    });

    console.log('Starting login network diagnostic test...\n');

    // Navigate
    await page.goto('http://localhost:3000');
    console.log('Page loaded');
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    // Click Staff tab
    const staffButton = page.getByRole('button', { name: /Staff/i });
    console.log('Looking for Staff button...');
    await staffButton.click();
    await page.waitForTimeout(500);

    // Fill credentials
    const usernameField = page.getByPlaceholder(/username/i);
    const passwordField = page.getByPlaceholder(/password/i);

    console.log('Filling credentials...');
    await usernameField.fill('master');
    await passwordField.fill('master123');

    // Click Login
    const loginButton = page.getByRole('button', { name: /Login/i }).first();
    console.log('Clicking login button...');
    await loginButton.click();

    // Wait for network activity
    await page.waitForTimeout(3000);

    // Final URL
    console.log('\nFINAL URL:', page.url());
    console.log('EXPECTED: http://localhost:3000/dashboard');

    // Filter requests for auth endpoint
    const authRequest = requests.find(r => r.url.includes('/api/auth/login'));

    console.log('\n=== NETWORK REQUESTS ===');
    console.log('Total requests:', requests.length);
    console.log('Auth login request found:', authRequest ? 'YES' : 'NO');

    if (authRequest) {
      console.log('Auth request status:', authRequest.status);
    }

    console.log('\nAll requests with /api:');
    requests
      .filter(r => r.url.includes('/api'))
      .forEach(r => {
        console.log(`  ${r.method} ${r.url.substring(r.url.indexOf('/api'))} [${r.status}]`);
      });
  });
});

/**
 * Diagnostic Test: Login Flow with Console Logging
 * Purpose: Capture all console logs during login to identify where the flow breaks
 */

const { test, expect } = require('@playwright/test');

test.describe('Login Diagnostic', () => {
  test('Master login with full console capture', async ({ page }) => {
    const consoleLogs = [];

    // Capture all console messages
    page.on('console', msg => {
      const logEntry = `[${msg.type().toUpperCase()}] ${msg.text()}`;
      consoleLogs.push(logEntry);
      console.log(logEntry);
    });

    console.log('\nStarting login diagnostic test...\n');

    // Navigate to app
    console.log('Navigating to http://localhost:3000');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle', { timeout: 5000 });
    console.log('Page loaded\n');

    // Click Staff tab
    console.log('Clicking Staff tab');
    await page.getByRole('button', { name: 'Staff' }).click();
    await page.waitForTimeout(500);

    // Enter credentials
    console.log('Entering credentials: master / master123');
    await page.getByPlaceholder('Enter your username').fill('master');
    await page.getByPlaceholder('Enter your password').fill('master123');

    // Click login button
    console.log('Clicking Login button\n');
    await page.getByRole('button', { name: 'Login' }).click();

    // Wait for login to process
    await page.waitForTimeout(3000);
    console.log('\n');

    // Check final URL
    const currentUrl = page.url();
    console.log('FINAL URL: ' + currentUrl);
    console.log('EXPECTED: http://localhost:3000/dashboard');
    console.log('STATUS: ' + (currentUrl.includes('/dashboard') ? 'PASS' : 'FAIL') + '\n');

    // Print all console logs
    console.log('CONSOLE LOGS CAPTURED:');
    console.log('========================');
    consoleLogs.forEach(log => console.log(log));
    console.log('========================\n');

    // Check for key logs
    const hasAuthInit = consoleLogs.some(log => log.includes('axios.defaults.withCredentials'));
    const hasLogin = consoleLogs.some(log => log.includes('login() called'));
    const hasCheckAuth = consoleLogs.some(log => log.includes('checkAuth() called'));
    const hasUserStateChange = consoleLogs.some(log => log.includes('User state changed'));

    console.log('KEY INDICATORS:');
    console.log('AuthContext init: ' + (hasAuthInit ? 'YES' : 'NO'));
    console.log('login() called: ' + (hasLogin ? 'YES' : 'NO'));
    console.log('checkAuth() called: ' + (hasCheckAuth ? 'YES' : 'NO'));
    console.log('User state changed: ' + (hasUserStateChange ? 'YES' : 'NO'));
  });
});

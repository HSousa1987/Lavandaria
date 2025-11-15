const { test, expect } = require('@playwright/test');

test.describe('Login Response Diagnostic', () => {
  test('Capture login response structure', async ({ page }) => {
    let loginResponse = null;
    let checkAuthResponses = [];

    // Capture response bodies
    page.on('response', async response => {
      if (response.url().includes('/api/auth/login/user')) {
        try {
          const body = await response.json();
          loginResponse = {
            status: response.status(),
            body: body
          };
          console.log('\nLOGIN RESPONSE CAPTURED:');
          console.log(JSON.stringify(body, null, 2));
        } catch (e) {
          console.log('Failed to parse login response body');
        }
      }

      if (response.url().includes('/api/auth/check')) {
        try {
          const body = await response.json();
          checkAuthResponses.push({
            status: response.status(),
            body: body
          });
        } catch (e) {
          console.log('Failed to parse auth check response');
        }
      }
    });

    // Navigate and perform login
    await page.goto('http://localhost:3000');
    await page.getByRole('button', { name: /Staff/i }).click();
    await page.waitForTimeout(300);

    await page.getByPlaceholder(/username/i).fill('master');
    await page.getByPlaceholder(/password/i).fill('master123');

    console.log('Clicking login button...');
    await page.getByRole('button', { name: /Login/i }).first().click();

    // Wait for responses
    await page.waitForTimeout(3000);

    console.log('\n=== FINAL DIAGNOSIS ===');
    console.log('Final URL:', page.url());
    console.log('Expected URL: http://localhost:3000/dashboard');
    console.log('Match:', page.url() === 'http://localhost:3000/dashboard' ? 'YES' : 'NO');

    console.log('\nAuth Check Responses Count:', checkAuthResponses.length);
    if (checkAuthResponses.length > 0) {
      console.log('First auth check response:');
      console.log(JSON.stringify(checkAuthResponses[0].body, null, 2));
    }
  });
});

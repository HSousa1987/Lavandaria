const { test } = require('@playwright/test');

test('Check showLogin state', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // Intercept console messages
  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push(msg.text());
  });

  // Click Staff tab
  await page.getByRole('button', { name: /Staff/i }).click();
  await page.waitForTimeout(1000);

  // Check what's in the document
  const state = await page.evaluate(() => {
    return {
      loginFormExists: !!document.querySelector('form'),
      totalButtons: document.querySelectorAll('button').length,
      formButtons: document.querySelectorAll('form button').length,
      allButtonTexts: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
    };
  });

  console.log('=== PAGE STATE ===');
  console.log(JSON.stringify(state, null, 2));

  console.log('\n=== CONSOLE LOGS (last 10) ===');
  consoleLogs.slice(-10).forEach(log => console.log(log));
});

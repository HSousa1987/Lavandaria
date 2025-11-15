const { test } = require('@playwright/test');

test('Check for errors on page', async ({ page }) => {
  const errors = [];
  const warnings = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });

  page.on('pageerror', (err) => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // Click Staff tab
  await page.getByRole('button', { name: /Staff/i }).click();
  await page.waitForTimeout(1000);

  console.log('=== ERRORS ===');
  console.log(errors.length ? errors : 'None');

  console.log('\n=== WARNINGS ===');
  console.log(warnings.length ? warnings.slice(0, 10) : 'None');

  console.log('\n=== DOM INSPECTION ===');
  const domInfo = await page.evaluate(() => {
    const form = document.querySelector('form');
    const buttons = form ? form.querySelectorAll('button') : [];
    let loginButton = null;
    for (const btn of buttons) {
      if (btn.textContent.includes('Login')) {
        loginButton = btn;
        break;
      }
    }
    
    return {
      formExists: !!form,
      loginButtonExists: !!loginButton,
      loginButtonHTML: loginButton ? loginButton.outerHTML.substring(0, 100) : null,
      componentRendered: !!document.querySelector('.space-y-5'),
      windowSize: { width: window.innerWidth, height: window.innerHeight },
      documentReady: document.readyState
    };
  });
  console.log(JSON.stringify(domInfo, null, 2));
});

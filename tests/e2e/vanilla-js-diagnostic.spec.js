const { test, expect } = require('@playwright/test');

test('Diagnostic: Check if vanilla JS event listener is being attached', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // Click Staff tab to show login form
  await page.getByRole('button', { name: /Staff/i }).click();
  await page.waitForTimeout(500);

  // Fill credentials
  await page.getByPlaceholder(/username/i).fill('master');
  await page.getByPlaceholder(/password/i).fill('master123');

  // Check console logs to see if useEffect ran
  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push(msg.text());
    console.log('[CONSOLE]', msg.text());
  });

  // Wait a bit for useEffect to run
  await page.waitForTimeout(2000);

  // Inspect the button to see if event listener is attached
  const buttonInfo = await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!form) return { error: 'No form found' };

    const buttons = form.querySelectorAll('button[type="button"]');
    const loginButton = buttons[buttons.length - 1];

    return {
      formFound: !!form,
      buttonFound: !!loginButton,
      buttonText: loginButton?.textContent,
      buttonHTML: loginButton?.outerHTML.substring(0, 200),
      hasClickListener: loginButton ? 'unknown' : 'no button'
    };
  });

  console.log('\n=== BUTTON INFO ===');
  console.log(JSON.stringify(buttonInfo, null, 2));

  console.log('\n=== CONSOLE LOGS ===');
  consoleLogs.forEach((log) => {
    if (log.includes('DEBUG')) {
      console.log(log);
    }
  });

  // Try clicking the button
  console.log('\n=== ATTEMPTING CLICK ===');
  await page.getByRole('button', { name: /Login/i }).first().click();
  await page.waitForTimeout(2000);

  // Check if anything happened
  const afterClickInfo = await page.evaluate(() => {
    return {
      handleSubmitCalled: window.LANDING_DEBUG?.handleSubmitCalled,
      url: window.location.href
    };
  });

  console.log('\n=== AFTER CLICK ===');
  console.log(JSON.stringify(afterClickInfo, null, 2));
});

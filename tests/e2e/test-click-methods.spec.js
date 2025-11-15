const { test } = require('@playwright/test');

test('Try different click methods', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // Capture all console logs
  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push(msg.text());
  });

  // Click Staff tab
  await page.getByRole('button', { name: /Staff/i }).click();
  await page.waitForTimeout(500);

  // Fill credentials
  await page.getByPlaceholder(/username/i).fill('master');
  await page.getByPlaceholder(/password/i).fill('master123');

  console.log('=== METHOD 1: getByRole ===');
  await page.getByRole('button', { name: /Login/i }).first().click();
  await page.waitForTimeout(2000);

  let state = await page.evaluate(() => ({
    handleSubmitCalled: window.LANDING_DEBUG?.handleSubmitCalled
  }));
  console.log('handleSubmitCalled:', state.handleSubmitCalled);
  console.log('[VANILLA-JS] logs:', consoleLogs.filter(l => l.includes('VANILLA-JS')));

  // Reset and try again with different method
  if (!state.handleSubmitCalled) {
    console.log('\n=== METHOD 2: getByPlaceholder(password).press(Enter) ===');
    consoleLogs.length = 0;
    await page.getByPlaceholder(/password/i).press('Enter');
    await page.waitForTimeout(2000);

    state = await page.evaluate(() => ({
      handleSubmitCalled: window.LANDING_DEBUG?.handleSubmitCalled
    }));
    console.log('handleSubmitCalled:', state.handleSubmitCalled);
    console.log('[VANILLA-JS] logs:', consoleLogs.filter(l => l.includes('VANILLA-JS')));
  }

  // Reset and try query selector
  if (!state.handleSubmitCalled) {
    console.log('\n=== METHOD 3: page.$() selector direct click ===');
    consoleLogs.length = 0;
    const button = await page.$('button:has-text("Login")');
    if (button) {
      await button.click();
      await page.waitForTimeout(2000);
      state = await page.evaluate(() => ({
        handleSubmitCalled: window.LANDING_DEBUG?.handleSubmitCalled
      }));
      console.log('handleSubmitCalled:', state.handleSubmitCalled);
      console.log('[VANILLA-JS] logs:', consoleLogs.filter(l => l.includes('VANILLA-JS')));
    }
  }

  console.log('\n=== FINAL STATE ===');
  console.log('All console logs:', consoleLogs);
});

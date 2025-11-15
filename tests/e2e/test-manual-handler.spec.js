const { test, expect } = require('@playwright/test');

test('Test manually calling handleSubmit via page.evaluate', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // Click Staff tab
  await page.getByRole('button', { name: /Staff/i }).click();
  await page.waitForTimeout(500);

  // Fill credentials
  await page.getByPlaceholder(/username/i).fill('master');
  await page.getByPlaceholder(/password/i).fill('master123');

  // Capture console logs
  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push(msg.text());
    if (msg.text().includes('handleSubmit') || msg.text().includes('Login error')) {
      console.log('[CONSOLE]', msg.text());
    }
  });

  // Try manually finding and calling the form onSubmit
  console.log('=== ATTEMPTING MANUAL FORM SUBMIT ===');
  const result = await page.evaluate(async () => {
    const form = document.querySelector('form');
    if (!form) return { error: 'No form found' };
    
    // Try to trigger form submission directly
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    const submitted = form.dispatchEvent(submitEvent);
    
    return {
      formFound: !!form,
      submitEventDispatched: submitted,
      handleSubmitCalled: window.LANDING_DEBUG?.handleSubmitCalled
    };
  });

  console.log('Form submission result:', JSON.stringify(result, null, 2));
  await page.waitForTimeout(2000);

  const finalState = await page.evaluate(() => ({
    handleSubmitCalled: window.LANDING_DEBUG?.handleSubmitCalled,
    url: window.location.href
  }));

  console.log('Final state:', JSON.stringify(finalState, null, 2));
});

const { test, expect } = require('@playwright/test');

test('Inspect page DOM to understand form structure', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // Click Staff tab
  await page.getByRole('button', { name: /Staff/i }).click();
  await page.waitForTimeout(500);

  // Inspect form structure
  const formInfo = await page.evaluate(() => {
    const forms = document.querySelectorAll('form');
    const result = {
      totalForms: forms.length,
      forms: []
    };

    forms.forEach((form, idx) => {
      const buttons = form.querySelectorAll('button[type="submit"]');
      result.forms.push({
        index: idx,
        submitButtons: buttons.length,
        inputs: form.querySelectorAll('input').length,
        onSubmit: form.onsubmit ? 'yes' : 'no',
        attributes: {
          id: form.id,
          className: form.className,
          method: form.method,
          action: form.action
        }
      });
    });

    return result;
  });

  console.log('\n=== FORM STRUCTURE ===');
  console.log(JSON.stringify(formInfo, null, 2));

  // Try to get React internals
  const reactInfo = await page.evaluate(() => {
    // Look for React DevTools if available
    const root = document.getElementById('root');
    if (!root) return { error: 'No root element' };

    // Try to find event listeners on the form
    const form = document.querySelector('form');
    if (!form) return { error: 'No form found' };

    return {
      formFound: !!form,
      formHasOnsubmit: form.onsubmit !== null,
      rootElement: {
        id: root.id,
        children: root.children.length
      }
    };
  });

  console.log('\n=== REACT INTEGRATION ===');
  console.log(JSON.stringify(reactInfo, null, 2));

  // Try clicking with more control
  await page.getByPlaceholder(/username/i).fill('master');
  await page.getByPlaceholder(/password/i).fill('master123');

  console.log('\n=== ATTEMPTING LOGIN ===');

  // Method 1: Click button
  console.log('Method 1: Clicking submit button...');
  const button = await page.$('button[type="submit"]');
  if (button) {
    await button.click();
    await page.waitForTimeout(2000);
    const formSubmitted1 = await page.evaluate(() => window.LANDING_DEBUG?.handleSubmitCalled);
    console.log('Form submitted after button click:', formSubmitted1);
  }

  if (!await page.evaluate(() => window.LANDING_DEBUG?.handleSubmitCalled)) {
    // Method 2: Press Enter in password field
    console.log('Method 2: Pressing Enter in password field...');
    await page.getByPlaceholder(/password/i).press('Enter');
    await page.waitForTimeout(2000);
    const formSubmitted2 = await page.evaluate(() => window.LANDING_DEBUG?.handleSubmitCalled);
    console.log('Form submitted after Enter key:', formSubmitted2);
  }

  const finalState = await page.evaluate(() => ({
    handleSubmitCalled: window.LANDING_DEBUG?.handleSubmitCalled,
    loginReturned: window.LANDING_DEBUG?.loginReturned,
    url: window.location.href
  }));

  console.log('\n=== FINAL STATE ===');
  console.log(JSON.stringify(finalState, null, 2));
});

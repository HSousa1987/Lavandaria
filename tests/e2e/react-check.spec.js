const { test, expect } = require('@playwright/test');

test('Check if React is properly rendering and functioning', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  // Check if React DevTools fiber root is available
  const reactInfo = await page.evaluate(() => {
    const root = document.getElementById('root');
    if (!root) return { root: 'NOT_FOUND' };

    // Try to access React's internal data
    const keys = Object.keys(root);
    const reactKey = keys.find(key => key.startsWith('__react'));

    return {
      rootFound: !!root,
      reactKeyFound: !!reactKey,
      childrenCount: root.children.length,
      firstChildType: root.firstChild?.nodeName,
      html: root.innerHTML.substring(0, 500)
    };
  });

  console.log('\n=== REACT CHECK ===');
  console.log(JSON.stringify(reactInfo, null, 2));

  // Check if clicking buttons works for other interactions
  await page.evaluate(() => {
    window.BUTTON_TEST = { clicked: false };
  });

  // Add a click listener to a non-form button
  await page.evaluate(() => {
    const staffButton = Array.from(document.querySelectorAll('button')).find(btn =>
      btn.textContent.includes('Staff')
    );
    if (staffButton) {
      staffButton.addEventListener('click', () => {
        window.BUTTON_TEST.clicked = true;
      });
    }
  });

  // Click the Staff button
  await page.getByRole('button', { name: /Staff/i }).click();
  await page.waitForTimeout(500);

  const buttonClicked = await page.evaluate(() => window.BUTTON_TEST?.clicked);
  console.log('Staff button click detected by event listener:', buttonClicked);

  // Now try to set up a form submit listener
  await page.evaluate(() => {
    window.FORM_TEST = { submitted: false };
    const form = document.querySelector('form');
    if (form) {
      form.addEventListener('submit', (e) => {
        console.log('Form submit event caught by DOM listener');
        window.FORM_TEST.submitted = true;
      }, true); // Use capture phase
    }
  });

  // Fill and try to submit
  await page.getByPlaceholder(/username/i).fill('master');
  await page.getByPlaceholder(/password/i).fill('master123');

  // Try to submit with button click
  await page.getByRole('button', { name: /Login/i }).first().click();
  await page.waitForTimeout(3000);

  const formCaught = await page.evaluate(() => window.FORM_TEST?.submitted);
  console.log('Form submit event caught by DOM listener:', formCaught);

  // Check if there were any JavaScript errors
  const jsErrors = await page.evaluate(() => {
    return window.__jsErrors || [];
  });

  console.log('JavaScript errors:', jsErrors.length);
});

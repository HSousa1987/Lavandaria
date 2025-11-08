const { test, expect } = require('@playwright/test');

test('Login form test - try different button selectors', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // Click Staff tab
  await page.getByRole('button', { name: /Staff/i }).click();
  await page.waitForTimeout(500);

  // Fill credentials
  await page.getByPlaceholder(/username/i).fill('master');
  await page.getByPlaceholder(/password/i).fill('master123');

  // Try multiple ways to submit the form
  console.log('Attempting to find form...');

  // Method 1: Find button by text "Login"
  const loginButton = page.getByRole('button', { name: /Login/i });
  console.log('Found login button');

  // Check if button is visible
  const isVisible = await loginButton.isVisible();
  console.log('Button visible:', isVisible);

  // Check button count
  const buttons = page.getByRole('button', { name: /Login/i });
  const count = await buttons.count();
  console.log('Login buttons found:', count);

  // Try to click and wait for navigation
  await loginButton.first().click();

  // Wait for any navigation or state change
  try {
    await page.waitForNavigation({ timeout: 3000 }).catch(() => {});
  } catch (e) {
    console.log('No navigation occurred within timeout');
  }

  await page.waitForTimeout(2000);

  // Check if form was submitted by looking at window state
  const formSubmitted = await page.evaluate(() => {
    return window.LANDING_DEBUG?.handleSubmitCalled === true;
  });

  console.log('Form submitted:', formSubmitted);

  // Check page state
  const finalUrl = page.url();
  console.log('Final URL:', finalUrl);

  if (formSubmitted) {
    console.log('SUCCESS: Form was submitted');
  } else {
    console.log('FAILURE: Form was not submitted');
    console.log('Trying to verify button element properties...');

    // Get button element details
    const buttonDetails = await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      if (!btn) return { found: false };
      return {
        found: true,
        disabled: btn.disabled,
        visible: btn.offsetParent !== null,
        innerHTML: btn.innerHTML.substring(0, 50),
        classList: Array.from(btn.classList)
      };
    });

    console.log('Button details:', JSON.stringify(buttonDetails, null, 2));
  }

  expect(formSubmitted).toBe(true);
});

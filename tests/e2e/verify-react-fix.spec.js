const { test, expect } = require('@playwright/test');

test('Verify React 18 downgrade fixed rendering', async ({ page }) => {
  console.log('📍 Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  
  // Check for the critical error
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  
  await page.waitForTimeout(1000);
  
  console.log('❌ Errors found:', errors.length);
  if (errors.length > 0) {
    console.log('Error details:', errors[0]);
  }
  
  // Check if Staff button exists (login form rendered)
  const staffButton = await page.locator('button:has-text("Staff")');
  const staffCount = await staffButton.count();
  
  console.log('✅ Staff button found:', staffCount > 0);
  expect(staffCount).toBeGreaterThan(0);
  
  // Verify no "Cannot access 'h' before initialization" error
  const hasInitError = errors.some(e => e.includes("Cannot access 'h' before initialization"));
  console.log('🐛 Has initialization error:', hasInitError);
  expect(hasInitError).toBe(false);
});

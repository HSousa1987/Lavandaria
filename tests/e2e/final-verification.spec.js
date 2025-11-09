const { test, expect } = require('@playwright/test');

test('Final verification - React 19 + CRUD forms', async ({ page }) => {
  const logs = [];
  const errors = [];

  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('✅ Page loaded');
  console.log(`❌ Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n🐛 ERRORS FOUND:');
    errors.forEach(err => console.log(`  - ${err}`));
  }

  const staffButton = await page.locator('button:has-text("Staff")').count();
  console.log(`🔘 Staff button found: ${staffButton > 0}`);

  expect(errors.length).toBe(0);
  expect(staffButton).toBeGreaterThan(0);
});

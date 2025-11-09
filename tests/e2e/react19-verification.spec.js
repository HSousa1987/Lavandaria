const { test, expect } = require('@playwright/test');

test('React 19 verification - Fresh containers', async ({ page }) => {
  const errors = [];
  const logs = [];

  page.on('console', msg => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
  });

  page.on('pageerror', err => {
    errors.push(err.message);
    console.log('❌ PAGE ERROR:', err.message);
  });

  console.log('🔍 Testing React 19 with fresh containers...');

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log(`\n📊 RESULTS:`);
  console.log(`  Errors detected: ${errors.length}`);
  console.log(`  Console messages: ${logs.length}`);

  if (errors.length > 0) {
    console.log(`\n❌ ERRORS FOUND:`);
    errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.substring(0, 200)}`);
    });
  }

  // Check for React initialization error
  const hasReactError = errors.some(e =>
    e.includes("Cannot access 'h' before initialization") ||
    e.includes("ReferenceError")
  );

  // Check if UI rendered
  const staffButton = await page.locator('button:has-text("Staff")').count();
  const loginForm = await page.locator('form').count();
  const anyContent = await page.locator('body').textContent();

  console.log(`\n🎯 UI CHECK:`);
  console.log(`  Staff button found: ${staffButton > 0}`);
  console.log(`  Login form found: ${loginForm > 0}`);
  console.log(`  Page has content: ${anyContent.length > 100}`);
  console.log(`  Has React error: ${hasReactError}`);

  // Take screenshot for evidence
  await page.screenshot({ path: 'test-results/react19-verification.png', fullPage: true });
  console.log(`\n📸 Screenshot saved: test-results/react19-verification.png`);

  // VERDICT
  if (hasReactError) {
    console.log(`\n⚠️  VERDICT: REACT 19 HAS INITIALIZATION ERROR`);
    expect(hasReactError).toBe(false); // This will fail the test
  } else if (staffButton === 0 && loginForm === 0) {
    console.log(`\n⚠️  VERDICT: APP NOT RENDERING (no UI elements found)`);
    expect(staffButton).toBeGreaterThan(0);
  } else {
    console.log(`\n✅ VERDICT: REACT 19 WORKING CORRECTLY`);
    expect(errors.length).toBe(0);
    expect(staffButton).toBeGreaterThan(0);
  }
});

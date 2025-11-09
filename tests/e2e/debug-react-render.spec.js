const { test, expect } = require('@playwright/test');

test('Debug React rendering', async ({ page }) => {
  // Capture console logs and errors
  const logs = [];
  const errors = [];

  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => errors.push(err.message));

  console.log('📍 Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Wait a bit for React to hydrate
  await page.waitForTimeout(3000);

  // Get page content
  const htmlContent = await page.content();
  const rootContent = await page.locator('#root').innerHTML();

  console.log('\n🔍 PAGE ANALYSIS:');
  console.log('================');
  console.log('✅ Page loaded');
  console.log(`📋 Total console messages: ${logs.length}`);
  console.log(`❌ Total errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n🐛 ERRORS:');
    errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  }

  if (logs.length > 0) {
    console.log('\n📝 CONSOLE LOGS (last 10):');
    logs.slice(-10).forEach(log => console.log(`  ${log}`));
  }

  console.log(`\n📦 Root div content length: ${rootContent.length} characters`);
  console.log(`📄 Root div content preview: ${rootContent.substring(0, 200)}...`);

  // Check for specific elements
  const hasStaffButton = await page.locator('button:has-text("Staff")').count() > 0;
  const hasLoginForm = await page.locator('form').count() > 0;
  const hasAnyButton = await page.locator('button').count() > 0;
  const hasAnyDiv = await page.locator('div').count() > 0;

  console.log('\n🎯 ELEMENT CHECK:');
  console.log(`  Staff button: ${hasStaffButton}`);
  console.log(`  Login form: ${hasLoginForm}`);
  console.log(`  Any button: ${hasAnyButton}`);
  console.log(`  Any div: ${hasAnyDiv}`);

  // Take a screenshot
  await page.screenshot({ path: 'test-results/debug-render.png', fullPage: true });
  console.log('\n📸 Screenshot saved to test-results/debug-render.png');
});

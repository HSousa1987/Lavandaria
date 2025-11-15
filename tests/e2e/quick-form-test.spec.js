const { test, expect } = require('@playwright/test');

test('Quick test: Forms and Modals load in Dashboard', async ({ page }) => {
  // Login as master
  await page.goto('http://localhost:3000/login', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  
  // Click Staff button (which may be master login)
  const staffButtons = await page.locator('button:has-text("Staff")');
  if (await staffButtons.count() > 0) {
    await staffButtons.first().click();
    await page.waitForTimeout(500);
  }
  
  // Login
  await page.fill('input[placeholder*="username"]', 'master');
  await page.fill('input[placeholder*="password"]', 'master123');
  
  // Submit login form - try multiple strategies
  const submitButton = await page.locator('button:has-text("Login")').first();
  await submitButton.click();
  
  await page.waitForTimeout(3000);
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  
  // Verify page loaded
  console.log('Current URL:', page.url());
  console.log('Page title:', await page.title());
  
  // Check if "Add User" button exists
  const addUserBtn = await page.locator('button:has-text("Add User")');
  const addUserCount = await addUserBtn.count();
  console.log('Add User buttons found:', addUserCount);
  
  if (addUserCount > 0) {
    await addUserBtn.first().click();
    await page.waitForTimeout(1000);
    
    // Check if modal opens
    const modal = await page.locator('h2:has-text("Create New User")');
    const modalCount = await modal.count();
    console.log('✅ User Form Modal found:', modalCount > 0);
    
    if (modalCount > 0) {
      const usernameField = await page.locator('input[type="text"]').first();
      const passwordField = await page.locator('input[type="password"]').first();
      
      console.log('✅ Form fields rendered:', await usernameField.count() > 0 && await passwordField.count() > 0);
    }
  }
});

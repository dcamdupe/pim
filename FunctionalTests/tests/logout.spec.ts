import { test, expect } from '@playwright/test';

test.describe('Logout', () => {
  test('hovering the profile icon reveals a menu with Logout, which clears the session', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const logoutItem = page.getByRole('menuitem', { name: 'Logout' });
    await expect(logoutItem).toBeHidden();

    await page.getByRole('button', { name: 'Account menu' }).hover();
    await expect(logoutItem).toBeVisible();
    await logoutItem.click();

    await expect(page).toHaveURL(/\/login$/);
    const storedAuth = await page.evaluate(() => localStorage.getItem('pim.auth'));
    expect(storedAuth).toBeNull();

    // Confirm the session is actually gone, not just the URL - a protected route should
    // bounce straight back to login rather than allow navigation.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });
});

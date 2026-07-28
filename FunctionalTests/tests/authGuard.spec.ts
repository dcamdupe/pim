import { test, expect } from '@playwright/test';

test.describe('Auth guard', () => {
  test('redirects to login when visiting a protected route while unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('stays on a protected route after a page reload once logged in', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.reload();

    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

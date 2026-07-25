import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('logs in with a valid login and password', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#login').fill('testuser');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('shows an error for an invalid login/password', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#login').fill('testuser');
    await page.locator('#password').fill('wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.locator('.form-error')).toHaveText('Invalid login or password.');
    await expect(page).toHaveURL(/\/login$/);
  });
});

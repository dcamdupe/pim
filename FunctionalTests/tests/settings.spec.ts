import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test('reaches settings via the cog, adds an account, and it persists across reload', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);

    const rowsBefore = await page.locator('.account-row').count();

    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill('Playwright Test Account');
    await newRow.locator('input').nth(1).fill('999999');
    await newRow.locator('select').selectOption('Savings');

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(page.locator('.account-row')).toHaveCount(rowsBefore + 1);

    await page.reload();
    await expect(page.locator('.account-row')).toHaveCount(rowsBefore + 1);
    const persistedRow = page.locator('.account-row').last();
    await expect(persistedRow.locator('input').nth(0)).toHaveValue('Playwright Test Account');
    await expect(persistedRow.locator('select')).toHaveValue('Savings');

    // clean up so repeated runs don't keep accumulating accounts on the shared seeded user
    await persistedRow.getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.account-row')).toHaveCount(rowsBefore);
  });
});

import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test('reaches settings via the cog, adds an account, and it persists across reload', async ({ page }) => {
    // Unique per run - a fixed literal name risks colliding with a same-named leftover from an
    // earlier run that didn't reach its cleanup step, which the account-name uniqueness
    // validation (UBE-57) would then correctly (but inconveniently, for this test) reject.
    const accountName = `Playwright Test Account ${Date.now()}`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);

    // Wait for the async accounts fetch to resolve before reading a "before" count, or this
    // races ahead of it and reads 0.
    await page.getByRole('button', { name: '+ Add account' }).waitFor();
    const rowsBefore = await page.locator('.account-row').count();

    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(accountName);
    await newRow.locator('input').nth(1).fill('999999');
    await newRow.locator('select').selectOption('Savings');

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(page.locator('.account-row')).toHaveCount(rowsBefore + 1);

    await page.reload();
    await expect(page.locator('.account-row')).toHaveCount(rowsBefore + 1);
    const persistedRow = page.locator('.account-row').last();
    await expect(persistedRow.locator('input').nth(0)).toHaveValue(accountName);
    await expect(persistedRow.locator('select')).toHaveValue('Savings');

    // clean up so repeated runs don't keep accumulating accounts on the shared seeded user -
    // removal of an already-saved account is immediate via a confirmation modal (UBE-57), not
    // deferred to Save.
    await persistedRow.getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.locator('.account-row')).toHaveCount(rowsBefore);
  });
});

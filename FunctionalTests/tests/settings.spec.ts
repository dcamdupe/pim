import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test('reaches settings via the cog, adds an account, and it persists across reload', async ({ page }) => {
    // Unique per run, to avoid colliding with a same-named leftover from an earlier run that
    // didn't reach cleanup - which account-name uniqueness validation would then correctly reject.
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
    await newRow.locator('select').selectOption('Savings');

    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();
    await expect(page.locator('.account-row')).toHaveCount(rowsBefore + 1);

    await page.reload();
    await expect(page.locator('.account-row')).toHaveCount(rowsBefore + 1);
    const persistedRow = page.locator('.account-row').last();
    await expect(persistedRow.locator('input').nth(0)).toHaveValue(accountName);
    await expect(persistedRow.locator('select')).toHaveValue('Savings');

    // Name is the account's key and can't be edited once saved - unlike Type, which stays
    // editable (the select above isn't disabled).
    await expect(persistedRow.locator('input').nth(0)).toHaveAttribute('readonly', '');

    // clean up so repeated runs don't keep accumulating accounts on the shared seeded user -
    // removal is immediate via a confirmation modal, not deferred to Save.
    await persistedRow.getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.locator('.account-row')).toHaveCount(rowsBefore);
  });

  test('adds a category, it appears in the transaction category dropdown, then deletes it via the confirm modal', async ({
    page,
  }) => {
    // Unique per run, same reasoning as the account test above - the Api rejects duplicate
    // category names (case-insensitive) for the same user.
    const categoryName = `Playwright Category ${Date.now()}`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);

    await page.locator('#new-category-name').fill(categoryName);
    await page.getByRole('button', { name: '+ Add category' }).click();
    await expect(page.getByText(categoryName)).toBeVisible();

    // The Transactions page's category dropdown is only populated at mount time from the
    // local-storage cache, which onAddCategory refreshes - a fresh navigation is required to see it.
    await page.getByRole('link', { name: 'Transactions' }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.getByLabel('Category filter').locator('option', { hasText: categoryName })).toHaveCount(1);

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);

    const categoryRow = page.locator('.category-row', { hasText: categoryName });
    await categoryRow.getByRole('button', { name: `Remove category ${categoryName}` }).click();
    await expect(page.getByText('Delete category?')).toBeVisible();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('Delete category?')).not.toBeVisible();
    await expect(page.locator('.category-name', { hasText: categoryName })).toHaveCount(0);
  });
});

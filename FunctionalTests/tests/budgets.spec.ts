import { test, expect, type Page } from '@playwright/test';

// UBE-119: recurring monthly budgets per Expense category, set from the Budgets tab.
async function clearAllBudgets(page: Page) {
  for (const input of await page.locator('.budget-input').all()) {
    await input.fill('');
  }
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
}

test.describe('Budgets', () => {
  test('sets, saves and reloads monthly category budgets', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Budgets' }).click();
    await expect(page).toHaveURL(/\/budgets$/);
    await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible();

    // Start from a clean slate - the seeded user is shared across runs.
    await clearAllBudgets(page);

    // Only Expense categories are listed - Income / Ignore ones can't have a budget.
    await expect(page.getByLabel('Groceries', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Income', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Internal Transfer', { exact: true })).toHaveCount(0);

    await page.getByLabel('Groceries', { exact: true }).fill('800');
    await page.getByLabel('Dining', { exact: true }).fill('150.50');
    await expect(page.getByTestId('budget-total')).toHaveText('$950.50');

    // An invalid amount blocks saving until it's fixed.
    await page.getByLabel('Transport', { exact: true }).fill('abc');
    await expect(page.getByText('Enter an amount like 250 or 99.50.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    await page.getByLabel('Transport', { exact: true }).fill('');

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Groceries', { exact: true })).toHaveValue('800');
    await expect(page.getByLabel('Dining', { exact: true })).toHaveValue('150.50');
    await expect(page.getByLabel('Transport', { exact: true })).toHaveValue('');
    await expect(page.getByTestId('budget-total')).toHaveText('$950.50');

    await clearAllBudgets(page);
    await page.reload();
    await expect(page.getByLabel('Groceries', { exact: true })).toHaveValue('');
  });
});

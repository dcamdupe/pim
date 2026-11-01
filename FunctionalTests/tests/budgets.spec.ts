import { test, expect, type Page } from '@playwright/test';

// UBE-119: recurring monthly budgets per Expense category, set from the Budgets tab.
async function clearAllBudgets(page: Page) {
  // Wait for the saved budgets to load first, or clearing races the page's own load.
  await expect(page.locator('.budget-input').first()).toBeVisible();
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

    await page.getByRole('link', { name: 'Budgets', exact: true }).click();
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

  test('shows 6-month recommendations and copies one or all into the fields (UBE-123)', async ({ page }) => {
    // The averages themselves are covered by the Api tests - stub them here so the UI checks don't
    // depend on the shared test user's transaction history.
    await page.route('**/budgets/recommendations?month=*', (route) =>
      route.fulfill({
        json: [
          { category: 'Groceries', amount: 612 },
          { category: 'Dining', amount: 145 },
        ],
      }),
    );

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole('link', { name: 'Budgets', exact: true }).click();
    await clearAllBudgets(page);

    await expect(page.getByTestId('recommended-Groceries')).toContainText('$612.00');
    await expect(page.getByTestId('recommended-Dining')).toContainText('$145.00');
    await expect(page.getByTestId('recommended-Transport')).toHaveText('—');

    // Copy a single recommendation.
    await page.getByRole('button', { name: 'Use recommended budget for Dining' }).click();
    await expect(page.getByLabel('Dining', { exact: true })).toHaveValue('145');
    await expect(page.getByLabel('Groceries', { exact: true })).toHaveValue('');

    // "Use all" fills every category with a recommendation and leaves the rest alone.
    await page.getByLabel('Transport', { exact: true }).fill('80');
    await page.getByRole('button', { name: 'Use all' }).click();
    await expect(page.getByLabel('Groceries', { exact: true })).toHaveValue('612');
    await expect(page.getByLabel('Dining', { exact: true })).toHaveValue('145');
    await expect(page.getByLabel('Transport', { exact: true })).toHaveValue('80');
    await expect(page.getByTestId('budget-total')).toHaveText('$837.00');

    // Copying only fills the fields - nothing is saved until Save.
    await page.reload();
    await expect(page.getByLabel('Groceries', { exact: true })).toHaveValue('');
  });
});

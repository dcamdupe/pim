import { test, expect, type Page } from '@playwright/test';

// UBE-124: budget projection + 6-month budget performance cards on the dashboard. Spend amounts
// depend on the shared test user's data, so these check the budgets side and the card wiring.

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill('testuser@example.com');
  await page.locator('#password').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function setBudgets(page: Page, budgets: Record<string, string>) {
  await page.getByRole('link', { name: 'Budgets', exact: true }).click();
  // Wait for the saved budgets to load first, or clearing races the page's own load.
  await expect(page.locator('.budget-input').first()).toBeVisible();
  for (const input of await page.locator('.budget-input').all()) {
    await input.fill('');
  }
  for (const [category, amount] of Object.entries(budgets)) {
    await page.getByLabel(category, { exact: true }).fill(amount);
  }
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
}

function currentMonthKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

test.describe('Dashboard budget cards', () => {
  test('shows the month projection and 6-month performance for budgeted categories', async ({ page }) => {
    await login(page);
    await setBudgets(page, { Groceries: '800', Dining: '150' });

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await page.getByRole('combobox', { name: 'Month filter' }).selectOption(currentMonthKey());

    const projection = page.getByTestId('budget-projection-card');
    await expect(projection.getByRole('heading', { name: 'Month projection' })).toBeVisible();
    await expect(projection).toContainText(/Projected \$[\d,]+ of \$950/);
    await expect(projection.getByTestId('projection-Groceries')).toContainText('of $800');
    await expect(projection.getByTestId('projection-Dining')).toContainText('of $150');
    // Only budgeted categories get a row.
    await expect(projection.getByTestId('projection-Transport')).toHaveCount(0);

    const history = page.getByTestId('budget-history-card');
    await expect(history.getByRole('heading', { name: 'Budget performance' })).toBeVisible();
    const filter = history.getByRole('combobox', { name: 'Budget performance category' });
    await expect(filter.locator('option')).toHaveText(['All budgeted categories', 'Dining', 'Groceries']);
    await filter.selectOption('Dining');
    await page.reload();
    await expect(history.getByRole('combobox', { name: 'Budget performance category' })).toHaveValue('Dining');
    // Budget bars are always drawn when a budget exists, so the chart (not the empty state) shows.
    await expect(history.locator('svg.bar-chart')).toBeVisible();
    await filter.selectOption('');

    // Clean up, then both cards fall back to the "No budgets set" state.
    await setBudgets(page, {});
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(projection.getByText('No budgets set.')).toBeVisible();
    await expect(history.getByText('No budgets set.')).toBeVisible();
  });
});

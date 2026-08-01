import { test, expect } from '@playwright/test';

function formatForUpload(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// Tile values are plain "$1,234" / "−$1,234" text, not test ids - parse them back to numbers.
function parseCurrency(text: string): number {
  const negative = text.trim().startsWith('−');
  const digits = text.replace(/[^0-9.]/g, '');
  const value = Number(digits);
  return negative ? -value : value;
}

async function tileValue(page: import('@playwright/test').Page, label: string): Promise<number> {
  const kpi = page.locator('.kpi', { has: page.locator('.label', { hasText: label }) });
  const text = await kpi.locator('.value').innerText();
  return parseCurrency(text);
}

test.describe('Dashboard tiles', () => {
  test('computes profit and expenses for the current month and the previous 6 months', async ({ page }) => {
    const runId = Date.now();
    const monthName = new Date().toLocaleDateString(undefined, { month: 'long' });

    const today = new Date();
    // Safely inside the previous-6-months window regardless of which day "today" is.
    const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 10);

    const incomeThisMonth = `DashIncomeThisMonth${runId}`;
    const expenseThisMonth = `DashExpenseThisMonth${runId}`;
    const incomePrior = `DashIncomePrior${runId}`;
    const expensePriorActive = `DashExpensePriorActive${runId}`;
    const expensePriorInactive = `DashExpensePriorInactive${runId}`;

    const csv =
      '131150S1,,,,,\n' +
      `${formatForUpload(today)},,"${incomeThisMonth}",,3000.00,637.57\n` +
      `${formatForUpload(today)},,"${expenseThisMonth}",,-200.00,637.57\n` +
      `${formatForUpload(twoMonthsAgo)},,"${incomePrior}",,1000.00,637.57\n` +
      `${formatForUpload(twoMonthsAgo)},,"${expensePriorActive}",,-300.00,637.57\n` +
      `${formatForUpload(twoMonthsAgo)},,"${expensePriorInactive}",,-999.00,637.57\n`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Capture "before" tile values so assertions are robust to the shared, never-cleaned-up test
    // dataset accumulated by every other spec in this suite - only the *delta* this test causes
    // is asserted, not an absolute total.
    const before = {
      currentProfit: await tileValue(page, `${monthName} profit`),
      priorProfit: await tileValue(page, 'previous 6 month profit'),
      currentExpenses: await tileValue(page, `${monthName} Expenses`),
      priorExpenses: await tileValue(page, 'previous 6 month expenses'),
    };

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(`DashAccount${runId}`);
    await newRow.locator('input').nth(1).fill('333777');
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(`DashAccount${runId}`);
    await page.locator('#file-input').setInputFiles({ name: 'dash.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await page.getByLabel('Date range').selectOption('allTime');

    async function categorize(desc: string, category: string) {
      const row = page.locator('tr', { hasText: desc });
      await row.locator('.category-select').selectOption(category);
      const dialog = page.getByRole('dialog');
      if (await dialog.isVisible().catch(() => false)) {
        await page.getByRole('button', { name: 'Just this one' }).click();
      }
    }

    await categorize(incomeThisMonth, 'Income');
    await categorize(expenseThisMonth, 'Groceries');
    await categorize(incomePrior, 'Income');
    await categorize(expensePriorActive, 'Dining');
    await categorize(expensePriorInactive, 'Dining');

    // Mark the "prior" inactive-expense transaction inactive so it's excluded from the tiles.
    const inactiveRow = page.locator('tr', { hasText: expensePriorInactive });
    await inactiveRow.getByRole('button', { name: `Actions for ${expensePriorInactive}` }).click();
    await inactiveRow.getByRole('menuitem', { name: 'Set inactive' }).click();
    await expect(inactiveRow.getByText('Inactive')).toBeVisible();

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByText(`${monthName} profit`)).toBeVisible();

    const after = {
      currentProfit: await tileValue(page, `${monthName} profit`),
      priorProfit: await tileValue(page, 'previous 6 month profit'),
      currentExpenses: await tileValue(page, `${monthName} Expenses`),
      priorExpenses: await tileValue(page, 'previous 6 month expenses'),
    };

    // Current month: income 3000, expense 200 -> profit +2800, expenses +200.
    expect(after.currentProfit - before.currentProfit).toBe(2800);
    expect(after.currentExpenses - before.currentExpenses).toBe(200);
    // Previous 6 months: income 1000, active expense 300 (the -999 inactive one excluded)
    // -> profit +700, expenses +300.
    expect(after.priorProfit - before.priorProfit).toBe(700);
    expect(after.priorExpenses - before.priorExpenses).toBe(300);

    // Tiles 2 & 4 ("previous 6 month ...") never show a delta icon - the tile still renders a
    // same-sized placeholder pill (kept invisible) so all 4 tiles line up regardless of whether
    // a real delta is shown, so this checks visibility, not absence.
    const priorProfitTile = page.locator('.kpi', { has: page.locator('.label', { hasText: 'previous 6 month profit' }) });
    await expect(priorProfitTile.locator('.delta-pill')).not.toBeVisible();
    const priorExpensesTile = page.locator('.kpi', { has: page.locator('.label', { hasText: 'previous 6 month expenses' }) });
    await expect(priorExpensesTile.locator('.delta-pill')).not.toBeVisible();

    // clean up the Settings account added for this test.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
  });
});

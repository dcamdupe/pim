import { test, expect } from '@playwright/test';

function formatForUpload(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function monthYearLabel(date: Date): string {
  return `${date.toLocaleString('en-US', { month: 'long' })} ${date.getFullYear()}`;
}

// "February 2026 - July 2026" for a selected month of August 2026 - mirrors
// dashboardMetrics.ts's formatSixMonthRangeLabel.
function sixMonthRangeLabel(selectedMonth: Date): string {
  const end = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 0);
  const start = new Date(end.getFullYear(), end.getMonth() - 5, 1);
  return `${monthYearLabel(start)} - ${monthYearLabel(end)}`;
}

function monthOptionValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// The month filter's options only cover minTransactionDate onward once /settings has loaded (it
// starts out current-month-only) - wait for the target option to exist before selecting it.
async function selectMonth(page: import('@playwright/test').Page, date: Date) {
  const option = page.locator('.month-select option', { hasText: monthYearLabel(date) });
  await expect(option).toHaveCount(1);
  await page.getByLabel('Month filter').selectOption(monthOptionValue(date));
}

// Tile values are plain "$1,234" / "−$1,234" text, not test ids - parse them back to numbers.
function parseCurrency(text: string): number {
  const negative = text.trim().startsWith('−');
  const digits = text.replace(/[^0-9.]/g, '');
  const value = Number(digits);
  return negative ? -value : value;
}

// Tiles are positional: 0 = current month profit, 1 = previous-6-months profit,
// 2 = current month expenses, 3 = previous-6-months expenses. Tiles 1 & 3 now render the *same*
// month-range label text (UBE-70), so they're no longer distinguishable by label.
async function tileValue(page: import('@playwright/test').Page, index: number): Promise<number> {
  const kpi = page.locator('.kpi-row .kpi').nth(index);
  const text = await kpi.locator('.value').innerText();
  return parseCurrency(text);
}

test.describe('Dashboard tiles', () => {
  test('computes profit and expenses for the current month and the previous 6 months', async ({ page }) => {
    const runId = Date.now();

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
      currentProfit: await tileValue(page, 0),
      priorProfit: await tileValue(page, 1),
      currentExpenses: await tileValue(page, 2),
      priorExpenses: await tileValue(page, 3),
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
    await expect(page.locator('.kpi-row .kpi')).toHaveCount(4);

    const after = {
      currentProfit: await tileValue(page, 0),
      priorProfit: await tileValue(page, 1),
      currentExpenses: await tileValue(page, 2),
      priorExpenses: await tileValue(page, 3),
    };

    // Current month: income 3000, expense 200 -> profit +2800, expenses +200.
    expect(after.currentProfit - before.currentProfit).toBe(2800);
    expect(after.currentExpenses - before.currentExpenses).toBe(200);
    // Previous 6 months: income 1000, active expense 300 (the -999 inactive one excluded)
    // -> profit +700, expenses +300.
    expect(after.priorProfit - before.priorProfit).toBe(700);
    expect(after.priorExpenses - before.priorExpenses).toBe(300);

    // Tiles 1 & 3 (previous 6 months) never show a delta icon - the tile still renders a
    // same-sized placeholder pill (kept invisible) so all 4 tiles line up regardless of whether
    // a real delta is shown, so this checks visibility, not absence.
    await expect(page.locator('.kpi-row .kpi').nth(1).locator('.delta-pill')).not.toBeVisible();
    await expect(page.locator('.kpi-row .kpi').nth(3).locator('.delta-pill')).not.toBeVisible();

    // clean up the Settings account added for this test.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
  });
});

test.describe('Month filter', () => {
  test('changing the month filter re-scopes tiles and charts to the selected month', async ({ page }) => {
    const runId = Date.now();
    const today = new Date();
    // 3 months back - clear of the "Dashboard tiles" spec's own current-month/2-months-back fixtures.
    const targetMonth = new Date(today.getFullYear(), today.getMonth() - 3, 10);
    const income = `MonthFilterIncome${runId}`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Capture the target month's "before" tile 0 value ahead of the upload below, so the
    // assertion is a delta - robust to the shared, never-cleaned-up test dataset.
    await selectMonth(page, targetMonth);
    await expect(page.getByText(`${monthYearLabel(targetMonth)} profit`)).toBeVisible();
    const before = await tileValue(page, 0);

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(`MonthFilterAccount${runId}`);
    await newRow.locator('input').nth(1).fill('333779');
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(`MonthFilterAccount${runId}`);
    const csv = '131150S1,,,,,\n' + `${formatForUpload(targetMonth)},,"${income}",,1500.00,637.57\n`;
    await page.locator('#file-input').setInputFiles({ name: 'monthfilter.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await page.getByLabel('Date range').selectOption('allTime');
    await page.locator('tr', { hasText: income }).locator('.category-select').selectOption('Income');

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.locator('.kpi-row .kpi')).toHaveCount(4);
    // The filter resets to the current month on navigation - re-select the target month.
    await selectMonth(page, targetMonth);
    await expect(page.getByText(`${monthYearLabel(targetMonth)} profit`)).toBeVisible();

    const after = await tileValue(page, 0);
    expect(after - before).toBe(1500);

    // Tiles 1 & 3 and the Income vs. expenses card share the same 6-months-prior range label.
    const expectedRangeLabel = sixMonthRangeLabel(targetMonth);
    await expect(page.locator('.kpi-row .kpi').nth(1)).toContainText(expectedRangeLabel);
    await expect(page.locator('.kpi-row .kpi').nth(3)).toContainText(expectedRangeLabel);
    const incomeVsExpensesCard = page.locator('.card', { has: page.locator('h2', { hasText: 'Income vs. expenses' }) });
    await expect(incomeVsExpensesCard.locator('.card-sub')).toHaveText(expectedRangeLabel);

    // clean up the Settings account added for this test.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
  });
});

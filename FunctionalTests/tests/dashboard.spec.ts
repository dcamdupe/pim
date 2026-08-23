import { test, expect } from '@playwright/test';

function formatForUpload(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function qifRecord(date: Date, description: string, amount: string): string {
  return `D${formatForUpload(date)}\nM${description}\nT${amount}\n^\n`;
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
// month-range label text, so they're no longer distinguishable by label.
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
    const expensePriorIgnore = `DashExpensePriorIgnore${runId}`;

    const qif =
      '!Type:Bank\n' +
      qifRecord(today, incomeThisMonth, '3000.00') +
      qifRecord(today, expenseThisMonth, '-200.00') +
      qifRecord(twoMonthsAgo, incomePrior, '1000.00') +
      qifRecord(twoMonthsAgo, expensePriorActive, '-300.00') +
      qifRecord(twoMonthsAgo, expensePriorIgnore, '-999.00');

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
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(`DashAccount${runId}`);
    await page.locator('#file-input').setInputFiles({ name: 'dash.qif', mimeType: 'text/plain', buffer: Buffer.from(qif) });
    await page.getByRole('button', { name: 'Save' }).first().click();
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
    await categorize(expensePriorIgnore, 'Dining');

    // Ignore the "prior" expense transaction so it's excluded from the tiles.
    const ignoreRow = page.locator('tr', { hasText: expensePriorIgnore });
    await ignoreRow.getByRole('button', { name: `Actions for ${expensePriorIgnore}` }).click();
    await ignoreRow.getByRole('menuitem', { name: 'Ignore', exact: true }).click();
    // Checked via the chip's own element (not getByText) since this row's description itself
    // contains "Ignore", which a plain substring text search would also match.
    await expect(ignoreRow.locator('.chip')).toHaveText('Ignore');

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
    // Previous 6 months: income 1000, active expense 300 (the -999 ignored one excluded)
    // -> profit +700, expenses +300, shown on the tile as an average over 6 months.
    // The tile displays whole dollars (no cents), and "before"/"after" are each independently
    // rounded before this delta is taken, so up to ~$1 of combined rounding error is expected -
    // tighter than that would mean the average math itself is wrong.
    expect(Math.abs(after.priorProfit - before.priorProfit - 700 / 6)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.priorExpenses - before.priorExpenses - 300 / 6)).toBeLessThanOrEqual(1);

    // Tiles 1 & 3 (previous 6 months) never show a delta icon - a same-sized placeholder pill
    // (kept invisible) keeps all 4 tiles aligned, so this checks visibility, not absence.
    await expect(page.locator('.kpi-row .kpi').nth(1).locator('.delta-pill')).not.toBeVisible();
    await expect(page.locator('.kpi-row .kpi').nth(3).locator('.delta-pill')).not.toBeVisible();

    // clean up the Settings account added for this test - removal is immediate via a
    // confirmation modal, not deferred to Save.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
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
    // Tile 0's label is just "<Month> <Year>" now (the "profit" suffix was dropped - the tile's
    // "Profit" kicker carries that instead), so wait for it specifically rather than by full text.
    await expect(page.locator('.kpi-row .kpi').nth(0).locator('.label')).toHaveText(monthYearLabel(targetMonth));
    const before = await tileValue(page, 0);

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(`MonthFilterAccount${runId}`);
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(`MonthFilterAccount${runId}`);
    const qif = '!Type:Bank\n' + qifRecord(targetMonth, income, '1500.00');
    await page.locator('#file-input').setInputFiles({ name: 'monthfilter.qif', mimeType: 'text/plain', buffer: Buffer.from(qif) });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);
    await page.getByLabel('Date range').selectOption('allTime');
    await page.locator('tr', { hasText: income }).locator('.category-select').selectOption('Income');

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.locator('.kpi-row .kpi')).toHaveCount(4);
    // The filter is remembered across navigation - no need to re-select it; assert the
    // <select> itself still shows the previously-chosen month, not just the tiles it drove.
    await expect(page.getByLabel('Month filter')).toHaveValue(monthOptionValue(targetMonth));
    // Tile 0's label is just "<Month> <Year>" now (the "profit" suffix was dropped - the tile's
    // "Profit" kicker carries that instead), so wait for it specifically rather than by full text.
    await expect(page.locator('.kpi-row .kpi').nth(0).locator('.label')).toHaveText(monthYearLabel(targetMonth));

    const after = await tileValue(page, 0);
    expect(after - before).toBe(1500);

    // Tiles 1 & 3 and the Income vs. expenses card share the same 6-months-prior range label.
    const expectedRangeLabel = sixMonthRangeLabel(targetMonth);
    await expect(page.locator('.kpi-row .kpi').nth(1)).toContainText(expectedRangeLabel);
    await expect(page.locator('.kpi-row .kpi').nth(3)).toContainText(expectedRangeLabel);
    const incomeVsExpensesCard = page.locator('.card', { has: page.locator('h2', { hasText: 'Income vs. expenses' }) });
    await expect(incomeVsExpensesCard.locator('.card-sub')).toHaveText(expectedRangeLabel);

    // clean up the Settings account added for this test - removal is immediate via a
    // confirmation modal, not deferred to Save.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Recent transactions', () => {
  test('shows an uploaded, categorised transaction in the list, read-only', async ({ page }) => {
    const runId = Date.now();
    const today = new Date();
    const description = `RecentTxn${runId}`;

    const qif = '!Type:Bank\n' + qifRecord(today, description, '-45.67');

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(`RecentAccount${runId}`);
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(`RecentAccount${runId}`);
    await page.locator('#file-input').setInputFiles({ name: 'recent.qif', mimeType: 'text/plain', buffer: Buffer.from(qif) });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);
    await page.getByLabel('Date range').selectOption('allTime');

    const row = page.locator('tr', { hasText: description });
    await row.locator('.category-select').selectOption('Dining');

    await page.getByRole('link', { name: 'Dashboard' }).click();
    const card = page.locator('.card.recent-card');
    await expect(card.getByText('Recent transactions')).toBeVisible();

    // Same-date transactions from other specs in this shared, never-cleaned-up test dataset make
    // list *position* unreliable - find the row by its unique description instead of assuming
    // it's first.
    const ownRow = card.locator('.recent-row', { hasText: description });
    await expect(ownRow).toContainText('Dining');
    await expect(ownRow).toContainText('−$45.67');

    // Read-only: no category (or any other) form control in the recent-transactions card.
    await expect(card.locator('select')).toHaveCount(0);

    await card.getByRole('link', { name: 'View all →' }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // clean up the Settings account added for this test - removal is immediate via a
    // confirmation modal, not deferred to Save.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Category chart', () => {
  test('center label shows the selected month, and clicking a segment filters Transactions to it', async ({ page }) => {
    const runId = Date.now();
    const today = new Date();
    const description = `DoughnutClick${runId}`;

    const qif = '!Type:Bank\n' + qifRecord(today, description, '-50.00');

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(`DoughnutAccount${runId}`);
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(`DoughnutAccount${runId}`);
    await page.locator('#file-input').setInputFiles({ name: 'doughnut.qif', mimeType: 'text/plain', buffer: Buffer.from(qif) });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);
    await page.getByLabel('Date range').selectOption('allTime');
    await page.locator('tr', { hasText: description }).locator('.category-select').selectOption('Groceries');
    // Leave the filter bar with a search/account filter set - the "other filters cleared" check
    // below is meaningless unless there was something to clear.
    await page.getByLabel('Search description').fill('leftover-filter-probe');
    await page.getByLabel('Account filter').selectOption(`DoughnutAccount${runId}`);

    await page.getByRole('link', { name: 'Dashboard' }).click();
    // Not the literal "this month" - the doughnut's center label now tracks the selected month.
    await expect(page.locator('.doughnut-center-label')).toHaveText(monthYearLabel(today));

    // A default click targets the element's bounding-box center - for this fixture, the only
    // category is 100% of expenses, so the wedge's bbox spans the whole ring and its center is
    // the doughnut's middle hole (under the center-value/label text), not the ring itself. Click
    // a point on the ring's right side (3 o'clock, within its 52-76 radius band) instead - not the
    // top (12 o'clock), which is where a same-100%-sweep wedge's tiny seam gap sits.
    await page.locator('.doughnut-seg', { hasText: 'Groceries' }).first().click({ position: { x: 140, y: 76 } });
    await expect(page).toHaveURL(/\/transactions\?/);

    await expect(page.getByLabel('Date range')).toHaveValue(`month:${monthOptionValue(today)}`);
    await expect(page.getByLabel('Category filter')).toHaveValue('Groceries');
    await expect(page.getByLabel('Search description')).toHaveValue('');
    await expect(page.getByLabel('Account filter')).toHaveValue('');
    await expect(page.locator('tr', { hasText: description })).toBeVisible();

    // clean up the Settings account added for this test - removal is immediate via a
    // confirmation modal, not deferred to Save.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

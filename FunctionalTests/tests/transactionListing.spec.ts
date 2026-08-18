import { test, expect } from '@playwright/test';

function formatForUpload(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

test.describe('Transaction listing', () => {
  test('shows uploaded transactions and filters by date range', async ({ page }) => {
    const runId = Date.now();
    const todayDesc = `Listing Test Today ${runId}`;
    const oldDesc = `Listing Test Old ${runId}`;
    const veryOldDesc = `Listing Test Very Old ${runId}`;

    const today = new Date();
    const sixWeeksAgo = new Date(today);
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42); // outside "last week"/"last month", inside "last 3 months"
    // Older than any hardcoded lookback window could plausibly use - only found under "All time"
    // if it's genuinely resolved from the real stored MinTransactionDate (UBE-47), not a guess.
    const veryOld = new Date(2010, 0, 1);

    const qif =
      '!Type:Bank\n' +
      `D${formatForUpload(today)}\nM${todayDesc}\nT-4.50\n^\n` +
      `D${formatForUpload(sixWeeksAgo)}\nM${oldDesc}\nT-9.00\n^\n` +
      `D${formatForUpload(veryOld)}\nM${veryOldDesc}\nT-1.00\n^\n`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // The upload flow needs an account to select from - add one via Settings first,
    // matching transactionUpload.spec.ts's add-then-cleanup pattern on the shared seeded user.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill('Playwright Listing Account');
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption('Playwright Listing Account');
    await page.locator('#file-input').setInputFiles({
      name: 'transactions.qif',
      mimeType: 'text/plain',
      buffer: Buffer.from(qif),
    });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);

    // Default filter is "Last month" - today's row shows, the 6-weeks-ago row doesn't.
    await expect(page.getByText(todayDesc)).toBeVisible();
    await expect(page.getByText(oldDesc)).not.toBeVisible();

    // Switch to "Last 3 months" - both rows show.
    await page.getByLabel('Date range').selectOption('threeMonths');
    await expect(page.getByText(todayDesc)).toBeVisible();
    await expect(page.getByText(oldDesc)).toBeVisible();

    // Switch to "Last week" - only today's row shows.
    await page.getByLabel('Date range').selectOption('week');
    await expect(page.getByText(todayDesc)).toBeVisible();
    await expect(page.getByText(oldDesc)).not.toBeVisible();

    // Switch to "All time" - all three rows show, including the 2010 one. Only possible if the
    // Api resolved the omitted startDate from the real stored MinTransactionDate, not a fixed
    // lookback window.
    await page.getByLabel('Date range').selectOption('allTime');
    await expect(page.getByText(todayDesc)).toBeVisible();
    await expect(page.getByText(oldDesc)).toBeVisible();
    await expect(page.getByText(veryOldDesc)).toBeVisible();

    // clean up the Settings account added for this test so repeated runs don't accumulate it
    // (the uploaded transactions themselves aren't cleaned up - there's no delete UI, matching
    // the same known limitation already accepted in transactionUpload.spec.ts)
    await page.getByRole('link', { name: 'Settings' }).click();
    const addedRow = page.locator('.account-row').last();
    await addedRow.getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('filters by search, account, category, and needs-a-category', async ({ page }) => {
    // Each description uses a distinct leading token (not just a distinct runId suffix on a
    // shared word) so none of them approximately-match each other via UBE-48's word-boundary
    // rule - categorising one must never pop up the "apply to similar transactions?" modal here.
    const runId = Date.now();
    const coffeeDesc = `FilterCoffee${runId} Shop`;
    const rentDesc = `FilterRent${runId} Payment`;
    const groceriesDesc = `FilterGroceries${runId} Store`;
    const salaryDesc = `FilterSalary${runId} Payroll`;
    const accountA = `Filter Test A ${runId}`;
    const accountB = `Filter Test B ${runId}`;

    const today = new Date();
    const dateForUpload = formatForUpload(today);
    const qifA =
      '!Type:Bank\n' +
      `D${dateForUpload}\nM${coffeeDesc}\nT-4.50\n^\n` +
      `D${dateForUpload}\nM${rentDesc}\nT-1200.00\n^\n`;
    const qifB =
      '!Type:Bank\n' +
      `D${dateForUpload}\nM${groceriesDesc}\nT-6.00\n^\n` +
      `D${dateForUpload}\nM${salaryDesc}\nT2500.00\n^\n`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    let newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(accountA);
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: '+ Add account' }).click();
    newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(accountB);
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountA);
    await page.locator('#file-input').setInputFiles({ name: 'a.qif', mimeType: 'text/plain', buffer: Buffer.from(qifA) });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountB);
    await page.locator('#file-input').setInputFiles({ name: 'b.qif', mimeType: 'text/plain', buffer: Buffer.from(qifB) });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);

    // All four rows visible before any filter is applied.
    await expect(page.getByText(coffeeDesc)).toBeVisible();
    await expect(page.getByText(rentDesc)).toBeVisible();
    await expect(page.getByText(groceriesDesc)).toBeVisible();
    await expect(page.getByText(salaryDesc)).toBeVisible();

    // Categorise two of the four, leaving the other two "needs a category" - each description's
    // token is unique, so neither triggers the bulk-apply modal.
    await page.locator('tr', { hasText: coffeeDesc }).locator('.category-select').selectOption('Dining');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('tr', { hasText: rentDesc }).locator('.category-select').selectOption('Housing');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Search filters by description.
    await page.getByLabel('Search description').fill(coffeeDesc);
    await expect(page.getByText(coffeeDesc)).toBeVisible();
    await expect(page.getByText(rentDesc)).not.toBeVisible();
    await expect(page.getByText(groceriesDesc)).not.toBeVisible();
    await page.getByLabel('Search description').fill('');

    // Account filter narrows to the selected account.
    await page.getByLabel('Account filter').selectOption(accountB);
    await expect(page.getByText(groceriesDesc)).toBeVisible();
    await expect(page.getByText(salaryDesc)).toBeVisible();
    await expect(page.getByText(coffeeDesc)).not.toBeVisible();
    await page.getByLabel('Account filter').selectOption('');

    // Category filter narrows to the selected category.
    await page.getByLabel('Category filter').selectOption('Housing');
    await expect(page.getByText(rentDesc)).toBeVisible();
    await expect(page.getByText(coffeeDesc)).not.toBeVisible();
    await expect(page.getByText(groceriesDesc)).not.toBeVisible();
    await page.getByLabel('Category filter').selectOption('');

    // Amount (+/-) filter narrows to positive or negative amounts (UBE-94).
    await page.getByLabel('Amount filter').selectOption('positive');
    await expect(page.getByText(salaryDesc)).toBeVisible();
    await expect(page.getByText(coffeeDesc)).not.toBeVisible();
    await expect(page.getByText(rentDesc)).not.toBeVisible();
    await expect(page.getByText(groceriesDesc)).not.toBeVisible();
    await page.getByLabel('Amount filter').selectOption('negative');
    await expect(page.getByText(salaryDesc)).not.toBeVisible();
    await expect(page.getByText(coffeeDesc)).toBeVisible();
    await expect(page.getByText(rentDesc)).toBeVisible();
    await expect(page.getByText(groceriesDesc)).toBeVisible();
    await page.getByLabel('Amount filter').selectOption('');

    // Ignoring the remaining uncategorised groceries row (UBE-94) removes it from the
    // needs-a-category count/filter, since an ignored transaction never needs a category.
    await page.locator('tr', { hasText: groceriesDesc }).getByRole('button', { name: `Actions for ${groceriesDesc}` }).click();
    await page.locator('tr', { hasText: groceriesDesc }).getByRole('menuitem', { name: 'Ignore', exact: true }).click();
    await expect(page.locator('tr', { hasText: groceriesDesc }).locator('.chip')).toHaveText('Ignore');

    // Needs-a-category toggle shows only the still-uncategorised, non-ignored rows, with an
    // accurate count - scoped to this test's own rows via the runId search, since other tests'
    // leftover (never-cleaned-up) transactions also contribute to the count otherwise.
    await page.getByLabel('Search description').fill(String(runId));
    const needsToggle = page.locator('.chip-toggle');
    await expect(needsToggle.locator('.chip-toggle-count')).toHaveText('1');
    await needsToggle.click();
    await expect(page.getByText(salaryDesc)).toBeVisible();
    await expect(page.getByText(groceriesDesc)).not.toBeVisible();
    await expect(page.getByText(coffeeDesc)).not.toBeVisible();
    await expect(page.getByText(rentDesc)).not.toBeVisible();
    await needsToggle.click();
    await expect(page.getByText(coffeeDesc)).toBeVisible();
    await page.getByLabel('Search description').fill('');

    // clean up the two Settings accounts added for this test - both were appended at the end
    // (in order), so removing "last" twice removes exactly these two. Removal is immediate via a
    // confirmation modal (UBE-57), not deferred to Save.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Endless scroll', () => {
  test('renders only the first 100 matching transactions, revealing more as you scroll (UBE-65)', async ({ page }) => {
    const runId = Date.now();
    // Distinctive token so a search can scope down to only this test's own rows - the shared,
    // never-cleaned-up test dataset from other specs would otherwise inflate the row count.
    const token = `ScrollTest${runId}`;
    const accountName = `Scroll Test Account ${runId}`;
    const TOTAL = 120;
    const PAGE_SIZE = 100;

    const dateForUpload = formatForUpload(new Date());
    let qif = '!Type:Bank\n';
    for (let i = 0; i < TOTAL; i++) {
      qif += `D${dateForUpload}\nM${token} ${i}\nT-1.00\n^\n`;
    }

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(accountName);
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountName);
    await page.locator('#file-input').setInputFiles({ name: 'scroll.qif', mimeType: 'text/plain', buffer: Buffer.from(qif) });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.getByLabel('Search description').fill(token);

    const rows = page.locator('table.tx tbody tr');
    await expect(rows).toHaveCount(PAGE_SIZE);

    await page.locator('.scroll-sentinel').scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(TOTAL);

    // clean up the Settings account added for this test - removal is immediate via a
    // confirmation modal (UBE-57), not deferred to Save.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Expanded date filters (UBE-78)', () => {
  test('filters by a specific past month, last year, and last financial year', async ({ page }) => {
    const runId = Date.now();
    const accountName = `UBE78 Account ${runId}`;
    const today = new Date();

    // 2 months back - inside one of the past-6-months dropdown options.
    const targetMonthDate = new Date(today.getFullYear(), today.getMonth() - 2, 15);
    const targetMonthDesc = `UBE78 TargetMonth ${runId}`;
    const targetMonthOptionValue = `month:${targetMonthDate.getFullYear()}-${String(targetMonthDate.getMonth() + 1).padStart(2, '0')}`;

    // Inside the rolling 12-month "Last year" window, but outside the past-6-months options.
    const elevenMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 11, 10);
    const elevenMonthsAgoDesc = `UBE78 ElevenMonths ${runId}`;

    // Outside the rolling 12-month "Last year" window.
    const thirteenMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 13, 10);
    const thirteenMonthsAgoDesc = `UBE78 ThirteenMonths ${runId}`;

    // Inside the most recently completed Australian financial year (1 Jul - 30 Jun).
    const currentFinancialYearStart = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
    const lastFinancialYearDate = new Date(currentFinancialYearStart - 1, 11, 15); // ~mid-December of last FY
    const lastFinancialYearDesc = `UBE78 LastFY ${runId}`;

    // Inside the *current* financial year - must not show under "Last financial year".
    const currentFinancialYearDate = new Date(currentFinancialYearStart, 6, 15); // ~mid-July of the current FY
    const currentFinancialYearDesc = `UBE78 CurrentFY ${runId}`;

    const qif =
      '!Type:Bank\n' +
      `D${formatForUpload(targetMonthDate)}\nM${targetMonthDesc}\nT-1.00\n^\n` +
      `D${formatForUpload(elevenMonthsAgo)}\nM${elevenMonthsAgoDesc}\nT-1.00\n^\n` +
      `D${formatForUpload(thirteenMonthsAgo)}\nM${thirteenMonthsAgoDesc}\nT-1.00\n^\n` +
      `D${formatForUpload(lastFinancialYearDate)}\nM${lastFinancialYearDesc}\nT-1.00\n^\n` +
      `D${formatForUpload(currentFinancialYearDate)}\nM${currentFinancialYearDesc}\nT-1.00\n^\n`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(accountName);
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountName);
    await page.locator('#file-input').setInputFiles({ name: 'ube78.qif', mimeType: 'text/plain', buffer: Buffer.from(qif) });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);

    // Scope every check to just this test's own rows - the shared, never-cleaned-up test dataset
    // from other specs would otherwise contribute noise across such a wide set of date ranges.
    await page.getByLabel('Date range').selectOption('allTime');
    await page.getByLabel('Search description').fill(String(runId));

    // Selecting a specific past month shows only that month's row.
    await page.getByLabel('Date range').selectOption(targetMonthOptionValue);
    await expect(page.getByText(targetMonthDesc)).toBeVisible();
    await expect(page.getByText(elevenMonthsAgoDesc)).not.toBeVisible();
    await expect(page.getByText(thirteenMonthsAgoDesc)).not.toBeVisible();
    await expect(page.getByText(lastFinancialYearDesc)).not.toBeVisible();
    await expect(page.getByText(currentFinancialYearDesc)).not.toBeVisible();

    // "Last year" is a rolling 12 months - the 11-months-ago row is inside it, the
    // 13-months-ago row isn't.
    await page.getByLabel('Date range').selectOption('year');
    await expect(page.getByText(elevenMonthsAgoDesc)).toBeVisible();
    await expect(page.getByText(thirteenMonthsAgoDesc)).not.toBeVisible();

    // "Last financial year" is the most recently completed 1 Jul - 30 Jun AU financial year - the
    // row dated inside it shows, the row dated inside the *current* financial year doesn't.
    await page.getByLabel('Date range').selectOption('financialYear');
    await expect(page.getByText(lastFinancialYearDesc)).toBeVisible();
    await expect(page.getByText(currentFinancialYearDesc)).not.toBeVisible();

    // clean up the Settings account added for this test - removal is immediate via a
    // confirmation modal (UBE-57), not deferred to Save.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

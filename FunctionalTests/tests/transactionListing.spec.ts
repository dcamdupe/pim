import { test, expect } from '@playwright/test';

function formatForUpload(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
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

    // Matches a real TM Bank export: Date, <blank>, Description, <blank>, Amount, running Balance.
    const csv =
      '131150S1,,,,,\n' +
      `${formatForUpload(today)},,"${todayDesc}",,-4.50,637.57\n` +
      `${formatForUpload(sixWeeksAgo)},,"${oldDesc}",,-9.00,637.57\n` +
      `${formatForUpload(veryOld)},,"${veryOldDesc}",,-1.00,637.57\n`;

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
    await newRow.locator('input').nth(1).fill('333444');
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption('Playwright Listing Account');
    await page.locator('#file-input').setInputFiles({
      name: 'transactions.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await page.getByRole('button', { name: 'Save' }).click();
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
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
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
    const csvA =
      '131150S1,,,,,\n' +
      `${dateForUpload},,"${coffeeDesc}",,-4.50,637.57\n` +
      `${dateForUpload},,"${rentDesc}",,-1200.00,637.57\n`;
    const csvB =
      '131150S1,,,,,\n' +
      `${dateForUpload},,"${groceriesDesc}",,-6.00,637.57\n` +
      `${dateForUpload},,"${salaryDesc}",,2500.00,637.57\n`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    let newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(accountA);
    await newRow.locator('input').nth(1).fill('555777');
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: '+ Add account' }).click();
    newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(accountB);
    await newRow.locator('input').nth(1).fill('555888');
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountA);
    await page.locator('#file-input').setInputFiles({ name: 'a.csv', mimeType: 'text/csv', buffer: Buffer.from(csvA) });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountB);
    await page.locator('#file-input').setInputFiles({ name: 'b.csv', mimeType: 'text/csv', buffer: Buffer.from(csvB) });
    await page.getByRole('button', { name: 'Save' }).click();
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

    // Needs-a-category toggle shows only the still-uncategorised rows, with an accurate count -
    // scoped to this test's own rows via the runId search, since other tests' leftover
    // (never-cleaned-up) transactions also contribute to the count otherwise.
    await page.getByLabel('Search description').fill(String(runId));
    const needsToggle = page.locator('.chip-toggle');
    await expect(needsToggle.locator('.chip-toggle-count')).toHaveText('2');
    await needsToggle.click();
    await expect(page.getByText(groceriesDesc)).toBeVisible();
    await expect(page.getByText(salaryDesc)).toBeVisible();
    await expect(page.getByText(coffeeDesc)).not.toBeVisible();
    await expect(page.getByText(rentDesc)).not.toBeVisible();
    await needsToggle.click();
    await expect(page.getByText(coffeeDesc)).toBeVisible();
    await page.getByLabel('Search description').fill('');

    // clean up the two Settings accounts added for this test - both were appended at the end
    // (in order), so removing "last" twice removes exactly these two, matching the single-account
    // cleanup pattern used elsewhere in this file.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
  });
});

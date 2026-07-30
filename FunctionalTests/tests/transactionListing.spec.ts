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
});

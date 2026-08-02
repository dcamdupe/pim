import { test, expect } from '@playwright/test';

test.describe('Transaction upload', () => {
  test('uploads a CSV via the Transactions page, and skips duplicates on re-upload', async ({ page }) => {
    const runId = Date.now();
    const desc = `Upload Test ${runId}`;

    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = today.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = today.getFullYear();
    const dateForUpload = `${day} ${month} ${year}`;

    // Matches a real TM Bank export: Date, <blank>, Description, <blank>, Amount, running
    // Balance - 6 columns, not the 5 originally assumed. Balance (last column) is never read.
    const csv = `131150S1,,,,,\n${dateForUpload},,"${desc}",,-4.50,637.57\n`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // The upload flow needs an account to select from - add one via Settings first,
    // matching settings.spec.ts's add-then-cleanup pattern on the shared seeded user.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill('Playwright Upload Account');
    await newRow.locator('input').nth(1).fill('111222');
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.getByRole('link', { name: 'Upload' }).click();
    await expect(page).toHaveURL(/\/transactions\/upload$/);

    await page.locator('#account').selectOption('Playwright Upload Account');
    await page.locator('#file-input').setInputFiles({
      name: 'transactions.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.getByText(desc)).toBeVisible();

    // Upload the exact same file again - proves duplicates are skipped (UBE-45), not shown twice.
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption('Playwright Upload Account');
    await page.locator('#file-input').setInputFiles({
      name: 'transactions.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.getByText(desc)).toHaveCount(1);

    // clean up the Settings account added for this test so repeated runs don't accumulate it
    // (the uploaded transaction itself isn't cleaned up - there's no delete UI yet)
    await page.getByRole('link', { name: 'Settings' }).click();
    const addedRow = page.locator('.account-row').last();
    await addedRow.getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

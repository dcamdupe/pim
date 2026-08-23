import { test, expect } from '@playwright/test';

test.describe('Transaction upload', () => {
  test('uploads a QIF via the Transactions page, and skips duplicates on re-upload', async ({ page }) => {
    const runId = Date.now();
    const desc = `Upload Test ${runId}`;

    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateForUpload = `${day}/${month}/${year}`;

    const qif = `!Type:Bank\nD${dateForUpload}\nM${desc}\nT-4.50\n^\n`;

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
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.getByRole('link', { name: 'Upload' }).click();
    await expect(page).toHaveURL(/\/transactions\/upload$/);

    await page.locator('#account').selectOption('Playwright Upload Account');
    await page.locator('#file-input').setInputFiles({
      name: 'transactions.qif',
      mimeType: 'text/plain',
      buffer: Buffer.from(qif),
    });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.getByText(desc)).toBeVisible();

    // Upload the exact same file again - proves duplicates are skipped, not shown twice.
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption('Playwright Upload Account');
    await page.locator('#file-input').setInputFiles({
      name: 'transactions.qif',
      mimeType: 'text/plain',
      buffer: Buffer.from(qif),
    });
    await page.getByRole('button', { name: 'Save' }).first().click();
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

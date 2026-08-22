import { test, expect } from '@playwright/test';
import * as fs from 'fs';

function formatForUpload(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

test.describe('Exporting transactions', () => {
  test('exports only the currently filtered transactions as CSV (UBE-96)', async ({ page }) => {
    const runId = Date.now();
    const coffeeDesc = `ExportCoffee${runId} Shop`;
    const rentDesc = `ExportRent${runId} Payment`;
    const accountName = `Export Test Account ${runId}`;

    const dateForUpload = formatForUpload(new Date());
    const qif =
      '!Type:Bank\n' +
      `D${dateForUpload}\nM${coffeeDesc}\nT-4.50\n^\n` +
      `D${dateForUpload}\nM${rentDesc}\nT-1200.00\n^\n`;

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
    await page.locator('#file-input').setInputFiles({ name: 'export.qif', mimeType: 'text/plain', buffer: Buffer.from(qif) });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);

    // Scope down to just this test's own rows via search, then further narrow to the coffee row
    // only - the export should reflect this filtered set, excluding the rent row.
    await page.getByLabel('Search description').fill(coffeeDesc);
    await expect(page.getByText(coffeeDesc)).toBeVisible();
    await expect(page.getByText(rentDesc)).not.toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export', exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^transactions-\d{4}-\d{2}-\d{2}\.csv$/);

    const path = await download.path();
    const csv = fs.readFileSync(path!, 'utf-8');
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('Date,Description,Account,Category,Amount');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(coffeeDesc);
    expect(lines[1]).toContain(accountName);
    expect(lines[1]).toContain('-4.50');
    expect(csv).not.toContain(rentDesc);

    // clean up the Settings account added for this test - removal is immediate via a
    // confirmation modal (UBE-57), not deferred to Save.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('disables the Export button when no transactions match the filters', async ({ page }) => {
    const runId = Date.now();

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByLabel('Search description').fill(`NoSuchTransaction${runId}`);
    // Either empty-state message is fine here - which one shows just depends on whether the
    // store's own all-time fetch (back to MinTransactionDate, can be slow) has resolved yet.
    await expect(page.getByText(/No transactions (in this range|match your filters)\./)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
  });
});

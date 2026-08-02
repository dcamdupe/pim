import { test, expect } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('#email').fill('testuser@example.com');
  await page.locator('#password').fill('TestPassword123!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function addAccount(page: import('@playwright/test').Page, name: string, number: string, type: string) {
  await page.getByRole('button', { name: '+ Add account' }).click();
  const row = page.locator('.account-row').last();
  await row.locator('input').nth(0).fill(name);
  await row.locator('input').nth(1).fill(number);
  await row.locator('select').selectOption(type);
  return row;
}

// Playwright has no built-in "find the row whose input has this value" locator (that's a Testing
// Library concept, not Playwright's) - the account name input's DOM `value` is set via v-model,
// not a static `value` attribute, so a `input[value=...]` CSS selector wouldn't match it either.
async function findAccountRow(page: import('@playwright/test').Page, name: string) {
  const rows = page.locator('.account-row');
  await rows.first().waitFor();
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    if ((await rows.nth(i).locator('input').first().inputValue()) === name) {
      return rows.nth(i);
    }
  }
  throw new Error(`No account row found with name "${name}"`);
}

test.describe('Account deletion', () => {
  test('No leaves the account and its transactions untouched', async ({ page }) => {
    const runId = Date.now();
    const accountName = `DeleteNo Account ${runId}`;
    const description = `DeleteNo Txn ${runId}`;

    await login(page);
    await page.getByRole('link', { name: 'Settings' }).click();
    await addAccount(page, accountName, '444001', 'Transaction');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = today.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = today.getFullYear();
    const csv = `131150S1,,,,,\n${day} ${month} ${year},,"${description}",,-10.00,637.57\n`;

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountName);
    await page.locator('#file-input').setInputFiles({ name: 'txn.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.getByText(description)).toBeVisible();

    await page.getByRole('link', { name: 'Settings' }).click();
    let row = await findAccountRow(page, accountName);
    await row.getByRole('button', { name: 'Remove account' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('This will also delete all the transaction for this account? Do you want to delete the account?')).toBeVisible();
    await page.getByRole('button', { name: 'No' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Still there - nothing was deleted.
    await expect(findAccountRow(page, accountName)).resolves.toBeTruthy();
    await page.getByRole('link', { name: 'Transactions' }).click();
    await expect(page.getByText(description)).toBeVisible();

    // clean up
    await page.getByRole('link', { name: 'Settings' }).click();
    row = await findAccountRow(page, accountName);
    await row.getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Yes deletes the account immediately and cascades to delete its transactions', async ({ page }) => {
    const runId = Date.now();
    const accountName = `DeleteYes Account ${runId}`;
    const otherAccountName = `DeleteYes Keep ${runId}`;
    const description = `DeleteYes Txn ${runId}`;
    const otherDescription = `DeleteYes Keep Txn ${runId}`;

    await login(page);
    await page.getByRole('link', { name: 'Settings' }).click();
    await addAccount(page, accountName, '444002', 'Transaction');
    await addAccount(page, otherAccountName, '444003', 'Transaction');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = today.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = today.getFullYear();
    const csv = `131150S1,,,,,\n${day} ${month} ${year},,"${description}",,-10.00,637.57\n`;
    const otherCsv = `131150S1,,,,,\n${day} ${month} ${year},,"${otherDescription}",,-20.00,637.57\n`;

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountName);
    await page.locator('#file-input').setInputFiles({ name: 'txn.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(otherAccountName);
    await page.locator('#file-input').setInputFiles({ name: 'other.csv', mimeType: 'text/csv', buffer: Buffer.from(otherCsv) });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.getByText(description)).toBeVisible();
    await expect(page.getByText(otherDescription)).toBeVisible();

    await page.getByRole('link', { name: 'Settings' }).click();
    const targetRow = await findAccountRow(page, accountName);
    await targetRow.getByRole('button', { name: 'Remove account' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Yes' }).click();

    // Gone from Settings immediately - no Save click needed.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.account-row', { hasText: accountName })).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.account-row', { hasText: accountName })).toHaveCount(0);

    // Its transaction is gone too, but the other account's transaction is untouched.
    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByLabel('Date range').selectOption('allTime');
    await expect(page.getByText(description)).toHaveCount(0);
    await expect(page.getByText(otherDescription)).toBeVisible();

    // clean up the remaining account.
    await page.getByRole('link', { name: 'Settings' }).click();
    const otherRow = await findAccountRow(page, otherAccountName);
    await otherRow.getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('removing a not-yet-saved account is instant, with no confirmation modal', async ({ page }) => {
    const runId = Date.now();
    const accountName = `NeverSaved Account ${runId}`;

    await login(page);
    await page.getByRole('link', { name: 'Settings' }).click();
    // Wait for the async accounts fetch to resolve before reading a "before" count, or this
    // races ahead of it and reads 0 (same failure mode already known in settings.spec.ts).
    await page.getByRole('button', { name: '+ Add account' }).waitFor();
    const rowsBefore = await page.locator('.account-row').count();
    const row = await addAccount(page, accountName, '444004', 'Transaction');

    await row.getByRole('button', { name: 'Remove account' }).click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.account-row')).toHaveCount(rowsBefore);
  });

  test('prevents saving when two accounts share a name', async ({ page }) => {
    const runId = Date.now();
    const accountName = `DupName Account ${runId}`;

    await login(page);
    await page.getByRole('link', { name: 'Settings' }).click();
    await addAccount(page, accountName, '444005', 'Transaction');
    const secondRow = await addAccount(page, accountName, '444006', 'Savings');

    await expect(page.getByText('Account names must be unique.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

    // Fixing the duplicate re-enables Save - and cleans up both unsaved rows.
    await secondRow.locator('input').nth(0).fill(`${accountName} 2`);
    await expect(page.getByText('Account names must be unique.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();

    const firstRow = await findAccountRow(page, accountName);
    await firstRow.getByRole('button', { name: 'Remove account' }).click();
    await secondRow.getByRole('button', { name: 'Remove account' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

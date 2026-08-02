import { test, expect } from '@playwright/test';

function formatForUpload(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

test.describe('Ignoring transactions', () => {
  test('toggles a transaction inactive and back active via the row menu, reloading the listing each time', async ({
    page,
  }) => {
    const runId = Date.now();
    const desc = `Ignore Test ${runId}`;
    const otherDesc = `Ignore Test Other ${runId}`;
    const accountName = `Ignore Test Account ${runId}`;

    const dateForUpload = formatForUpload(new Date());
    const qif =
      '!Type:Bank\n' +
      `D${dateForUpload}\nM${desc}\nT-4.50\n^\n` +
      `D${dateForUpload}\nM${otherDesc}\nT-9.00\n^\n`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(accountName);
    await newRow.locator('input').nth(1).fill('555999');
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountName);
    await page.locator('#file-input').setInputFiles({ name: 'transactions.qif', mimeType: 'text/plain', buffer: Buffer.from(qif) });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    const row = page.locator('tr', { hasText: desc });
    const otherRow = page.locator('tr', { hasText: otherDesc });
    await expect(row.getByText('Inactive')).toHaveCount(0);

    // Only one row's menu is open at a time - opening this row's menu first, then clicking
    // elsewhere on the page (the page heading), confirms the outside-click-closes behaviour
    // before actually exercising the toggle.
    await row.getByRole('button', { name: `Actions for ${desc}` }).click();
    await expect(row.getByRole('menuitem', { name: 'Set inactive' })).toBeVisible();
    await page.getByRole('heading', { name: 'Transactions' }).click();
    await expect(row.getByRole('menuitem', { name: 'Set inactive' })).toHaveCount(0);

    // Set inactive - the listing reloads and the row shows the "Inactive" indicator.
    await row.getByRole('button', { name: `Actions for ${desc}` }).click();
    await row.getByRole('menuitem', { name: 'Set inactive' }).click();
    await expect(row.getByText('Inactive')).toBeVisible();
    // The unrelated row is untouched.
    await expect(otherRow.getByText('Inactive')).toHaveCount(0);

    // Set active again - the "Inactive" indicator clears.
    await row.getByRole('button', { name: `Actions for ${desc}` }).click();
    await expect(row.getByRole('menuitem', { name: 'Set active' })).toBeVisible();
    await row.getByRole('menuitem', { name: 'Set active' }).click();
    await expect(row.getByText('Inactive')).toHaveCount(0);

    // clean up the Settings account added for this test - removal is immediate via a
    // confirmation modal (UBE-57), not deferred to Save.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

import { test, expect } from '@playwright/test';

function formatForUpload(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

test.describe('Ignoring transactions', () => {
  test('ignores a transaction and unignores it via the row menu, reloading the listing each time', async ({
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
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountName);
    await page.locator('#file-input').setInputFiles({ name: 'transactions.qif', mimeType: 'text/plain', buffer: Buffer.from(qif) });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);

    const row = page.locator('tr', { hasText: desc });
    const otherRow = page.locator('tr', { hasText: otherDesc });
    // The chip is checked via its own element (not getByText) since the test's own description
    // fixture ("Ignore Test ...") would otherwise collide with a plain substring text search.
    await expect(row.locator('.chip')).toHaveCount(0);

    // Only one row's menu is open at a time - open this row's menu, then click elsewhere on the
    // page to confirm outside-click-closes behaviour before exercising the toggle.
    await row.getByRole('button', { name: `Actions for ${desc}` }).click();
    await expect(row.getByRole('menuitem', { name: 'Ignore', exact: true })).toBeVisible();
    await page.getByRole('heading', { name: 'Transactions' }).click();
    await expect(row.getByRole('menuitem', { name: 'Ignore', exact: true })).toHaveCount(0);

    // Ignore - the listing reloads and the row shows the "Ignore" indicator.
    await row.getByRole('button', { name: `Actions for ${desc}` }).click();
    await row.getByRole('menuitem', { name: 'Ignore', exact: true }).click();
    await expect(row.locator('.chip')).toHaveText('Ignore');
    // The unrelated row is untouched.
    await expect(otherRow.locator('.chip')).toHaveCount(0);

    // Unignore again - the "Ignore" indicator clears.
    await row.getByRole('button', { name: `Actions for ${desc}` }).click();
    await expect(row.getByRole('menuitem', { name: 'Unignore' })).toBeVisible();
    await row.getByRole('menuitem', { name: 'Unignore' }).click();
    await expect(row.locator('.chip')).toHaveCount(0);

    // clean up the Settings account added for this test - removal is immediate via a
    // confirmation modal, not deferred to Save.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

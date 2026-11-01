import { test, expect, type Page } from '@playwright/test';

// UBE-118: Insights (Spending trends) tab. Uploads one large uncategorised spend into a throwaway
// account so "Uncategorised" is flagged as spending more, then deletes the account (which also
// deletes its transactions) so the shared test user's data is left as it was.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortLabel(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// Letters only - the insights "What changed" table groups by the description's first word with
// digits stripped, so a numeric run id would be dropped from the merchant name.
function letterId(): string {
  return Date.now()
    .toString()
    .split('')
    .map((d) => String.fromCharCode(65 + Number(d)))
    .join('');
}

// Account names live in input values (not text), so match on inputValue() - as accountDeletion.spec.ts does.
async function findAccountRow(page: Page, name: string) {
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

test.describe('Insights', () => {
  test('shows spending trends for the last full month and drills into a category', async ({ page }) => {
    const merchant = `INSIGHTS${letterId()}`;
    const accountName = `Playwright Insights ${Date.now()}`;
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 15);
    const monthBefore = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const dateForUpload = `15/${String(lastMonth.getMonth() + 1).padStart(2, '0')}/${lastMonth.getFullYear()}`;

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

    try {
      await page.getByRole('link', { name: 'Transactions' }).click();
      await page.getByRole('link', { name: 'Upload' }).click();
      await page.locator('#account').selectOption(accountName);
      await page.locator('#file-input').setInputFiles({
        name: 'insights.qif',
        mimeType: 'text/plain',
        buffer: Buffer.from(`!Type:Bank\nD${dateForUpload}\nM${merchant} STORE 0001\nT-25000.00\n^\n`),
      });
      await page.getByRole('button', { name: 'Save' }).first().click();
      await expect(page).toHaveURL(/\/transactions$/);

      // Same top-nav style as Dashboard / Transactions.
      await page.getByRole('link', { name: 'Insights' }).click();
      await expect(page).toHaveURL(/\/insights$/);
      await expect(page.getByRole('heading', { name: 'Spending trends' })).toBeVisible();

      // Defaults to the last full month, compared with the month before it.
      await expect(page.getByTestId('insights-month')).toHaveText(`${shortLabel(lastMonth)} vs ${shortLabel(monthBefore)}`);
      await expect(page.getByText('Flag changes over 20% and $50')).toBeVisible();
      await expect(page.getByRole('region', { name: 'Summary' })).toContainText('Total spending');

      const card = page.getByTestId('group-up').getByTestId('insight-Uncategorised');
      await expect(card).toBeVisible();
      await card.click();
      await expect(card).toHaveAttribute('aria-pressed', 'true');

      const detail = page.getByTestId('insight-detail');
      await expect(detail.getByRole('heading', { name: 'Uncategorised' })).toBeVisible();
      await expect(detail.getByRole('img', { name: /Uncategorised spending/ })).toBeVisible();
      const driver = detail.getByRole('row', { name: new RegExp(merchant) });
      await expect(driver).toContainText('$25,000');

      // Stepping forward moves to the current month; it's the newest, so "next" is then disabled.
      await page.getByRole('button', { name: 'Next month' }).click();
      await expect(page.getByTestId('insights-month')).toHaveText(`${shortLabel(today)} vs ${shortLabel(lastMonth)}`);
      await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled();
    } finally {
      // Deleting the account also deletes the uploaded transaction.
      await page.getByRole('link', { name: 'Settings' }).click();
      const row = await findAccountRow(page, accountName);
      await row.getByRole('button', { name: 'Remove account' }).click();
      await page.getByRole('button', { name: 'Yes' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });
});

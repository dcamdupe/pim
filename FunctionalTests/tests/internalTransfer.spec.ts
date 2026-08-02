import { test, expect } from '@playwright/test';

function formatForUpload(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// Tile values are plain "$1,234" / "−$1,234" text, not test ids - parse them back to numbers.
function parseCurrency(text: string): number {
  const negative = text.trim().startsWith('−');
  const digits = text.replace(/[^0-9.]/g, '');
  const value = Number(digits);
  return negative ? -value : value;
}

async function tileValue(page: import('@playwright/test').Page, label: string): Promise<number> {
  const kpi = page.locator('.kpi', { has: page.locator('.label', { hasText: label }) });
  const text = await kpi.locator('.value').innerText();
  return parseCurrency(text);
}

test.describe('Internal transfer matching', () => {
  test('auto-flags an inverted-amount pair across accounts, excludes it from dashboard expenses, and leaves a same-account pair untouched', async ({
    page,
  }) => {
    const runId = Date.now();
    const monthName = new Date().toLocaleDateString(undefined, { month: 'long' });
    const today = formatForUpload(new Date());

    // The negative-amount leg carries "Transfer" so the pair satisfies UBE-64's description rule
    // (at least one of: + side has BPAY, - side mentions "transfer").
    const transferOut = `IT Transfer Out ${runId}`;
    const transferIn = `IT In ${runId}`;
    const controlOut = `IT Control Out ${runId}`;
    const controlIn = `IT Control In ${runId}`;
    const accountA = `IT Account A ${runId}`;
    const accountB = `IT Account B ${runId}`;

    // Derived from runId (not a fixed literal), and from wide, non-overlapping ranges - re-runs
    // can never delete their own uploaded transactions (no delete-transaction UI exists), so a
    // narrow range risks a later run's pair accidentally colliding with an earlier run's still-
    // present, still-unmatched leftover in the same shared month bucket.
    const transferAmount = 1000 + (runId % 8000);
    const controlAmount = 9000 + (runId % 8999);

    // The control pair is deliberately both legs in Account A's own file - an inverted-amount
    // match within one account must NOT auto-flag, proving the different-accounts constraint.
    const outCsv =
      `131150S1,,,,,\n${today},,"${transferOut}",,-${transferAmount}.00,637.57\n` +
      `${today},,"${controlOut}",,-${controlAmount}.00,637.57\n${today},,"${controlIn}",,${controlAmount}.00,637.57\n`;
    const inCsv = `131150S2,,,,,\n${today},,"${transferIn}",,${transferAmount}.00,1100.00\n`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Only the delta this test causes is asserted - the shared test dataset from other specs
    // accumulates across runs, same convention as dashboard.spec.ts.
    const before = await tileValue(page, `${monthName} Expenses`);

    await page.getByRole('link', { name: 'Settings' }).click();
    for (const account of [accountA, accountB]) {
      await page.getByRole('button', { name: '+ Add account' }).click();
      const newRow = page.locator('.account-row').last();
      await newRow.locator('input').nth(0).fill(account);
      await newRow.locator('input').nth(1).fill('444555');
      await newRow.locator('select').selectOption('Transaction');
    }
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    // Account A's leg (out-transfer + control) arrives first, on its own - the out-transfer is
    // still unmatched at this point and counts as a normal uncategorized expense.
    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountA);
    await page.locator('#file-input').setInputFiles({ name: 'out.csv', mimeType: 'text/csv', buffer: Buffer.from(outCsv) });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.locator('tr', { hasText: transferOut }).locator('.category-select')).toHaveValue('');

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByText(`${monthName} profit`)).toBeVisible();
    const afterFirstUpload = await tileValue(page, `${monthName} Expenses`);
    // Only the still-uncategorized transferOut counts as an expense here - the control pair
    // already nets to zero regardless of category.
    expect(afterFirstUpload - before).toBe(transferAmount);

    // Account B's leg arrives in a separate import - matching must look across the already-stored
    // transaction from the first upload, not just within this file's own rows.
    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountB);
    await page.locator('#file-input').setInputFiles({ name: 'in.csv', mimeType: 'text/csv', buffer: Buffer.from(inCsv) });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // Cross-account, inverted-amount pair - both auto-flagged, overriding the out-transfer's
    // previously-uncategorized state.
    await expect(page.locator('tr', { hasText: transferOut }).locator('.category-select')).toHaveValue('Internal Transfer');
    await expect(page.locator('tr', { hasText: transferIn }).locator('.category-select')).toHaveValue('Internal Transfer');

    // Same-account, inverted-amount pair - the account constraint means this must NOT match.
    await expect(page.locator('tr', { hasText: controlOut }).locator('.category-select')).toHaveValue('');
    await expect(page.locator('tr', { hasText: controlIn }).locator('.category-select')).toHaveValue('');

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByText(`${monthName} profit`)).toBeVisible();
    const afterSecondUpload = await tileValue(page, `${monthName} Expenses`);
    // The out-transfer is no longer counted (now Internal Transfer) and the in-transfer was never
    // counted either - net zero change from the transfer pair. The control pair nets to zero
    // regardless of category, so it doesn't move this figure either.
    expect(afterSecondUpload - before).toBe(0);

    // clean up the Settings accounts added for this test.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
  });

  test('does not auto-flag an inverted-amount pair across accounts when neither description has a qualifying keyword (UBE-64)', async ({ page }) => {
    const runId = Date.now();
    const today = formatForUpload(new Date());

    const outDesc = `Woolworths Metro ${runId}`;
    const inDesc = `Refund Received ${runId}`;
    const accountA = `IT NoMatch A ${runId}`;
    const accountB = `IT NoMatch B ${runId}`;
    const amount = 1000 + (runId % 8000);

    const outCsv = `131150S1,,,,,\n${today},,"${outDesc}",,-${amount}.00,637.57\n`;
    const inCsv = `131150S2,,,,,\n${today},,"${inDesc}",,${amount}.00,1100.00\n`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Settings' }).click();
    for (const account of [accountA, accountB]) {
      await page.getByRole('button', { name: '+ Add account' }).click();
      const newRow = page.locator('.account-row').last();
      await newRow.locator('input').nth(0).fill(account);
      await newRow.locator('input').nth(1).fill('444556');
      await newRow.locator('select').selectOption('Transaction');
    }
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountA);
    await page.locator('#file-input').setInputFiles({ name: 'out.csv', mimeType: 'text/csv', buffer: Buffer.from(outCsv) });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountB);
    await page.locator('#file-input').setInputFiles({ name: 'in.csv', mimeType: 'text/csv', buffer: Buffer.from(inCsv) });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // Same day, opposite amounts, different accounts - would have overmatched before UBE-64.
    await expect(page.locator('tr', { hasText: outDesc }).locator('.category-select')).toHaveValue('');
    await expect(page.locator('tr', { hasText: inDesc }).locator('.category-select')).toHaveValue('');

    // clean up the Settings accounts added for this test.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();
  });
});

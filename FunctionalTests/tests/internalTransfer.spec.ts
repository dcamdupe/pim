import { test, expect } from '@playwright/test';

function formatForUpload(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Tile values are plain "$1,234" / "−$1,234" text, not test ids - parse them back to numbers.
function parseCurrency(text: string): number {
  const negative = text.trim().startsWith('−');
  const digits = text.replace(/[^0-9.]/g, '');
  const value = Number(digits);
  return negative ? -value : value;
}

// Tile 2 = current month expenses (see dashboard.spec.ts - tiles are positional since UBE-70).
async function currentMonthExpensesTileValue(page: import('@playwright/test').Page): Promise<number> {
  const kpi = page.locator('.kpi-row .kpi').nth(2);
  const text = await kpi.locator('.value').innerText();
  return parseCurrency(text);
}

test.describe('Internal transfer matching', () => {
  test('auto-flags an inverted-amount pair across accounts, excludes it from dashboard expenses, and leaves a same-account pair untouched', async ({
    page,
  }) => {
    const runId = Date.now();
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
    const outQif =
      '!Type:Bank\n' +
      `D${today}\nM${transferOut}\nT-${transferAmount}.00\n^\n` +
      `D${today}\nM${controlOut}\nT-${controlAmount}.00\n^\n` +
      `D${today}\nM${controlIn}\nT${controlAmount}.00\n^\n`;
    const inQif = '!Type:Bank\n' + `D${today}\nM${transferIn}\nT${transferAmount}.00\n^\n`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Only the delta this test causes is asserted - the shared test dataset from other specs
    // accumulates across runs, same convention as dashboard.spec.ts.
    const before = await currentMonthExpensesTileValue(page);

    await page.getByRole('link', { name: 'Settings' }).click();
    for (const account of [accountA, accountB]) {
      await page.getByRole('button', { name: '+ Add account' }).click();
      const newRow = page.locator('.account-row').last();
      await newRow.locator('input').nth(0).fill(account);
      await newRow.locator('select').selectOption('Transaction');
    }
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    // Account A's leg (out-transfer + control) arrives first, on its own - the out-transfer is
    // still unmatched at this point and counts as a normal uncategorized expense.
    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountA);
    await page.locator('#file-input').setInputFiles({ name: 'out.qif', mimeType: 'text/plain', buffer: Buffer.from(outQif) });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.locator('tr', { hasText: transferOut }).locator('.category-select')).toHaveValue('');

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.locator('.kpi-row .kpi')).toHaveCount(4);
    const afterFirstUpload = await currentMonthExpensesTileValue(page);
    // Uncategorized transactions carry no Type (UBE-75), but a negative amount still counts as an
    // expense (UBE-69) - transferOut and controlOut are both negative-amount and uncategorized here,
    // so both count; controlIn is positive (money in), so it doesn't.
    expect(afterFirstUpload - before).toBe(transferAmount + controlAmount);

    // Account B's leg arrives in a separate import - matching must look across the already-stored
    // transaction from the first upload, not just within this file's own rows.
    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountB);
    await page.locator('#file-input').setInputFiles({ name: 'in.qif', mimeType: 'text/plain', buffer: Buffer.from(inQif) });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);

    // Cross-account, inverted-amount pair - both auto-flagged, overriding the out-transfer's
    // previously-uncategorized state.
    await expect(page.locator('tr', { hasText: transferOut }).locator('.category-select')).toHaveValue('Internal Transfer');
    await expect(page.locator('tr', { hasText: transferIn }).locator('.category-select')).toHaveValue('Internal Transfer');

    // Same-account, inverted-amount pair - the account constraint means this must NOT match.
    await expect(page.locator('tr', { hasText: controlOut }).locator('.category-select')).toHaveValue('');
    await expect(page.locator('tr', { hasText: controlIn }).locator('.category-select')).toHaveValue('');

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.locator('.kpi-row .kpi')).toHaveCount(4);
    const afterSecondUpload = await currentMonthExpensesTileValue(page);
    // transferOut drops out (now Internal Transfer, ignored) and transferIn was never counted
    // (positive amount) either way - net zero change from the transfer pair. The control pair is
    // still uncategorized: controlOut (negative) keeps counting as an expense, controlIn (positive)
    // still doesn't - so only controlAmount remains on top of the baseline.
    expect(afterSecondUpload - before).toBe(controlAmount);

    // clean up the Settings accounts added for this test - removal is immediate via a
    // confirmation modal (UBE-57), not deferred to Save.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('does not auto-flag an inverted-amount pair across accounts when neither description has a qualifying keyword (UBE-64)', async ({ page }) => {
    const runId = Date.now();
    const today = formatForUpload(new Date());

    const outDesc = `Woolworths Metro ${runId}`;
    const inDesc = `Refund Received ${runId}`;
    const accountA = `IT NoMatch A ${runId}`;
    const accountB = `IT NoMatch B ${runId}`;
    const amount = 1000 + (runId % 8000);

    const outQif = '!Type:Bank\n' + `D${today}\nM${outDesc}\nT-${amount}.00\n^\n`;
    const inQif = '!Type:Bank\n' + `D${today}\nM${inDesc}\nT${amount}.00\n^\n`;

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
      await newRow.locator('select').selectOption('Transaction');
    }
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountA);
    await page.locator('#file-input').setInputFiles({ name: 'out.qif', mimeType: 'text/plain', buffer: Buffer.from(outQif) });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(accountB);
    await page.locator('#file-input').setInputFiles({ name: 'in.qif', mimeType: 'text/plain', buffer: Buffer.from(inQif) });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);

    // Same day, opposite amounts, different accounts - would have overmatched before UBE-64.
    await expect(page.locator('tr', { hasText: outDesc }).locator('.category-select')).toHaveValue('');
    await expect(page.locator('tr', { hasText: inDesc }).locator('.category-select')).toHaveValue('');

    // clean up the Settings accounts added for this test - removal is immediate via a
    // confirmation modal (UBE-57), not deferred to Save.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

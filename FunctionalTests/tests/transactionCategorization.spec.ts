import { test, expect } from '@playwright/test';

test.describe('Transaction categorization', () => {
  test('offers to bulk-apply a category to similar descriptions, and remembers the mapping for future uploads', async ({
    page,
  }) => {
    // The runId is embedded in the merchant token itself (not as a separate leading word) so
    // each merchant group's shared prefix (e.g. "COLES<runId>") stays isolated from the other
    // group and from other test runs - a shared literal leading word across all three
    // descriptions would make them spuriously "match" each other regardless of merchant.
    const runId = Date.now();
    const colesA = `COLES${runId} 0717 TURRAMURRA AUS`;
    const colesB = `COLES${runId} 0760 ASQUITH AUS`;
    const other = `OTHER${runId} MERCHANT`;

    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateForUpload = `${day}/${month}/${year}`;

    const qif =
      '!Type:Bank\n' +
      `D${dateForUpload}\nM${colesA}\nT-20.00\n^\n` +
      `D${dateForUpload}\nM${colesB}\nT-15.00\n^\n` +
      `D${dateForUpload}\nM${other}\nT-5.00\n^\n`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // The upload flow needs an account to select from - add one via Settings first, matching
    // transactionUpload.spec.ts's add-then-cleanup pattern on the shared seeded user.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill('Playwright Categorization Account');
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption('Playwright Categorization Account');
    await page.locator('#file-input').setInputFiles({
      name: 'transactions.qif',
      mimeType: 'text/plain',
      buffer: Buffer.from(qif),
    });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.getByText(colesA)).toBeVisible();

    // Categorising the unrelated transaction has no similar descriptions to offer - no modal,
    // saved straight away.
    await page.locator('tr', { hasText: other }).locator('.category-select').selectOption('Shopping');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('tr', { hasText: other }).locator('.category-select')).toHaveValue('Shopping');

    // Categorising the first COLES transaction offers to bulk-apply to the other COLES row.
    await page.locator('tr', { hasText: colesA }).locator('.category-select').selectOption('Groceries');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('1 other transaction')).toBeVisible();
    await page.getByRole('button', { name: /Apply to 1 similar transactions/ }).click();

    // The list reloads - both COLES rows are now categorised, the unrelated row is untouched.
    await expect(page.locator('tr', { hasText: colesA }).locator('.category-select')).toHaveValue('Groceries');
    await expect(page.locator('tr', { hasText: colesB }).locator('.category-select')).toHaveValue('Groceries');
    await expect(page.locator('tr', { hasText: other }).locator('.category-select')).toHaveValue('Shopping');

    // Uploading a new statement with another COLES-prefixed description is auto-categorised via
    // the remembered DescriptionMapping, with no further manual action.
    const colesC = `COLES${runId} 0999 NEWTOWN AUS`;
    const followUpQif = `!Type:Bank\nD${dateForUpload}\nM${colesC}\nT-10.00\n^\n`;
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption('Playwright Categorization Account');
    await page.locator('#file-input').setInputFiles({
      name: 'transactions2.qif',
      mimeType: 'text/plain',
      buffer: Buffer.from(followUpQif),
    });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.locator('tr', { hasText: colesC }).locator('.category-select')).toHaveValue('Groceries');

    // clean up the Settings account added for this test so repeated runs don't accumulate it
    // (the uploaded transactions themselves aren't cleaned up - there's no delete UI, matching
    // the same known limitation already accepted in transactionUpload.spec.ts)
    await page.getByRole('link', { name: 'Settings' }).click();
    const addedRow = page.locator('.account-row').last();
    await addedRow.getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('offers to bulk-apply when two transactions share the exact same description (UBE-54)', async ({ page }) => {
    // Real bank data commonly has no distinguishing suffix at all for a repeat merchant (unlike
    // the COLES example above, which varies by store number) - this covers that case, which used
    // to never trigger the modal because the description-stats cache is deduplicated by
    // description string.
    const runId = Date.now();
    const netflix = `NETFLIX${runId} COM`;

    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateForUpload = `${day}/${month}/${year}`;

    const qif =
      '!Type:Bank\n' +
      `D${dateForUpload}\nM${netflix}\nT-15.99\n^\n` +
      `D${dateForUpload}\nM${netflix}\nT-15.99\n^\n`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill('Playwright Duplicate Desc Account');
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption('Playwright Duplicate Desc Account');
    await page.locator('#file-input').setInputFiles({
      name: 'transactions.qif',
      mimeType: 'text/plain',
      buffer: Buffer.from(qif),
    });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);

    const netflixRows = page.locator('tr', { hasText: netflix });
    await expect(netflixRows).toHaveCount(2);

    // Categorising one of the two identical-description rows still offers to bulk-apply to the
    // other, with an accurate "1 other transaction" count.
    await netflixRows.first().locator('.category-select').selectOption('Entertainment');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('1 other transaction')).toBeVisible();
    await page.getByRole('button', { name: /Apply to 1 similar transactions/ }).click();

    const netflixSelects = netflixRows.locator('.category-select');
    for (const select of await netflixSelects.all()) {
      await expect(select).toHaveValue('Entertainment');
    }

    await page.getByRole('link', { name: 'Settings' }).click();
    const addedRow = page.locator('.account-row').last();
    await addedRow.getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Cancel on the bulk-apply modal saves nothing (UBE-66)', async ({ page }) => {
    const runId = Date.now();
    const colesA = `COLES${runId} 0717 TURRAMURRA AUS`;
    const colesB = `COLES${runId} 0760 ASQUITH AUS`;

    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateForUpload = `${day}/${month}/${year}`;

    const qif =
      '!Type:Bank\n' +
      `D${dateForUpload}\nM${colesA}\nT-20.00\n^\n` +
      `D${dateForUpload}\nM${colesB}\nT-15.00\n^\n`;

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill('Playwright Cancel Account');
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption('Playwright Cancel Account');
    await page.locator('#file-input').setInputFiles({
      name: 'transactions.qif',
      mimeType: 'text/plain',
      buffer: Buffer.from(qif),
    });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.getByText(colesA)).toBeVisible();

    await page.locator('tr', { hasText: colesA }).locator('.category-select').selectOption('Groceries');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Nothing saved - both rows are still uncategorised, even after a reload.
    await expect(page.locator('tr', { hasText: colesA }).locator('.category-select')).toHaveValue('');
    await expect(page.locator('tr', { hasText: colesB }).locator('.category-select')).toHaveValue('');
    await page.reload();
    await expect(page.locator('tr', { hasText: colesA }).locator('.category-select')).toHaveValue('');
    await expect(page.locator('tr', { hasText: colesB }).locator('.category-select')).toHaveValue('');

    await page.getByRole('link', { name: 'Settings' }).click();
    const addedRow = page.locator('.account-row').last();
    await addedRow.getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

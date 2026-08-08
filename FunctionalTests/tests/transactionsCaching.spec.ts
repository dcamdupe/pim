import { test, expect } from '@playwright/test';

// UBE-82: transactions are loaded once into a shared client-side store (not re-fetched by every
// page that displays them), and an edit made on one page is immediately visible on another without
// a page reload. Counting GET /transactions calls is what actually proves the "loaded once, reused
// everywhere" part - dashboard.spec.ts's "Recent transactions" test already covers the update being
// visible after navigating, but under the old per-view-fetch design that would have passed too
// (Vue Router remounts each view on navigation, so it always re-fetched fresh data regardless).
test.describe('Shared transactions cache (UBE-82)', () => {
  test('loads transactions once per fetch-worthy change, not once per page visit', async ({ page }) => {
    const runId = Date.now();
    const description = `CacheCheck${runId}`;
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateForUpload = `${day}/${month}/${year}`;
    const qif = `!Type:Bank\nD${dateForUpload}\nM${description}\nT-12.34\n^\n`;

    let transactionGetCount = 0;
    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'GET' && url.pathname.endsWith('/transactions')) {
        transactionGetCount++;
      }
      await route.continue();
    });

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    // First page of the session - the shared store's initial load().
    await expect.poll(() => transactionGetCount).toBe(1);

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(`CacheAccount${runId}`);
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();

    // Visiting Transactions reuses the cache from the Dashboard visit above - no new GET.
    await page.getByRole('link', { name: 'Transactions' }).click();
    expect(transactionGetCount).toBe(1);

    await page.getByRole('link', { name: 'Upload' }).click();
    await page.locator('#account').selectOption(`CacheAccount${runId}`);
    await page.locator('#file-input').setInputFiles({ name: 'cache.qif', mimeType: 'text/plain', buffer: Buffer.from(qif) });
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page).toHaveURL(/\/transactions$/);
    // The upload forces a cache refresh (it changed server-side data the store didn't know
    // about) - exactly one new GET, and the uploaded row is now visible without a manual reload.
    await expect.poll(() => transactionGetCount).toBe(2);
    const row = page.locator('tr', { hasText: description });
    await expect(row).toBeVisible();

    await row.locator('.category-select').selectOption('Dining');
    await expect(row.locator('.category-select')).toHaveValue('Dining');
    // A single-transaction category edit mutates the shared store directly - still no new GET.
    expect(transactionGetCount).toBe(2);

    // Dashboard reuses the (already-updated) cache too - the category change is visible
    // immediately, with no additional fetch and no page reload anywhere in this test.
    await page.getByRole('link', { name: 'Dashboard' }).click();
    const card = page.locator('.card.recent-card');
    const ownRow = card.locator('.recent-row', { hasText: description });
    await expect(ownRow).toContainText('Dining');
    expect(transactionGetCount).toBe(2);

    // clean up the Settings account added for this test
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('.account-row').last().getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

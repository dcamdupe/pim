import { test, expect } from '@playwright/test';

// Playwright has no built-in "find the row whose input has this value" locator - the account name
// input's DOM `value` is set via v-model, not a static `value` attribute (or any rendered text
// content `hasText` could match), so this has to check each row's live input value instead. Same
// helper as accountDeletion.spec.ts.
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

// Settings are loaded once into a shared client-side store (not re-fetched by every page that
// displays them), refreshed every 1 minute, and immediately whenever settings are saved.
test.describe('Shared settings cache (UBE-87)', () => {
  test('loads settings once per fetch-worthy change, not once per page visit', async ({ page }) => {
    const runId = Date.now();
    const accountName = `SettingsCacheCheck${runId}`;

    let settingsGetCount = 0;
    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'GET' && url.pathname.endsWith('/settings')) {
        settingsGetCount++;
      }
      await route.continue();
    });

    await page.goto('/login');
    await page.locator('#email').fill('testuser@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    // Login itself forces a refresh, and Dashboard's own mount-time load() dedupes onto that same
    // in-flight request - exactly one GET for the whole login+dashboard-landing sequence.
    await expect.poll(() => settingsGetCount).toBe(1);

    // Settings' own page visit reuses the cache from login - no new GET (unlike the transactions
    // store, there's no expiry window here, so "already loaded" is enough on its own).
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);
    expect(settingsGetCount).toBe(1);

    // Same for the Upload page's account dropdown.
    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    expect(settingsGetCount).toBe(1);
    await expect(page.locator('#account option', { hasText: accountName })).toHaveCount(0);

    // Adding an account on Settings forces a refresh ("or when settings are saved") - exactly one
    // new GET, and the Upload page's dropdown reflects it immediately without a fetch of its own.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: '+ Add account' }).click();
    const newRow = page.locator('.account-row').last();
    await newRow.locator('input').nth(0).fill(accountName);
    await newRow.locator('select').selectOption('Transaction');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.').first()).toBeVisible();
    await expect.poll(() => settingsGetCount).toBe(2);

    await page.getByRole('link', { name: 'Transactions' }).click();
    await page.getByRole('link', { name: 'Upload' }).click();
    expect(settingsGetCount).toBe(2);
    await expect(page.locator('#account option', { hasText: accountName })).toHaveCount(1);

    // clean up the account added for this test - deleting it also forces a refresh (expected).
    await page.getByRole('link', { name: 'Settings' }).click();
    const addedRow = await findAccountRow(page, accountName);
    await addedRow.getByRole('button', { name: 'Remove account' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

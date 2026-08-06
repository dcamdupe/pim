import { test, expect } from '@playwright/test';
import path from 'path';

test('test', async ({ page }) => {
  const customerId = process.env.CustomerId;
  const password = process.env.Password;
  const account = process.env.Account;
  const startDate = process.env.StartDate;
  const endDate = process.env.EndDate;

  await page.goto('https://banking.westpac.com.au/wbc/banking/handler?TAM_OP=login&segment=personal&logout=false');
  await page.getByRole('heading', { name: 'Sign in to Westpac Online' }).click();
  await page.getByRole('textbox', { name: 'Customer ID' }).click();
  await page.getByRole('textbox', { name: 'Customer ID' }).fill(customerId!);
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: account! }).click();
  await page.goto('https://banking.westpac.com.au/secure/banking/reportsandexports/home');
  await page.getByRole('link', { name: 'Export Transactions' }).click();
  await page.locator('input[name="DateRange.StartDate"]').fill(startDate!);
  await page.locator('input[name="DateRange.EndDate"]').fill(endDate!);
  await page.getByRole('textbox', { name: 'Select accounts optional' }).click();
  await page.locator('#OpenAccounts').click();
  await page.getByRole('link', { name: 'Select dropdown' }).click();
  await page.getByRole('link', { name: 'Altitude Platinum Mastercard' }).click();
  await page.locator('label').filter({ hasText: /^QIF$/ }).click();
  await page.getByRole('link', { name: 'Select dropdown' }).click();
  await page.locator('#spoke-2-template').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const download = await downloadPromise;
  await download.saveAs(path.join(__dirname, download.suggestedFilename()));
});